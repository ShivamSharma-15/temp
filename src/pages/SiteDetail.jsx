import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  Gauge,
  Leaf,
  MapPin,
  Power,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TrendChart from "../components/TrendChart.jsx";
import StatCard from "../components/StatCard.jsx";
import { useDashboardStore } from "../store/dashboardStore.js";
import { Badge } from "../components/ui/badge.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { DataTable } from "../components/data-table/data-table.jsx";

const severityTone = {
  Critical: "destructive",
  High: "warning",
  Medium: "info",
  Low: "secondary",
};

const unitColumns = [
  {
    accessorKey: "id",
    header: "Unit",
    meta: { label: "Unit" },
    cell: ({ row }) => (
      <span className="font-semibold text-foreground">{row.original.id}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    meta: { label: "Type" },
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Status" },
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.status}
      </span>
    ),
  },
  {
    accessorKey: "ratedKw",
    header: "Rated (kW)",
    meta: { label: "Rated (kW)" },
  },
  {
    accessorKey: "lastOutputKwh",
    header: "Last output (kWh)",
    meta: { label: "Last output (kWh)" },
    cell: ({ row }) => row.original.lastOutputKwh?.toFixed(1) ?? "-",
  },
  {
    accessorKey: "issues",
    header: "Issues",
    meta: { label: "Issues" },
    cell: ({ row }) => row.original.issues || "None",
  },
];

const defaultHistoryFields = [
  { key: "date", label: "Date", canHide: false, precision: 0 },
  { key: "time", label: "Time", canHide: true, precision: 0 },
  { key: "energyMWh", label: "Energy (MWh)", precision: 2 },
  { key: "peakPowerMw", label: "Peak (MW)", precision: 2 },
  { key: "performanceRatioPct", label: "PR (%)", precision: 1 },
  { key: "irradianceWhm2", label: "Irradiance (Wh/m2)", precision: 0 },
];

const formatHistoryValue = (value, field) => {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    const precision = field?.precision ?? (Math.abs(value) >= 100 ? 0 : 2);
    return value.toLocaleString(undefined, {
      maximumFractionDigits: precision,
      minimumFractionDigits: field?.fixed ? precision : undefined,
    });
  }
  return value;
};

const createAlarmColumns = (canModify, onAcknowledge, onResolve) => [
  {
    accessorKey: "id",
    header: "ID",
    meta: { label: "ID" },
  },
  {
    accessorKey: "unitId",
    header: "Unit",
    meta: { label: "Unit" },
  },
  {
    accessorKey: "severity",
    header: "Severity",
    meta: { label: "Severity" },
    cell: ({ row }) => (
      <Badge variant={severityTone[row.original.severity] ?? "secondary"}>
        {row.original.severity}
      </Badge>
    ),
  },
  {
    accessorKey: "message",
    header: "Message",
    meta: { label: "Message" },
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.message}
      </span>
    ),
  },
  {
    accessorKey: "triggeredAt",
    header: "Triggered",
    meta: { label: "Triggered" },
    cell: ({ row }) => new Date(row.original.triggeredAt).toLocaleString(),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Status" },
    cell: ({ row }) => {
      const alarm = row.original;
      if (alarm.resolvedAt) {
        return `Resolved ${new Date(alarm.resolvedAt).toLocaleString()}`;
      }
      if (alarm.acknowledgedBy) {
        return `Acknowledged by ${alarm.acknowledgedBy}`;
      }
      return "Open";
    },
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => {
      if (!canModify) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {!row.original.acknowledgedBy && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAcknowledge(row.original.id)}
            >
              Acknowledge
            </Button>
          )}
          {!row.original.resolvedAt && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(row.original.id)}
            >
              Resolve
            </Button>
          )}
        </div>
      );
    },
  },
];

