import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { CalendarRange, LayoutPanelLeft } from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore.js';
import DateRangeSelector from './DateRangeSelector.jsx';
import { Avatar, AvatarFallback } from './ui/avatar.jsx';
import { Button } from './ui/button.jsx';
import { useLocation } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from './ui/select.jsx';
import HeaderDatePicker from './HeaderDatePicker.jsx';

const navRoutes = [
  { label: 'Fleet', to: '/app', exact: true },
  { label: 'Alarms', to: '/app/alarms' },
  { label: 'Access', to: '/app/access', roles: ['owner', 'admin'] }
];

const roleLabels = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member'
};

const TopBar = () => {
  const user = useDashboardStore((state) => state.user);
  const sites = useDashboardStore((state) => state.sites);
  const logout = useDashboardStore((state) => state.logout);
  const [sitePickerValue, setSitePickerValue] = useState('');
  const navigate = useNavigate();

  const accessibleSites = useMemo(() => {
    if (!user) return [];
    return sites
      .filter((site) => user.accessibleSiteIds.includes(site.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, user]);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const handleSiteChange = (value) => {
    setSitePickerValue(value);
    if (value) {
      navigate(`/app/sites/${value}`);
      setTimeout(() => setSitePickerValue(''), 200);
    }
  };

  
  const location = useLocation();
  const showDateRange = location.pathname !== '/app'

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            {/* <p className="text-xs font-semibold uppercase tracking-wide text-primary">Solar Fleet</p> */}
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <CalendarRange className="h-4 w-4 text-primary" />
              Monitoring insights & live health
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {showDateRange && <>  <DateRangeSelector /> 
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 shadow-sm">
              <Avatar className="h-10 w-10 border border-slate-200">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold leading-tight text-slate-900">{user.name}</p>
                <p className="text-xs text-muted-foreground">{roleLabels[user.role] ?? user.role}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>
                Switch persona
              </Button>
            </div></>
}

{!showDateRange && <HeaderDatePicker/>}
          </div>
        </div>
{showDateRange && 
        <div className="flex flex-col gap-3 md:flex-row lg:items-center md:justify-between">
          <nav className="flex flex-wrap gap-2 lg:gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground lg:hidden">
              <LayoutPanelLeft className="h-3.5 w-3.5" />
              Navigate
            </div>
            {navRoutes
              .filter((route) => !route.roles || route.roles.includes(user.role))
              .map((route) => (
                <NavLink
                  key={route.to}
                  to={route.to}
                  end={route.exact}
                  className={({ isActive }) =>
                    [
                      'rounded-full border px-4 py-1.5 text-sm font-semibold transition',
                      isActive
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                    ].join(' ')
                  }
                >
                  {route.label}
                </NavLink>
              ))}
          </nav>
          {accessibleSites.length > 0 && (
            <div className="w-full max-w-xs">
              <Select value={sitePickerValue || undefined} onValueChange={handleSiteChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Jump to a site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Sites</SelectLabel>
                    {accessibleSites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
}
      </div>
    </header>
  );
};

export default TopBar;
