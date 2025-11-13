import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Leaf,
  MapPin,
  Power,
  Thermometer,
  Wind,
  Zap
} from 'lucide-react';
import TrendChart from '../components/TrendChart.jsx';
import StatCard from '../components/StatCard.jsx';
import { useDashboardStore } from '../store/dashboardStore.js';
import { Badge } from '../components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { DataTable } from '../components/data-table/data-table.jsx';

const rangeToDays = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

const severityTone = {
  Critical: 'destructive',
  High: 'warning',
  Medium: 'info',
  Low: 'secondary'
};

const unitColumns = [
  {
    accessorKey: 'id',
    header: 'Unit',
    meta: { label: 'Unit' },
    cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.id}</span>
  },
  {
    accessorKey: 'type',
    header: 'Type',
    meta: { label: 'Type' }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.status}</span>
  },
  {
    accessorKey: 'ratedMw',
    header: 'Rated (MW)',
    meta: { label: 'Rated (MW)' }
  },
  {
    accessorKey: 'lastOutputMwh',
    header: 'Last output (MWh)',
    meta: { label: 'Last output (MWh)' },
    cell: ({ row }) => row.original.lastOutputMwh?.toFixed(2) ?? '-'
  },
  {
    accessorKey: 'issues',
    header: 'Issues',
    meta: { label: 'Issues' },
    cell: ({ row }) => row.original.issues || 'None'
  }
];

const defaultHistoryFields = [
  { key: 'date', label: 'Date', canHide: false, precision: 0 },
  { key: 'time', label: 'Time', canHide: true, precision: 0 },
  { key: 'energyMWh', label: 'Energy (MWh)', precision: 2 },
  { key: 'peakPowerMw', label: 'Peak (MW)', precision: 2 },
  { key: 'availabilityPct', label: 'Availability %', precision: 1 },
  { key: 'performanceRatioPct', label: 'PR (%)', precision: 1 },
  { key: 'irradianceWhm2', label: 'Irradiance (Wh/m²)', precision: 0 }
];

const formatHistoryValue = (value, field) => {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  if (typeof value === 'number') {
    const precision = field?.precision ?? (Math.abs(value) >= 100 ? 0 : 2);
    return value.toLocaleString(undefined, {
      maximumFractionDigits: precision,
      minimumFractionDigits: field?.fixed ? precision : undefined
    });
  }
  return value;
};

const createAlarmColumns = (canModify, onAcknowledge, onResolve) => [
  {
    accessorKey: 'id',
    header: 'ID',
    meta: { label: 'ID' }
  },
  {
    accessorKey: 'unitId',
    header: 'Unit',
    meta: { label: 'Unit' }
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    meta: { label: 'Severity' },
    cell: ({ row }) => (
      <Badge variant={severityTone[row.original.severity] ?? 'secondary'}>
        {row.original.severity}
      </Badge>
    )
  },
  {
    accessorKey: 'message',
    header: 'Message',
    meta: { label: 'Message' },
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.message}</span>
  },
  {
    accessorKey: 'triggeredAt',
    header: 'Triggered',
    meta: { label: 'Triggered' },
    cell: ({ row }) => new Date(row.original.triggeredAt).toLocaleString()
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    cell: ({ row }) => {
      const alarm = row.original;
      if (alarm.resolvedAt) {
        return `Resolved ${new Date(alarm.resolvedAt).toLocaleString()}`;
      }
      if (alarm.acknowledgedBy) {
        return `Acknowledged by ${alarm.acknowledgedBy}`;
      }
      return 'Open';
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    enableHiding: false,
    cell: ({ row }) => {
      if (!canModify) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {!row.original.acknowledgedBy && (
            <Button size="sm" variant="secondary" onClick={() => onAcknowledge(row.original.id)}>
              Acknowledge
            </Button>
          )}
          {!row.original.resolvedAt && (
            <Button size="sm" variant="outline" onClick={() => onResolve(row.original.id)}>
              Resolve
            </Button>
          )}
        </div>
      );
    }
  }
];

