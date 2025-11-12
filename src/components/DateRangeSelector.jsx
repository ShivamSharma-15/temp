import { Calendar } from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore.js';
import { Button } from './ui/button.jsx';
import { cn } from '../lib/utils.js';

const ranges = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' }
];

const DateRangeSelector = () => {
  const dateRange = useDashboardStore((state) => state.dateRange);
  const setDateRange = useDashboardStore((state) => state.setDateRange);

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-2 py-1 text-xs shadow-sm">
      <Calendar className="h-3.5 w-3.5 text-primary" />
      {ranges.map((range) => (
        <Button
          key={range.value}
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            'h-7 rounded-full px-3 text-xs font-semibold text-slate-500 hover:text-slate-900',
            dateRange === range.value && 'bg-primary text-white hover:bg-primary'
          )}
          onClick={() => setDateRange(range.value)}
        >
          {range.label}
        </Button>
      ))}
    </div>
  );
};

export default DateRangeSelector;
