import { create } from 'zustand';
import {
  seedUsers,
  seedSites,
  fleetBenchmarks,
  AVAILABLE_INTRADAY_DATES,
  DEFAULT_SELECTED_DATE,
  EARLIEST_INTRADAY_DATE,
  HARD_MAX_DATE
} from '../data/seed.js';

const getDefaultUser = () => null;

const clampDate = (value) => {
  const iso = (value ?? '').toString().slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return DEFAULT_SELECTED_DATE;
  const min = AVAILABLE_INTRADAY_DATES[0] ?? EARLIEST_INTRADAY_DATE ?? DEFAULT_SELECTED_DATE;
  const max = HARD_MAX_DATE;
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
};

const pickAvailableDate = (targetDate, availableDates = []) => {
  const dates = Array.isArray(availableDates) && availableDates.length ? [...availableDates] : [];
  const desired = clampDate(targetDate);
  if (!dates.length) return desired;
  dates.sort();
  const eligible = dates.filter((date) => date <= desired);
  if (eligible.length) return eligible.at(-1);
  return dates[0];
};

const applySelectedDateToSites = (sites, targetDate) => {
  const nextDate = clampDate(targetDate);
  return sites.map((site) => {
    if (!site.intradayByDate) return site;
    const selected = pickAvailableDate(nextDate, site.availableIntradayDates);
    return {
      ...site,
      selectedIntradayDate: selected,
      lastDayData: site.intradayByDate[selected] ?? []
    };
  });
};

const initialSelectedDate = pickAvailableDate(DEFAULT_SELECTED_DATE, AVAILABLE_INTRADAY_DATES);
const initialSites = applySelectedDateToSites(seedSites, initialSelectedDate);

export const useDashboardStore = create((set, get) => ({
  users: seedUsers,
  sites: initialSites,
  fleetBenchmarks,
  user: getDefaultUser(),
  activeSiteId: null,
  selectedDate: initialSelectedDate,
  dateBounds: {
    min: AVAILABLE_INTRADAY_DATES[0] ?? initialSelectedDate,
    max: HARD_MAX_DATE
  },

  login: (userId) => {
    const found = seedUsers.find((user) => user.id === userId);
    set({
      user: found ?? seedUsers[0],
      activeSiteId: found?.accessibleSiteIds?.[0] ?? seedUsers[0].accessibleSiteIds[0]
    });
  },

  logout: () => set({ user: null, activeSiteId: null }),

  setActiveSiteId: (siteId) => set({ activeSiteId: siteId }),

  setSelectedDate: (value) =>
    set((state) => {
      const selectedDate = pickAvailableDate(value, AVAILABLE_INTRADAY_DATES);
      return {
        selectedDate,
        sites: applySelectedDateToSites(state.sites, selectedDate)
      };
    }),

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
