import { useMemo } from 'react';
import { AlarmClock, BellRing, CheckCircle, ShieldAlert } from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { DataTable } from '../components/data-table/data-table.jsx';

const alarmColumns = [
  {
    accessorKey: 'siteName',
    header: 'Site',
    meta: { label: 'Site' },
    cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.siteName}</span>
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
      <Badge variant={row.original.severity === 'Critical' ? 'destructive' : 'warning'}>
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
  }
];

const AlarmHub = () => {
  const { user, sites } = useDashboardStore((state) => ({
    user: state.user,
    sites: state.sites
  }));

  if (!user) return null;

  const accessibleSites = sites.filter((site) => user.accessibleSiteIds.includes(site.id));

  const alarms = useMemo(
    () =>
      accessibleSites
        .flatMap((site) =>
          site.alarms.map((alarm) => ({
            ...alarm,
            siteId: site.id,
            siteName: site.name
          }))
        )
        .sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt)),
    [accessibleSites]
  );

  const openAlarms = alarms.filter((alarm) => !alarm.resolvedAt);
  const resolvedToday = alarms.filter(
    (alarm) =>
      alarm.resolvedAt && new Date(alarm.resolvedAt).toDateString() === new Date().toDateString()
  );

  const criticalOpen = openAlarms.filter((alarm) => alarm.severity === 'Critical');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Alarm operations center</h1>
        <p className="text-sm text-muted-foreground">
          Fleet-wide alarm visibility with prioritised critical alerts.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-white/95 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open alarms</CardTitle>
            <BellRing className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{openAlarms.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {criticalOpen.length} critical / {openAlarms.length - criticalOpen.length} non-critical
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/95 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved today</CardTitle>
            <CheckCircle className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{resolvedToday.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Rolling counter resets at midnight.</p>
          </CardContent>
        </Card>
        <Card className="bg-white/95 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sites involved</CardTitle>
            <ShieldAlert className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {new Set(openAlarms.map((alarm) => alarm.siteId)).size}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Distinct locations impacted.</p>
          </CardContent>
        </Card>
        <Card className="bg-white/95 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acknowledged</CardTitle>
            <AlarmClock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {openAlarms.filter((alarm) => alarm.acknowledgedBy).length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Follow-up already in progress.</p>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Live alarm queue</CardTitle>
          <CardDescription>Time-ordered events, updates every 5 minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={alarmColumns}
            data={alarms}
            searchKey="siteName"
            initialPageSize={10}
            emptyState="All clear. No alarms reported in the selected fleet."
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AlarmHub;
