import { create } from 'zustand';
import { seedUsers, seedSites, fleetBenchmarks } from '../data/seed.js';

const getDefaultUser = () => null;

export const useDashboardStore = create((set, get) => ({
  users: seedUsers,
  sites: seedSites,
  fleetBenchmarks,
  user: getDefaultUser(),
  activeSiteId: null,
  dateRange: '7d',

  login: (userId) => {
    const found = seedUsers.find((user) => user.id === userId);
    set({
      user: found ?? seedUsers[0],
      activeSiteId: found?.accessibleSiteIds?.[0] ?? seedUsers[0].accessibleSiteIds[0]
    });
  },

  logout: () => set({ user: null, activeSiteId: null }),

  setActiveSiteId: (siteId) => set({ activeSiteId: siteId }),

  setDateRange: (range) => set({ dateRange: range }),

  acknowledgeAlarm: (siteId, alarmId, acknowledgedBy) =>
    set((state) => ({
      sites: state.sites.map((site) => {
        if (site.id !== siteId) return site;
        return {
          ...site,
          alarms: site.alarms.map((alarm) =>
            alarm.id === alarmId && !alarm.acknowledgedBy
              ? { ...alarm, acknowledgedBy, resolvedAt: alarm.resolvedAt ?? null }
              : alarm
          )
        };
      })
    })),

  resolveAlarm: (siteId, alarmId, resolvedAt) =>
    set((state) => ({
      sites: state.sites.map((site) => {
        if (site.id !== siteId) return site;
        return {
          ...site,
          alarms: site.alarms.map((alarm) =>
            alarm.id === alarmId ? { ...alarm, resolvedAt } : alarm
          )
        };
      })
    })),

  addSharedAccess: (siteId, email, role) =>
    set((state) => ({
      sites: state.sites.map((site) => {
        if (site.id !== siteId) return site;
        const filtered = site.sharedAccess.filter(
          (entry) => entry.email.toLowerCase() !== email.toLowerCase()
        );
        return {
          ...site,
          sharedAccess: [
            ...filtered,
            {
              email,
              role,
              addedAt: new Date().toISOString().slice(0, 10)
            }
          ]
        };
      })
    })),

  removeSharedAccess: (siteId, email) =>
    set((state) => ({
      sites: state.sites.map((site) =>
        site.id === siteId
          ? {
              ...site,
              sharedAccess: site.sharedAccess.filter(
                (entry) => entry.email.toLowerCase() !== email.toLowerCase()
              )
            }
          : site
      )
    }))
}));

export const selectAccessibleSites = (state) =>
  state.user ? state.sites.filter((site) => state.user.accessibleSiteIds.includes(site.id)) : [];

export const selectSiteById = (siteId) => (state) =>
  state.sites.find((site) => site.id === siteId) ?? null;
