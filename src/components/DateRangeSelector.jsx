import { Calendar } from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore.js';

const DateRangeSelector = () => {
  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const setSelectedDate = useDashboardStore((state) => state.setSelectedDate);
  const bounds = useDashboardStore((state) => state.dateBounds);

  return (
    <label className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-2 text-xs shadow-sm">
      <Calendar className="h-4 w-4 text-primary" />
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-slate-500">Select date</span>
        <input
          type="date"
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={selectedDate}
          min={bounds?.min}
          max={bounds?.max}
          onChange={(event) => setSelectedDate(event.target.value)}
        />
        <span className="text-[10px] text-muted-foreground">
          Allowed: {bounds?.min} → {bounds?.max}
        </span>
      </div>
    </label>
  );
};

export default DateRangeSelector;
