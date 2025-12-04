import { create } from "zustand";
import { format } from "date-fns";

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
        `${
          import.meta.env.VITE_API_URL
        }/api/integrate/overview-data/v1?from=${formattedFrom}&to=${formattedTo}`
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "API error");

      set({ data: json.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));
