"use client";

import { useFleetOverviewStore } from "../store/useFleetOverviewStore";
import { Button } from "../components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";
import { CalendarIcon } from "lucide-react";
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <CalendarIcon size={16} />

          {range?.from && range?.to
            ? `${format(range.from, "dd-MM-yyyy")} → ${format(range.to, "dd-MM-yyyy")}`
            : "Select Range"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 bg-white">
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
  );
}
