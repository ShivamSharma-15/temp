import {
  ArrowDownCircle,
  ArrowUpCircle,
  Leaf,
  Power,
  ShieldAlert,
  Wind,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard.jsx";
import TrendChart from "../components/TrendChart.jsx";
import { useDashboardStore } from "../store/dashboardStore.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { DataTable } from "../components/data-table/data-table.jsx";
import HomeDataTable from "../components/HomeDataTable.jsx";

const energyColumns = [
  {
    accessorKey: "name",
    header: "Site",
    meta: { label: "Site" },
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "latestEnergy",
    header: "Energy (MWh)",
    meta: { label: "Energy (MWh)" },
    cell: ({ row }) => row.original.latestEnergy.toFixed(1),
  },
  {
    accessorKey: "delta",
    header: "Delta vs prev. day",
    meta: { label: "Delta vs prev. day" },
    cell: ({ row }) => {
      const value = row.original.delta;
      const isPositive = value >= 0;
      return (
        <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
          {isPositive ? "+" : ""}
          {value.toFixed(1)}
        </span>
      );
    },
  },
];

const FleetOverview = () => {
  const { user, sites, selectedDate, fleetBenchmarks } = useDashboardStore(
    (state) => ({
      user: state.user,
      sites: state.sites,
      selectedDate: state.selectedDate,
      fleetBenchmarks: state.fleetBenchmarks,
    })
  );
  const [metric, setMetric] = useState("power");

  if (!user) {
    return null;
  }

  const accessibleSites = sites.filter((site) =>
    user.accessibleSiteIds.includes(site.id)
  );
  const windowSize = 7;

  const aggregateSeriesMap = new Map();
  const perSiteLatest = accessibleSites.map((site) => {
    const latestEnergy = site.energySeries.at(-1)?.energyMWh ?? 0;
    const prevEnergy =
      site.energySeries.length > 1 ? site.energySeries.at(-2).energyMWh : null;
    return {
      site,
      latestEnergy,
      prevEnergy,
    };
  });

  const totalCapacityKw = accessibleSites.reduce(
    (sum, site) => sum + (site.capacityMw ?? 0) * 1000,
    0
  );

  accessibleSites.forEach((site) => {
    const slice = site.energySeries.slice(-windowSize);
    slice.forEach((entry) => {
      const bucket = aggregateSeriesMap.get(entry.date) ?? {
        date: entry.date,
        energyMWh: 0,
        irradianceWhm2: 0,
        samples: 0,
      };
      bucket.energyMWh += entry.energyMWh;
      bucket.irradianceWhm2 += entry.irradianceWhm2;
      bucket.samples += 1;
      aggregateSeriesMap.set(entry.date, bucket);
    });
  });

  const aggregateSeries = Array.from(aggregateSeriesMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      ...entry,
      irradianceWhm2: entry.samples
        ? Math.round(entry.irradianceWhm2 / entry.samples)
        : 0,
    }));

  const totalCapacityMw = accessibleSites.reduce(
    (sum, site) => sum + site.capacityMw,
    0
  );
  const totalEnergyMWh = perSiteLatest.reduce(
    (sum, item) => sum + item.latestEnergy,
    0
  );
  const performanceRatio = accessibleSites.length
    ? accessibleSites.reduce((sum, site) => sum + site.performanceRatioPct, 0) /
      accessibleSites.length
    : 0;
  const openAlarms = accessibleSites.reduce(
    (sum, site) =>
      sum + site.alarms.filter((alarm) => !alarm.resolvedAt).length,
    0
  );
  const onlineUnits = accessibleSites.reduce(
    (sum, site) =>
      sum + site.units.filter((unit) => unit.status === "Online").length,
    0
  );
  const offlineUnits = accessibleSites.reduce(
    (sum, site) =>
      sum + site.units.filter((unit) => unit.status !== "Online").length,
    0
  );

  const energyDelta = perSiteLatest.reduce((sum, item) => {
    const delta =
      item.prevEnergy == null ? 0 : item.latestEnergy - item.prevEnergy;
    return sum + delta;
  }, 0);

  const leadingSite =
    accessibleSites.length > 0
      ? [...accessibleSites].sort(
          (a, b) => b.performanceRatioPct - a.performanceRatioPct
        )[0]
      : null;

  const energyLeaders = accessibleSites
    .map((site) => ({
      id: site.id,
      name: site.name,
      latestEnergy: site.energySeries.at(-1)?.energyMWh ?? 0,
      delta:
        site.energySeries.length > 1
          ? site.energySeries.at(-1).energyMWh -
            site.energySeries.at(-2).energyMWh
          : 0,
    }))
    .sort((a, b) => b.latestEnergy - a.latestEnergy)
    .slice(0, 3);

  const resolveCardDate = (site) => {
    const available = site.availableCardDates ?? [];
    if (!available.length) return null;
    const sorted = [...available].sort();
    const target = selectedDate ?? sorted.at(-1);
    const eligible = sorted.filter((date) => date <= target);
    return eligible.at(-1) ?? sorted.at(-1);
  };

  const aggregatedCards = (() => {
    const accumulator = {
      capacityKw: 0,
      dailyEnergyKwh: 0,
      netExport: 0,
      netImport: 0,
      specificYield: [],
      cuf: [],
    };

    accessibleSites.forEach((site) => {
      accumulator.capacityKw += (site.capacityMw ?? 0) * 1000;

      const resolvedDate = resolveCardDate(site);
      const siteCard = resolvedDate
        ? site.cardsByDate?.[resolvedDate] ?? {}
        : {};
      const dailyEnergy =
        siteCard["Daily Energy (kWh)"] ??
        (site.energySeries.at(-1)?.energyMWh ?? 0) * 1000;
      const specYield = siteCard["Specific Yield (kWh/kWp)"];
      const cuf = siteCard["CUF (%)"];
      const netExp = siteCard["Net Export (kWh)"];
      const netImp = siteCard["Net Import (kWh)"];

      if (Number.isFinite(dailyEnergy))
        accumulator.dailyEnergyKwh += dailyEnergy;
      if (Number.isFinite(netExp)) accumulator.netExport += netExp;
      if (Number.isFinite(netImp)) accumulator.netImport += netImp;
      if (Number.isFinite(specYield)) accumulator.specificYield.push(specYield);
      if (Number.isFinite(cuf)) accumulator.cuf.push(cuf);
    });

    const avg = (arr) =>
      arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    return {
      "Site Capacity (kWp)": accumulator.capacityKw,
      "Daily Energy (kWh)": accumulator.dailyEnergyKwh,
      "Net Export (kWh)": accumulator.netExport || null,
      "Net Import (kWh)": accumulator.netImport || null,
      "Specific Yield (kWh/kWp)": avg(accumulator.specificYield),
      "CUF (%)": avg(accumulator.cuf),
    };
  })();

  const aggregatedLastDaySeries = useMemo(() => {
    const map = new Map();
    const normalizeTimestamp = (ts) => Math.round(ts / 60) * 60;
    accessibleSites.forEach((site) => {
      (site.lastDayData ?? []).forEach((entry) => {
        if (entry?.timestamp == null) return;
        const ts = normalizeTimestamp(entry.timestamp);
        const bucket = map.get(ts) ?? {
          timestamp: ts,
          time: new Date(ts * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          activePower: 0,
          solarIrradiation: 0,
          dailyEnergy: 0,
          hasPower: false,
          hasIrradiation: false,
          hasEnergy: false,
        };
        if (
          entry.activePower != null ||
          entry.value != null ||
          entry.parameter_name === "Output Active Power"
        ) {
          const value = entry.activePower ?? entry.value ?? 0;
          bucket.activePower += value;
          bucket.hasPower = true;
        }
        if (
          entry.solarIrradiation != null ||
          entry.parameter_name === "Solar Irradiation"
        ) {
          const value = entry.solarIrradiation ?? entry.value ?? 0;
          bucket.solarIrradiation += value;
          bucket.hasIrradiation = true;
        }
        if (
          entry.dailyEnergy != null ||
          entry.parameter_name === "Daily Energy"
        ) {
          const value = entry.dailyEnergy ?? entry.value ?? 0;
          bucket.dailyEnergy += value;
          bucket.hasEnergy = true;
        }
        map.set(ts, bucket);
      });
    });

    const result = Array.from(map.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
    return result.map((entry) => {
      const prPct =
        entry.hasPower &&
        entry.hasIrradiation &&
        entry.solarIrradiation > 0 &&
        totalCapacityKw > 0
          ? (entry.activePower * 1000 * 100) /
            (totalCapacityKw * entry.solarIrradiation)
          : null;
      return {
        ...entry,
        activePowerKwp: entry.hasPower ? entry.activePower : null,
        energyKwh: entry.hasEnergy ? entry.dailyEnergy : null,
        prPct,
      };
    });
  }, [accessibleSites, totalCapacityKw]);

  const aggregatedDailyChartSeries = useMemo(
    () =>
      aggregateSeries.map((entry) => ({
        date: entry.date,
        energyKwh: entry.energyMWh * 1000,
        irradiationKwhm2: entry.irradianceWhm2 / 1000,
      })),
    [aggregateSeries]
  );

  const hasIntraday = aggregatedLastDaySeries.length > 0;
  const useIntraday = hasIntraday;
  const chartData = useIntraday
    ? aggregatedLastDaySeries
    : aggregatedDailyChartSeries;
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

  const dailyCards = useMemo(() => {
    const definitions = [
      {
        key: "Site Capacity (kWp)",
        label: "Site Capacity",
        suffix: " kWp",
        precision: 2,
        icon: Power,
        fallback: totalCapacityKw,
      },
      {
        key: "Daily Energy (kWh)",
        label: "Daily Energy",
        suffix: " kWh",
        precision: 1,
        icon: Zap,
        fallback: aggregateSeries.at(-1)?.energyMWh
          ? aggregateSeries.at(-1).energyMWh * 1000
          : aggregatedLastDaySeries.at(-1)?.energyKwh,
      },
      {
        key: "Net Export (kWh)",
        label: "Net Export",
        suffix: " kWh",
        precision: 1,
        icon: ArrowUpCircle,
      },
      {
        key: "Net Import (kWh)",
        label: "Net Import",
        suffix: " kWh",
        precision: 1,
        icon: ArrowDownCircle,
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

    return definitions.map((definition) => {
      const rawValue = aggregatedCards[definition.key] ?? definition.fallback;
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
  }, [aggregatedCards, aggregatedLastDaySeries, totalCapacityKw]);

  return (
    <>
    <div className="space-y-6 hidden">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">Fleet snapshot</p>
          {selectedDate && (
            <p className="text-xs text-muted-foreground">
              Data for {selectedDate}
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
            <CardTitle className="mb-3">
              {selectedMetric === "power"
                ? "Output Active Power"
                : selectedMetric === "irradiation"
                ? "Solar Irradiation"
                : selectedMetric === "energy"
                ? "Daily Energy"
                : "Performance Ratio (%)"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Aggregated across accessible sites
            </CardDescription>

            {useIntraday && (
              <div className="mt-3 flex items-center gap-2">
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
                <ComposedChart data={chartData}>
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
                        return [`${value?.toFixed?.(1) ?? value} kW`, name];
                      }
                      if (name.includes("Energy")) {
                        return [`${value?.toFixed?.(1) ?? value} kWh`, name];
                      }
                      if (name.includes("Irradiation")) {
                        return [`${value?.toFixed?.(1) ?? value} W/m2`, name];
                      }
                      if (name.includes("PR")) {
                        return [`${value?.toFixed?.(2) ?? value} %`, name];
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
            <CardTitle>System health</CardTitle>
            <CardDescription>Live fleet readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatCard
              label="Units online"
              value={`${onlineUnits}`}
              icon={ShieldAlert}
              hint={`${offlineUnits} need attention`}
            />
            <StatCard
              label="Open alarms"
              value={`${openAlarms}`}
              icon={ShieldAlert}
              hint="Unresolved across fleet"
            />
          </CardContent>
        </Card>
      </section>

      {/* <section className="grid gap-6">
        <TrendChart
          title="Generation vs irradiance"
          subtitle="Normalised per day across selected window."
          data={aggregateSeries}
          lines={[
            { dataKey: 'energyMWh', color: '#2563eb', name: 'Energy (MWh)' },
            { dataKey: 'irradianceWhm2', color: '#f97316', name: 'Irradiance (Wh/m2)' }
          ]}
          yLabel="Energy / Irradiance"
        />
      </section> */}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>Operational highlights</CardTitle>
            <CardDescription>
              Auto-generated talking points from the latest refresh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-sm text-slate-600">
              {leadingSite && (
                <li className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <p className="font-semibold text-slate-900">
                    {leadingSite.name}
                  </p>
                  <p className="mt-1">
                    Leading the pack at{" "}
                    {leadingSite.performanceRatioPct.toFixed(1)} % performance
                    ratio thanks to consistent string alignment.
                  </p>
                </li>
              )}
              {openAlarms > 0 ? (
                <li className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
                  {openAlarms} alarm{openAlarms === 1 ? "" : "s"} still active.
                  Prioritise inverter restarts before the next irradiance peak.
                </li>
              ) : (
                <li className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4">
                  All monitored units are healthy. Keep the preventive
                  maintenance cadence unchanged.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>Top energy contributors</CardTitle>
            <CardDescription>
              Latest production and shift against the prior day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={energyColumns}
              data={energyLeaders}
              searchKey="name"
              initialPageSize={5}
              emptyState="No generation data in the selected window."
            />
          </CardContent>
        </Card>
      </section>
    </div>
    <HomeDataTable />   
    </>
  );
};

export default FleetOverview;
