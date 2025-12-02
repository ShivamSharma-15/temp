"use client";

import { useState, useMemo } from "react";
import { format, parse, isSameDay } from "date-fns";

import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";
import { CalendarIcon } from "lucide-react";

import { DataTable } from "../components/data-table/data-table.jsx";

// JSON data
import AsadiRaw from "../projects/Asadi.json";
import JOD01Raw from "../projects/JOD01.json";

const sheets = {
  Asadi: AsadiRaw,
  JOD01: JOD01Raw,
};

const parseDate = (str) => parse(str, "dd-MM-yyyy", new Date());

export default function HomeDataTable() {
  const [selectedSheet, setSelectedSheet] = useState("JOD01");
  const [range, setRange] = useState({ from: undefined, to: undefined });

  const data = sheets[selectedSheet];

  const availableDates = useMemo(() => data.map((row) => parseDate(row.Date)), [data]);

  const isDisabled = (date) => !availableDates.some((d) => isSameDay(d, date));

  const filteredData = useMemo(() => {
    if (!range?.from || !range?.to) return data;
    return data.filter((row) => {
      const d = parseDate(row.Date);
      return d >= range.from && d <= range.to;
    });
  }, [range, data]);

  const columns = useMemo(
    () => [
      { accessorKey: "Date", header: "Date" },
      { accessorKey: "Total Generation", header: "Generation (kWh)" },
      { accessorKey: "CUF (%)", header: "CUF (%)" },
      { accessorKey: "Main Net Export  (KWH)", header: "Net Export (KWH)" },
      { accessorKey: "Site Capacity", header: "Site Capacity (kwp)" },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Sheet Selector */}
      <div className="flex gap-4 items-center">
        <label className="font-medium">Select Sheet:</label>
        <select
          className="border px-3 py-2 rounded-md"
          value={selectedSheet}
          onChange={(e) => {
            setSelectedSheet(e.target.value);
            setRange({ from: undefined, to: undefined });
          }}
        >
          <option value="Asadi">Asadi</option>
          <option value="JOD01">JOD01</option>
        </select>
      </div>

      {/* Date Range Picker */}
      <div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <CalendarIcon size={16} />
              {range?.from && range?.to
                ? `${format(range.from, "dd-MM-yyyy")} → ${format(range.to, "dd-MM-yyyy")}`
                : "Select Date Range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-white">
            <Calendar mode="range" selected={range} onSelect={setRange} disabled={isDisabled} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Data Table */}
      <DataTable columns={columns} data={filteredData} searchKey="Date" emptyState="No data for selected range" />
    </div>
  );
}
