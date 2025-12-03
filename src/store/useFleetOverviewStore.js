import { create } from "zustand";
import { format } from "date-fns";

export const useFleetOverviewStore = create((set) => ({
  loading: false,
  error: null,
  data: [
      {
        site_id: "id123",
        site_data: {
          name: "Site A",
          site_capacity: 5375,
          generation: 14676.3,
          netExport: 1200,
          cufGen: 12,
          cufExport: 11,
          tlLoss: 9
        }
      },
      {
        site_id: "id124",
        site_data: {
          name: "Site B",
          site_capacity: 3000,
          generation: 9940,
          netExport: 680,
          cufGen: 10,
          cufExport: 9,
          tlLoss: 8
        }
      }
    ],

  // Default Range - Filled later by component
  range: { from: null, to: null },

  setRange: (range) => set({ range }),

  fetchFleetData: async (from, to) => {
    if (!from || !to) return;
    set({ loading: true, error: null });

    try {
      const formattedFrom = Math.floor(from.getTime() / 1000);;
      const formattedTo = Math.floor(to.getTime() / 1000);;
      

      console.log(`${import.meta.env.VITE_API_URL}/api/overview-data/v1?from=${formattedFrom}&to=${formattedTo}`);


      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/overview-data/v1?from=${formattedFrom}&to=${formattedTo}`
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "API error");

      set({ data: json.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));