const SiteDetail = () => {
  const { siteId } = useParams();
  const { user, sites, dateRange, acknowledgeAlarm, resolveAlarm } = useDashboardStore((state) => ({
    user: state.user,
    sites: state.sites,
    dateRange: state.dateRange,
    acknowledgeAlarm: state.acknowledgeAlarm,
    resolveAlarm: state.resolveAlarm
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
            <CardDescription>Ask an admin for visibility into this site.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const windowSize = rangeToDays[dateRange] ?? 7;
  const energySeries = site.energySeries.slice(-windowSize);

  const openAlarms = site.alarms.filter((alarm) => !alarm.resolvedAt);
  const acknowledgedAlarms = site.alarms.filter((alarm) => alarm.acknowledgedBy && !alarm.resolvedAt);
  const resolvedAlarms = site.alarms.filter((alarm) => alarm.resolvedAt);

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

  const canModifyAlarms = user.role === 'owner' || user.role === 'admin';

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
        cell: ({ row }) => formatHistoryValue(row.original[field.key], field)
      })),
    [historyFields]
  );

  const alarmColumns = createAlarmColumns(canModifyAlarms, handleAcknowledge, handleResolve);

  const latestWeather = site.weather.current;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-primary">Site detail</p>
            <h1 className="text-2xl font-semibold text-slate-900">{site.name}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-slate-400" />
              {site.location} - Commissioned {site.installedAt} - {site.technology.join(' / ')}
            </p>
          </div>
          <Badge variant={site.status === 'Online' ? 'success' : site.status === 'Warning' ? 'warning' : 'secondary'}>
            {site.status}
          </Badge>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Capacity" value={`${site.capacityMw} MW`} hint="Installed AC capacity" icon={Power} />
        <StatCard
          label="Performance ratio"
          value={`${site.performanceRatioPct.toFixed(1)} %`}
          hint="Daily yield vs theoretical max"
          icon={Zap}
        />
        <StatCard
          label="Average availability"
          value={`${site.avgAvailabilityPct.toFixed(1)} %`}
          hint="Rolling 30 day"
          icon={Leaf}
        />
        <StatCard
          label="Alarms"
          value={`${openAlarms.length} open`}
          hint={`${acknowledgedAlarms.length} acknowledged / ${resolvedAlarms.length} resolved`}
          icon={AlertTriangle}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <TrendChart
          title="Daily energy output"
          subtitle="MWh vs availability percentage."
          data={energySeries}
          lines={[
            { dataKey: 'energyMWh', color: '#2563eb', name: 'Energy (MWh)' },
            { dataKey: 'availabilityPct', color: '#16a34a', name: 'Availability (%)' }
          ]}
          yLabel="Energy / Availability"
        />
        <Card className="bg-gradient-to-b from-sky-50 to-white shadow-sm">
          <CardHeader>
            <CardTitle>Weather snapshot</CardTitle>
            <CardDescription>Live feed from the on-site weather station.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <span className="text-5xl font-semibold text-slate-900">
                {Math.round(latestWeather.temperatureC)} deg C
              </span>
              <span className="text-sm text-muted-foreground">{latestWeather.condition}</span>
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{status}</p>
              </div>
            ))}
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
            <CardTitle>Historic daily aggregates</CardTitle>
            <CardDescription>Production, availability and irradiance.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={historyColumns}
              data={energySeries}
              searchKey="date"
              initialPageSize={7}
              emptyState="No historic entries for this range."
            />
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
                Align tracker rows B12-B15 before the afternoon ramp. Crew already dispatched.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
              <p className="font-semibold text-slate-900">Weather window</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Calm winds expected for the next 36 hours -- plan inverter restarts during this slot.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Alarm center</CardTitle>
          <CardDescription>Live feed from SCADA and device-level checks.</CardDescription>
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
      </Card>
    </div>
  );
};

export default SiteDetail;
