import { NavLink } from 'react-router-dom';
import {
  ActivitySquare,
  BellRing,
  ChevronRight,
  Shield,
  SunMedium
} from 'lucide-react';
import { useMemo } from 'react';
import { useDashboardStore } from '../store/dashboardStore.js';
import { cn } from '../lib/utils.js';
import { ScrollArea } from './ui/scroll-area.jsx';
import { Badge } from './ui/badge.jsx';

const navItems = [
  { label: 'Fleet overview', to: '/app', icon: ActivitySquare, exact: true },
  { label: 'Alarm hub', to: '/app/alarms', icon: BellRing },
  { label: 'Access control', to: '/app/access', icon: Shield, roles: ['owner', 'admin'] }
];

const statusVariants = {
  Online: 'success',
  Healthy: 'success',
  Warning: 'warning',
  Offline: 'destructive'
};

const SidebarLink = ({ icon: Icon, children, ...props }) => (
  <NavLink
    {...props}
    className={({ isActive }) =>
      cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900',
        isActive && 'bg-primary/10 text-primary'
      )
    }
  >
    {Icon && <Icon className="h-4 w-4 shrink-0" />}
    <span className="flex-1">{children}</span>
    <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
  </NavLink>
);

const Sidebar = () => {
  const { user, sites } = useDashboardStore((state) => ({
    user: state.user,
    sites: state.sites
  }));

  const accessibleSites = useMemo(() => {
    if (!user) return [];
    return sites
      .filter((site) => user.accessibleSiteIds.includes(site.id));
  }, [sites, user]);

  if (!user) return null;

  return (
    <aside className="hidden w-72 border-r border-slate-200/80 bg-gradient-to-b from-white/80 via-white/70 to-slate-50/50 px-5 py-6 lg:flex lg:flex-col">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-2 text-primary">
          <SunMedium className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">Solar Fleet</p>
          <p className="text-xs text-muted-foreground">Operations studio</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems
          .filter((item) => !item.roles || item.roles.includes(user.role))
          .map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              end={item.exact}
              icon={item.icon}
            >
              {item.label}
            </SidebarLink>
          ))}
      </nav>

      <div className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Assigned sites
      </div>
      <ScrollArea className="mt-3 h-full pr-2">
        <div className="space-y-1.5">
          {accessibleSites.map((site) => (
            <NavLink
              key={site.id}
              to={`/app/sites/${site.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-sm transition hover:border-slate-200 hover:bg-white',
                  isActive && 'border-primary/40 bg-primary/5 text-primary'
                )
              }
            >
              <div>
                <div className="font-medium">{site.name}</div>
                <div className="text-xs text-muted-foreground">{site.location}</div>
              </div>
              <Badge className="hidden" variant={statusVariants[site.status] ?? 'secondary'}>{site.status}</Badge>
            </NavLink>
          ))}
          {accessibleSites.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-muted-foreground">
              No sites assigned yet.
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
};

export default Sidebar;
