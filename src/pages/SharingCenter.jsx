import { useState } from 'react';
import { Share2, Users } from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Input } from '../components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '../components/ui/select.jsx';
import { Button } from '../components/ui/button.jsx';
import { DataTable } from '../components/data-table/data-table.jsx';

const allowedRoles = ['admin', 'member'];

const createCollaboratorColumns = (canManage, onRemove) => {
  const base = [
    {
      accessorKey: 'email',
      header: 'Email',
      meta: { label: 'Email' },
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.email}</span>
    },
    {
      accessorKey: 'role',
      header: 'Role',
      meta: { label: 'Role' }
    },
    {
      accessorKey: 'addedAt',
      header: 'Added',
      meta: { label: 'Added' }
    }
  ];

  if (canManage) {
    base.push({
      id: 'actions',
      header: 'Actions',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(row.original)}
          >
            Remove
          </Button>
        </div>
      )
    });
  }

  return base;
};

const SharingCenter = () => {
  const { user, sites, addSharedAccess, removeSharedAccess } = useDashboardStore((state) => ({
    user: state.user,
    sites: state.sites,
    addSharedAccess: state.addSharedAccess,
    removeSharedAccess: state.removeSharedAccess
  }));

  const [drafts, setDrafts] = useState({});

  if (!user) return null;

  const isMemberOnly = user.role === 'member';
  const manageableSites =
    user.role === 'owner'
      ? sites
      : sites.filter((site) => user.accessibleSiteIds.includes(site.id));

  const handleChange = (siteId, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [siteId]: {
        email: prev[siteId]?.email ?? '',
        role: prev[siteId]?.role ?? 'member',
        ...prev[siteId],
        [key]: value
      }
    }));
  };

  const handleInvite = (event, siteId) => {
    event.preventDefault();
    const { email = '', role = 'member' } = drafts[siteId] ?? {};
    if (!email || !allowedRoles.includes(role)) {
      return;
    }
    addSharedAccess(siteId, email.toLowerCase(), role);
    setDrafts((prev) => ({
      ...prev,
      [siteId]: { email: '', role }
    }));
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <Share2 className="h-6 w-6 text-primary" />
          Access control
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage who can view and operate on each solar site. Owners can invite anyone, admins are
          limited to sites they can already view.
        </p>
      </header>

      {isMemberOnly && (
        <Card className="border-amber-200/80 bg-amber-50/60">
          <CardHeader>
            <CardTitle>Read-only mode</CardTitle>
            <CardDescription>
              You are signed in as a member. Reach out to a site administrator for elevated access.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6">
        {manageableSites.map((site) => (
          <Card key={site.id} className="shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{site.name}</CardTitle>
                <CardDescription>{site.location}</CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-4 w-4 text-slate-400" />
                {site.sharedAccess.length} collaborator{site.sharedAccess.length === 1 ? '' : 's'}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isMemberOnly && (
                <form
                  className="grid gap-3 md:grid-cols-[2fr_minmax(140px,1fr)_auto]"
                  onSubmit={(event) => handleInvite(event, site.id)}
                >
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={drafts[site.id]?.email ?? ''}
                    onChange={(event) => handleChange(site.id, 'email', event.target.value)}
                    required
                  />
                  <Select
                    value={drafts[site.id]?.role ?? 'member'}
                    onValueChange={(value) => handleChange(site.id, 'role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Role</SelectLabel>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button type="submit">Share access</Button>
                </form>
              )}
              <DataTable
                columns={createCollaboratorColumns(!isMemberOnly, (entry) =>
                  removeSharedAccess(site.id, entry.email)
                )}
                data={site.sharedAccess}
                searchKey="email"
                initialPageSize={5}
                emptyState="No collaborators added yet."
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SharingCenter;
