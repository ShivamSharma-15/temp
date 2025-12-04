import { create } from "zustand";
import { format } from "date-fns";

const base_url = import.meta.env.VITE_API_URL;

export const useFleetOverviewStore = create((set) => ({
  loading: false,
  error: null,
  data: [],

  // Default Range - Filled later by component
  range: { from: null, to: null },

  setRange: (range) => set({ range }),

  fetchFleetData: async (from, to) => {
    if (!from || !to) return;
    set({ loading: true, error: null });

    try {
      const formattedFrom = Math.floor(from.getTime() / 1000);
      const formattedTo = Math.floor(to.getTime() / 1000);

      console.log(
        `${
          import.meta.env.VITE_API_URL
        }/api/overview-data/v1?from=${formattedFrom}&to=${formattedTo}`
      );

      const res = await fetch(
        `${base_url}/api/integrate/overview-data/v1?from=${formattedFrom}&to=${formattedTo}`
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "API error");

      set({ data: json.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  initializeDefaultRange: () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0,0,0,0);
  set({ range: { from: d, to: d } });
},
}));
