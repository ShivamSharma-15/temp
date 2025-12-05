"use client";

import { useFleetOverviewStore } from "../store/useFleetOverviewStore";
import { Button } from "../components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";

export default function HeaderDatePicker() {
  const { range, setRange, fetchFleetData, initializeDefaultRange } =
    useFleetOverviewStore();

  // Load yesterday on first mount
  useEffect(() => {
    if (!range) {
      initializeDefaultRange();
    }
  }, []);

  const handleSelect = (value) => {
    setRange(value);
    if (value?.from && value?.to) fetchFleetData(value.from, value.to);
  };

  const YESTERDAY = new Date(new Date().setDate(new Date().getDate() - 1));

const shiftRange = (days) => {
  if (!range?.from || !range?.to) return;

  const newFrom = new Date(range.from);
  const newTo = new Date(range.to);

  newFrom.setDate(newFrom.getDate() + days);
  newTo.setDate(newTo.getDate() + days);

  // prevent going beyond yesterday
  if (newTo > YESTERDAY) return;

  const newRange = { from: newFrom, to: newTo };
  setRange(newRange);

  fetchFleetData(newFrom, newTo);
};

const handleLeft = () => {
  shiftRange(-1);
};

const handleRight = () => {
  shiftRange(1);
};



  return (
    <div className="flex gap-2 justify-center">
      {/* LEFT ARROW */}
 <ChevronLeft
        className="h-10 w-10 p-2 rounded border cursor-pointer text-slate-600 hover:text-primary"
        onClick={handleLeft}
      />
    <Popover>
      <PopoverTrigger asChild>


 <Button variant="outline" className="flex items-center w-56 gap-2">
  <CalendarIcon size={16} />

  {range?.from && range?.to
    ? `${format(range.from, "dd-MM-yyyy")} → ${format(range.to, "dd-MM-yyyy")}`
    : "Select Range"}
</Button>

      </PopoverTrigger>

      <PopoverContent className="p-0 bg-white w-auto">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          disabled={(date) =>
            date > new Date(new Date().setDate(new Date().getDate() - 1))
          }
        />
      </PopoverContent>
    </Popover>
      {/* RIGHT ARROW */}
    <ChevronRight
        className={`h-10 w-10 p-2 rounded border cursor-pointer text-slate-600 hover:text-primary ${
      range?.to > YESTERDAY ? "opacity-30 pointer-events-none" : ""
    }`}
        onClick={handleRight}
      />

</div>
  );
}