const SiteDetail = () => {
  const { siteId } = useParams();
  const { user, sites, selectedDate, acknowledgeAlarm, resolveAlarm } =
    useDashboardStore((state) => ({
      user: state.user,
      sites: state.sites,
      selectedDate: state.selectedDate,
      acknowledgeAlarm: state.acknowledgeAlarm,
      resolveAlarm: state.resolveAlarm,
    }));

  if (!user) {
    return null;
  }

  const site = sites.find((item) => item.id === siteId);

  if (!site) {
    return <Navigate to="/app" replace />;
  }

  if (!user.accessibleSiteIds.includes(site.id)) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>
              Ask an admin for visibility into this site.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const windowSize = 7;
  const fullEnergySeries = site.energySeries;
  const energySeries = fullEnergySeries.slice(-windowSize);
  const siteCapacityKw = (site.capacityMw ?? 0) * 1000 || 3402.98;

  const unitGroups = useMemo(() => {
    const groups = site.units.reduce(
      (acc, unit) => {
        acc[unit.status] = (acc[unit.status] ?? 0) + 1;
        return acc;
      },
      { Online: 0, Warning: 0, Offline: 0, Maintenance: 0 }
    );
    return groups;
  }, [site.units]);

  const canModifyAlarms = user.role === "owner" || user.role === "admin";

  const handleAcknowledge = (alarmId) => {
    if (!canModifyAlarms) return;
    acknowledgeAlarm(site.id, alarmId, user.name);
  };

  const handleResolve = (alarmId) => {
    if (!canModifyAlarms) return;
    resolveAlarm(site.id, alarmId, new Date().toISOString());
  };

  const historyFields = site.historyFields ?? defaultHistoryFields;
  const historyColumns = useMemo(
    () =>
      historyFields.map((field) => ({
        accessorKey: field.key,
        header: field.label,
        meta: { label: field.label },
        enableHiding: field.canHide !== false,
        cell: ({ row }) => formatHistoryValue(row.original[field.key], field),
      })),
    [historyFields]
  );
  const historyTableData = fullEnergySeries;

  const dailyChartSeries = useMemo(
    () =>
      energySeries.map((entry) => ({
        date: entry.date,
        energyKwh: entry.energyMWh * 1000,
        irradiationKwhm2: entry.irradianceWhm2 / 1000,
      })),
    [energySeries]
  );

  const lastDaySeries = useMemo(() => {
    if (site.lastDayData?.length) {
      const buckets = new Map();
      site.lastDayData.forEach((entry) => {
        const bucket = buckets.get(entry.timestamp) ?? {
          timestamp: entry.timestamp,
          time: new Date(entry.timestamp * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        if (entry.parameter_name === "Daily Energy") {
          bucket.dailyEnergy = entry.value;
          bucket.hasDailyEnergy = true;
        } else if (entry.parameter_name === "Output Active Power") {
          bucket.activePower = entry.value;
          bucket.hasActivePower = true;
        } else if (entry.parameter_name === "Solar Irradiation") {
          bucket.solarIrradiation = entry.value;
          bucket.hasSolarIrradiation = true;
        } else if (
          entry.parameter_name === "PR (%)" ||
          entry.prPct !== undefined
        ) {
          bucket.prPct = entry.prPct ?? entry.value;
        }
        if (entry.activePower !== undefined) {
          bucket.activePower = entry.activePower;
        }
        if (entry.hasActivePower !== undefined) {
          bucket.hasActivePower = entry.hasActivePower;
        }
        if (entry.solarIrradiation !== undefined) {
          bucket.solarIrradiation = entry.solarIrradiation;
        }
        if (entry.hasSolarIrradiation !== undefined) {
          bucket.hasSolarIrradiation = entry.hasSolarIrradiation;
        }
        if (entry.dailyEnergy !== undefined) {
          bucket.dailyEnergy = entry.dailyEnergy;
        }
        if (entry.hasDailyEnergy !== undefined) {
          bucket.hasDailyEnergy = entry.hasDailyEnergy;
        }
        if (entry.prPct !== undefined) {
          bucket.prPct = entry.prPct;
        }
        buckets.set(entry.timestamp, bucket);
      });
      return Array.from(buckets.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      );
    }

    const latest = fullEnergySeries.at(-1);
    if (!latest) return [];
    const timestamp = Math.floor(
      new Date(`${latest.date}T12:00:00`).getTime() / 1000
    );
    return [
      {
        timestamp,
        time: new Date(timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        dailyEnergy: (latest.energyMWh ?? 0) * 1000,
        activePower: (latest.peakPowerMw ?? 0) * 1000,
        solarIrradiation: latest.irradianceWhm2 ?? 0,
      },
    ];
  }, [site.lastDayData, fullEnergySeries]);

  const lastDayChartSeries = useMemo(
    () =>
      lastDaySeries.map((entry) => {
        const hasPower =
          entry.hasActivePower ?? entry.activePower !== undefined;
        const hasIrradiation =
          entry.hasSolarIrradiation ?? entry.solarIrradiation !== undefined;
        const hasEnergy =
          entry.hasDailyEnergy ?? entry.dailyEnergy !== undefined;

        const activePowerValue = hasPower ? entry.activePower ?? 0 : null;
        const irradiationValue = hasIrradiation
          ? entry.solarIrradiation ?? 0
          : null;
        const energyValue = hasEnergy ? entry.dailyEnergy ?? 0 : null;
        const prPctValue =
          entry.prPct != null
            ? entry.prPct
            : hasPower && hasIrradiation && irradiationValue > 0
            ? (activePowerValue * 1000 * 100) /
              (siteCapacityKw * irradiationValue)
            : null;

        return {
          ...entry,
          activePower: activePowerValue,
          activePowerKwp: activePowerValue,
          dailyEnergy: energyValue,
          energyKwh: energyValue,
          solarIrradiation: irradiationValue,
          prPct: prPctValue,
          irradiationKwhm2:
            irradiationValue == null ? null : irradiationValue / 1000,
        };
      }),
    [lastDaySeries, siteCapacityKw]
  );

  const averagePrToday = useMemo(() => {
    const valid = lastDayChartSeries.filter((entry) => entry.prPct > 0);
    if (valid.length) {
      const avg =
        valid.reduce((sum, entry) => sum + entry.prPct, 0) / valid.length;
      return avg;
    }
    const latestDaily = dailyChartSeries.at(-1);
    if (latestDaily?.performanceRatioPct == null) return null;
    return latestDaily.performanceRatioPct;
  }, [lastDayChartSeries, dailyChartSeries]);

  const availableCardDates = site.availableCardDates ?? [];
  const cardsByDate = site.cardsByDate ?? {};
  const resolvedCardDate = useMemo(() => {
    if (!availableCardDates.length) return selectedDate;
    const sorted = [...availableCardDates].sort();
    const target = selectedDate ?? sorted.at(-1);
    const eligible = sorted.filter((date) => date <= target);
    return eligible.at(-1) ?? sorted[0];
  }, [availableCardDates, selectedDate]);
  const cardData = cardsByDate[resolvedCardDate] ?? null;
  const cardDateLabel = resolvedCardDate || selectedDate;

  const formatCardValue = (value, suffix = "", precision = 2) => {
    if (value === undefined || value === null || value === "") return "-";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "-";
      return `${value.toLocaleString(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })}${suffix}`;
    }
    return `${value}${suffix}`;
  };

  const dailyCards = useMemo(() => {
    const definitions = [
      {
        key: "Site Capacity (kWp)",
        label: "Site Capacity",
        suffix: " kWp",
        precision: 2,
        icon: Power,
        fallback: siteCapacityKw,
      },
      {
        key: "Output Active Power (kWp)",
        label: "Output Active Power",
        suffix: " kWp",
        precision: 2,
        icon: Zap,
        fallback: lastDayChartSeries.at(-1)?.activePowerKwp,
      },
      {
        key: "PR (%)",
        label: "PR (%)",
        suffix: " %",
        precision: 2,
        icon: Gauge,
        fallback: averagePrToday,
      },
      {
        key: "Specific Yield (kWh/kWp)",
        label: "Specific Yield",
        suffix: " kWh/kWp",
        precision: 2,
        icon: Leaf,
      },
      {
        key: "CUF (%)",
        label: "CUF (%)",
        suffix: " %",
        precision: 2,
        icon: Wind,
      },
    ];

    return definitions.map((definition) => {
      const rawValue = cardData?.[definition.key] ?? definition.fallback;
      return {
        label: definition.label,
        value: formatCardValue(
          rawValue,
          definition.suffix,
          definition.precision
        ),
        icon: definition.icon,
      };
    });
  }, [averagePrToday, cardData, lastDayChartSeries, siteCapacityKw]);

  const [metric, setMetric] = useState("power");

  const hasIntraday = site.lastDayData?.length > 0;
  const useIntraday = hasIntraday;
  const chartData = useIntraday ? lastDayChartSeries : dailyChartSeries;
  const xKey = useIntraday ? "time" : "date";
  const selectedMetric = useIntraday ? metric : "energy";
  const lineSeries = useMemo(() => {
    if (selectedMetric === "irradiation") {
      return [
        {
          key: useIntraday ? "solarIrradiation" : "irradiationKwhm2",
          name: useIntraday
            ? "Solar Irradiation (W/m2)"
            : "Irradiation (kWh/m2)",
          color: "#f97316",
        },
      ];
    }
    if (selectedMetric === "energy") {
      return [
        { key: "energyKwh", name: "Daily Energy (kWh)", color: "#2563eb" },
      ];
    }
    if (selectedMetric === "pr") {
      return [{ key: "prPct", name: "PR (%)", color: "#10b981" }];
    }
    return [
      {
        key: "activePowerKwp",
        name: "Output Active Power (kW)",
        color: "#2563eb",
      },
    ];
  }, [selectedMetric, useIntraday]);
  const yLabel = useMemo(() => {
    switch (selectedMetric) {
      case "irradiation":
        return useIntraday ? "W/m2" : "kWh/m2";
      case "energy":
        return "Energy (kWh)";
      case "pr":
        return "PR (%)";
      default:
        return "Power (kW)";
    }
  }, [selectedMetric, useIntraday]);

  const alarmColumns = createAlarmColumns(
    canModifyAlarms,
    handleAcknowledge,
    handleResolve
  );

  const latestWeather = site.weather.current;

  function fixedChart() {
    let filtered = chartData;
    if (useIntraday) {
      if (metric === "power") {
        filtered = filtered.filter(
          (item) =>
            item.activePowerKwp !== undefined &&
            item.activePowerKwp !== null &&
            item.activePowerKwp > 0
        );
      } else if (metric === "irradiation") {
        filtered = filtered.filter(
          (item) =>
            item.solarIrradiation !== undefined &&
            item.solarIrradiation !== null &&
            item.solarIrradiation > 0
        );
      } else if (metric === "energy") {
        filtered = filtered.filter(
          (item) =>
            item.energyKwh !== undefined &&
            item.energyKwh !== null &&
            item.energyKwh > 0
        );
      } else if (metric === "pr") {
        filtered = filtered.filter(
          (item) => item.prPct > 0 && item.prPct < 100
        );
      }
    }

    if (metric === "pr") {
      return filtered;
    }

    return filtered;
  }

  function getTitleTable() {
    if (metric === "pr") {
      return "Performance Ratio (%)";
    } else if (metric === "irradiation") {
      return "Solar Irradiation";
    } else if (metric === "energy") {
      return "Daily Energy";
    } else if (metric === "power") {
      return "Output Active Power";
    }
  }
  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-primary">
              Site detail
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {site.name}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-slate-400" />
              {site.location} - Commissioned {site.installedAt} -{" "}
              {site.technology.join(" / ")}
            </p>
          </div>
          <Badge
            variant={
              site.status === "Online"
                ? "success"
                : site.status === "Warning"
                ? "warning"
                : "secondary"
            }
          >
            {site.status}
          </Badge>
        </div>
      </header>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">Daily snapshot</p>
          {cardDateLabel && (
            <p className="text-xs text-muted-foreground">
              {resolvedCardDate === selectedDate || !selectedDate
                ? `Data for ${cardDateLabel}`
                : `Using ${cardDateLabel} (closest to ${selectedDate})`}
            </p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {dailyCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="mb-3">{getTitleTable()}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Data for {selectedDate}
            </CardDescription>

            {useIntraday && (
              <div className="mt-3 flex gap-2 items-center">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="metric-select"
                >
                  Series
                </label>
                <select
                  id="metric-select"
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  <option value="power">Output Active Power</option>
                  <option value="irradiation">Solar Irradiation</option>
                  <option value="energy">Daily Energy</option>
                  <option value="pr">PR (%)</option>
                </select>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fixedChart(chartData)}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey={xKey}
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#2563eb"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: yLabel,
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#2563eb", fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      borderColor: "#e2e8f0",
                    }}
                    formatter={(value, name) => {
                      if (name.includes("Power")) {
                        return [`${value.toFixed(1)} kW`, name];
                      }
                      if (name.includes("Energy")) {
                        return [`${value.toFixed(1)} kWh`, name];
                      }
                      if (name.includes("Irradiation")) {
                        return [`${value.toFixed(1)} W/m2`, name];
                      }
                      if (name.includes("PR")) {
                        return [`${value.toFixed(2)} %`, name];
                      }
                      return [value, name];
                    }}
                  />
                  {lineSeries.map((line) => (
                    <Line
                      key={line.key}
                      yAxisId="left"
                      type="monotone"
                      dataKey={line.key}
                      name={line.name}
                      stroke={line.color}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                      strokeDasharray={line.strokeDasharray}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-b from-sky-50 to-white shadow-sm">
          <CardHeader>
            <CardTitle>Weather snapshot</CardTitle>
            <CardDescription>
              Live feed from the on-site weather station.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <span className="text-5xl font-semibold text-slate-900">
                {Math.round(latestWeather.temperatureC)} deg C
              </span>
              <span className="text-sm text-muted-foreground">
                {latestWeather.condition}
              </span>
            </div>
            <div className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-3 text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-slate-400" />
                Wind: {latestWeather.windKph} kph
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-slate-400" />
                Irradiance: {latestWeather.ghi} W/m2
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-slate-400" />
                Humidity: {latestWeather.humidityPct} %
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* <section className="grid gap-6">
        <TrendChart
          title="Past 24h telemetry"
          subtitle="Raw series from data.JSON"
          data={lastDayChartSeries}
          xKey="time"
          lines={[
            {
              dataKey: "dailyEnergy",
              color: "#2563eb",
              name: "Daily Energy (kWh)",
            },
            {
              dataKey: "activePower",
              color: "#16a34a",
              name: "Output Active Power (kWp)",
            },
            {
              dataKey: "solarIrradiation",
              color: "#f97316",
              name: "Solar Irradiation (W/m2)",
            },
          ]}
          yLabel="kWh / kWp / W/m2"
        />
      </section> */}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Historic daily aggregates</CardTitle>
            <CardDescription>Production and irradiance.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={historyColumns}
              data={historyTableData}
              searchKey="date"
              initialPageSize={7}
              emptyState="No historic entries for this range."
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Unit overview</CardTitle>
            <CardDescription>Latest telemetry across devices.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={unitColumns}
              data={site.units}
              searchKey="id"
              initialPageSize={6}
              emptyState="No units available."
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Unit readiness</CardTitle>
            <CardDescription>Breakdown by status category.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {Object.entries(unitGroups).map(([status, count]) => (
              <div
                key={status}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-center"
              >
                <p className="text-2xl font-semibold text-slate-900">{count}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {status}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Maintenance narratives</CardTitle>
            <CardDescription>Quick context for operators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
              <p className="font-semibold text-slate-900">Focus next</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Align tracker rows B12-B15 before the afternoon ramp. Crew
                already dispatched.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
              <p className="font-semibold text-slate-900">Weather window</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Calm winds expected for the next 36 hours -- plan inverter
                restarts during this slot.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Alarm center</CardTitle>
          <CardDescription>Live feed and device-level checks.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={alarmColumns}
            data={site.alarms}
            searchKey="message"
            initialPageSize={8}
            emptyState="No alarms on record for this site."
          />
        </CardContent>
      </Card> */}
    </div>
  );
};

export default SiteDetail;
