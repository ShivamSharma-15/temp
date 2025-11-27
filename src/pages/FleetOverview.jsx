import { Activity, BatteryCharging, Gauge, ShieldAlert } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import { useDashboardStore } from '../store/dashboardStore.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { DataTable } from '../components/data-table/data-table.jsx';

const energyColumns = [
  {
    accessorKey: 'name',
    header: 'Site',
    meta: { label: 'Site' },
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>
  },
  {
    accessorKey: 'latestEnergy',
    header: 'Energy (MWh)',
    meta: { label: 'Energy (MWh)' },
    cell: ({ row }) => row.original.latestEnergy.toFixed(1)
  },
  {
    accessorKey: 'delta',
    header: 'Delta vs prev. day',
    meta: { label: 'Delta vs prev. day' },
    cell: ({ row }) => {
      const value = row.original.delta;
      const isPositive = value >= 0;
      return (
        <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
          {isPositive ? '+' : ''}
          {value.toFixed(1)}
        </span>
      );
    }
  }
];

const FleetOverview = () => {
  const { user, sites, selectedDate, fleetBenchmarks } = useDashboardStore((state) => ({
    user: state.user,
    sites: state.sites,
    selectedDate: state.selectedDate,
    fleetBenchmarks: state.fleetBenchmarks
  }));

  if (!user) {
    return null;
  }

  const accessibleSites = sites.filter((site) => user.accessibleSiteIds.includes(site.id));
  const windowSize = 7;

  const aggregateSeriesMap = new Map();

  accessibleSites.forEach((site) => {
    const slice = site.energySeries.slice(-windowSize);
    slice.forEach((entry) => {
      const bucket = aggregateSeriesMap.get(entry.date) ?? {
        date: entry.date,
        energyMWh: 0,
        irradianceWhm2: 0,
        samples: 0
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
      irradianceWhm2: entry.samples ? Math.round(entry.irradianceWhm2 / entry.samples) : 0
    }));

  const totalCapacityMw = accessibleSites.reduce((sum, site) => sum + site.capacityMw, 0);
  const totalEnergyMWh = aggregateSeries.reduce((sum, point) => sum + point.energyMWh, 0);
  const performanceRatio = accessibleSites.length
    ? accessibleSites.reduce((sum, site) => sum + site.performanceRatioPct, 0) /
      accessibleSites.length
    : 0;
  const openAlarms = accessibleSites.reduce(
    (sum, site) => sum + site.alarms.filter((alarm) => !alarm.resolvedAt).length,
    0
  );
  const onlineUnits = accessibleSites.reduce(
    (sum, site) => sum + site.units.filter((unit) => unit.status === 'Online').length,
    0
  );
  const offlineUnits = accessibleSites.reduce(
    (sum, site) => sum + site.units.filter((unit) => unit.status !== 'Online').length,
    0
  );

  const lastPoint = aggregateSeries.at(-1);
  const prevPoint = aggregateSeries.at(-2);
  const energyDelta = lastPoint && prevPoint ? lastPoint.energyMWh - prevPoint.energyMWh : 0;

  const leadingSite =
    accessibleSites.length > 0
      ? [...accessibleSites].sort((a, b) => b.performanceRatioPct - a.performanceRatioPct)[0]
      : null;

  const energyLeaders = accessibleSites
    .map((site) => ({
      id: site.id,
      name: site.name,
      latestEnergy: site.energySeries.at(-1)?.energyMWh ?? 0,
      delta:
        site.energySeries.length > 1
          ? site.energySeries.at(-1).energyMWh - site.energySeries.at(-2).energyMWh
          : 0
    }))
    .sort((a, b) => b.latestEnergy - a.latestEnergy)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active fleet capacity"
          value={`${totalCapacityMw.toFixed(1)} MW`}
          hint={`Benchmark: ${fleetBenchmarks.totalCapacityMw.toFixed(1)} MW portfolio`}
          icon={BatteryCharging}
        />
        <StatCard
          label="Energy delivered"
          value={`${Math.round(totalEnergyMWh)} MWh`}
          delta={{
            trend: energyDelta >= 0 ? 'positive' : 'negative',
            text: `${energyDelta >= 0 ? '+' : ''}${energyDelta.toFixed(1)} MWh day over day`
          }}
          hint={`Date: ${selectedDate}`}
          icon={Activity}
        />
        <StatCard
          label="Performance ratio"
          value={`${performanceRatio.toFixed(1)} %`}
          delta={{
            trend: performanceRatio >= fleetBenchmarks.averagePerformanceRatio ? 'positive' : 'negative',
            text: `Fleet avg ${fleetBenchmarks.averagePerformanceRatio} %`
          }}
          hint="Higher is better"
          icon={Gauge}
        />
        <StatCard
          label="System health"
          value={`${onlineUnits} online / ${offlineUnits} attention`}
          delta={{
            trend: openAlarms > 0 ? 'negative' : 'positive',
            text: `${openAlarms} open alarm${openAlarms === 1 ? '' : 's'}`
          }}
          hint="Monitoring inverters, meters, weather stations"
          icon={ShieldAlert}
        />
      </section>

      <section className="grid gap-6">
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
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>Operational highlights</CardTitle>
            <CardDescription>Auto-generated talking points from the latest refresh.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-sm text-slate-600">
              {leadingSite && (
                <li className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <p className="font-semibold text-slate-900">{leadingSite.name}</p>
                  <p className="mt-1">
                    Leading the pack at {leadingSite.performanceRatioPct.toFixed(1)} % performance
                    ratio thanks to consistent string alignment.
                  </p>
                </li>
              )}
              {openAlarms > 0 ? (
                <li className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
                  {openAlarms} alarm{openAlarms === 1 ? '' : 's'} still active. Prioritise inverter
                  restarts before the next irradiance peak.
                </li>
              ) : (
                <li className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4">
                  All monitored units are healthy. Keep the preventive maintenance cadence unchanged.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>Top energy contributors</CardTitle>
            <CardDescription>Latest production and shift against the prior day.</CardDescription>
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
  );
};

export default FleetOverview;
