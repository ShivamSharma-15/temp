"use client";

import { useState, useMemo, useEffect } from "react";
import { format, parse, isSameDay } from "date-fns";

import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";
import { CalendarIcon } from "lucide-react";

import { DataTable } from "../components/data-table/data-table.jsx";

import AsadiRaw from "../projects/Asadi.json";
import JOD01Raw from "../projects/JOD01.json";

import { Card, CardContent, CardTitle } from "./ui/card.jsx";

// ------------------------------------
// MERGE BY DATE
// ------------------------------------
const mergeByDate = (arr1, arr2) => {
  const map = {};

  const addToMap = (item) => {
    const date = item.Date;

    if (!map[date]) {
      map[date] = { ...item };
    } else {
      Object.keys(item).forEach((key) => {
        if (key === "Date") return;

        const val = item[key];
        if (typeof val === "number") {
          map[date][key] = (map[date][key] || 0) + val;
        }
      });
    }
  };

  arr1.forEach(addToMap);
  arr2.forEach(addToMap);

  return Object.values(map);
};

// ------------------------------------
// TOTALS FOR ANY DATASET
// ------------------------------------
const calculateTotals = (data) => {
  const totals = {};

  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key === "Date") return;

      if (typeof row[key] === "number") {
        totals[key] = (totals[key] || 0) + row[key];
      }
    });
  });

  return totals;
};

const combinedData = mergeByDate(AsadiRaw, JOD01Raw);

const parseDate = (str) => parse(str, "dd-MM-yyyy", new Date());

const allDates = combinedData
  .map((row) => parseDate(row.Date))
  .sort((a, b) => b - a); // descending

const latestDate = allDates[0];

export default function TotalDataTable() {
  const [range, setRange] = useState({ from: undefined, to: undefined });

  const sheets = {
    Asadi: AsadiRaw,
    JOD01: JOD01Raw
  };

  useEffect(() => {
  if (!range.from && !range.to && latestDate) {
    setRange({
      from: latestDate,
      to: latestDate
    });
  }
}, [latestDate]);

  // ------------------------------------
  // Filter data for current sheet
  // ------------------------------------
  const filterByRange = (data) => {
    if (!range?.from || !range?.to) return data;
    return data.filter((row) => {
      const d = parseDate(row.Date);
      return d >= range.from && d <= range.to;
    });
  };

  const filteredCombined = filterByRange(combinedData);

  const totals = calculateTotals(filteredCombined);
  const totalDays = filteredCombined.length;
  const siteCapacity = 6660.68;

  const cuf = totalDays
    ? ((totals["Total Generation"] / (siteCapacity * 24 * totalDays)) * 100).toFixed(2)
    : "0.00";

  const cufne = totalDays
    ? ((totals["Main Net Export  (KWH)"] / (siteCapacity * 24 * totalDays)) * 100).toFixed(2)
    : "0.00";

      const tll = totalDays
    ? (((totals["Total Generation"] - totals["Main Net Export  (KWH)"]) / totals["Total Generation"] ) * 100).toFixed(2)
    : "0.00";

  // ------------------------------------
  // Comparison Table Data
  // ------------------------------------
  const comparisonRows = useMemo(() => {
    return Object.entries(sheets).map(([name, rawSheet]) => {
      const filtered = filterByRange(rawSheet);
      const totals = calculateTotals(filtered);
      const days = filtered.length;

      const capacity = name === "Combined" ? 6660.68 : rawSheet[0]?.["Site Capacity"] || 0;

      const cufLocal =
        days && capacity
          ? ((totals["Total Generation"] / (capacity * 24 * days)) * 100).toFixed(2)
          : "0.00";

const cufneLocal =
      days && capacity
        ? ((totals["Main Net Export  (KWH)"] / (capacity * 24 * days)) * 100).toFixed(2)
        : "0.00";

    // TLL per site
    const tllLocal =
      totals["Total Generation"]
        ? (
            ((totals["Total Generation"] - totals["Main Net Export  (KWH)"]) /
              totals["Total Generation"]) *
            100
          ).toFixed(2)
        : "0.00";

      return {
        Project: name,
        Generation: totals["Total Generation"] || 0,
        CUF: cufLocal,
        CUFNE: cufneLocal,
        TLL: tllLocal,
        NetExport: totals["Main Net Export  (KWH)"] || 0,
        SiteCapacity: capacity,
      };
    });
  }, [range]);

const comparisonColumns = [
  { accessorKey: "Project", header: "Project" },
  {
    accessorKey: "SiteCapacity",
    header: "Site Capacity (kWp)",
    cell: ({ row }) =>
      row.original.SiteCapacity
        ? Number(row.original.SiteCapacity).toFixed(2)
        : row.original.SiteCapacity,
  },
  {
    accessorKey: "Generation",
    header: "Generation (kWh)",
    cell: ({ row }) => Number(row.original.Generation || 0).toFixed(2),
  },

    {
    accessorKey: "NetExport",
    header: "Net Export (KWH)",
    cell: ({ row }) => Number(row.original.NetExport || 0).toFixed(2),
  },

  {
    accessorKey: "CUF",
    header: "CUF (Generation) (%)",
    cell: ({ row }) => `${Number(row.original.CUF || 0).toFixed(2)} %`,
  },

    {
    accessorKey: "CUF Export",
    header: "CUF (Export) (%)",
    cell: ({ row }) => `${Number(row.original.CUFNE || 0).toFixed(2)} %`,
  },

    {
    accessorKey: "TL Loss",
    header: "TL Losses (%)",
    cell: ({ row }) => `${Number(row.original.TLL || 0).toFixed(2)} %`,
  },

];


  // ------------------------------------
  // Table Columns
  // ------------------------------------
  const mainTableColumns = [
    { accessorKey: "Date", header: "Date" },
    { accessorKey: "Total Generation", header: "Generation (kWh)" },
    { accessorKey: "CUF (%)", header: "CUF (%)" },
    { accessorKey: "Main Net Export  (KWH)", header: "Net Export (KWH)" },
    { accessorKey: "Site Capacity", header: "Site Capacity (kwp)" },
  ];

  // disabled calendar dates
  const availableDates = combinedData.map((row) => parseDate(row.Date));
  const isDisabled = (date) => !availableDates.some((d) => isSameDay(d, date));

  return (
    <div className="space-y-10">

      {/* Date Picker */}
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

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <CardTitle className="text-[14px]">Site Capacity</CardTitle>
            <p className="mt-3 font-[12px]">{siteCapacity} kWp</p>
          </CardContent>
        </Card>

                <Card>
          <CardContent className="p-6 text-center">
            <CardTitle className="text-[14px]">Generation</CardTitle>
            <p className="mt-3 text-[14px]">{(totals["Total Generation"]).toFixed(2) || 0} kWh</p>
          </CardContent>
        </Card>

                <Card>
          <CardContent className="p-6 text-center">
            <CardTitle className="text-[14px]">Net Export </CardTitle>
            <p className="mt-3 text-[14px]">{totals["Main Net Export  (KWH)"] || 0} kWh</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <CardTitle className="text-[14px]">CUF (Generation)</CardTitle>
            <p className="mt-3 text-[14px]">{cuf} %</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <CardTitle className="text-[14px]">CUF (Export)</CardTitle>
            <p className="mt-3 text-[14px]">{cufne} %</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <CardTitle className="text-[14px]">TL Losses </CardTitle>
            <p className="mt-3 text-[14px]">{tll} %</p>
          </CardContent>
        </Card>
        
      </div>

      {/* Main Table */}
      {/* <DataTable
        columns={mainTableColumns}
        data={filteredCombined}
        searchKey="Date"
        emptyState="No data for selected range"
      /> */}

      {/* Comparison Table */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Comparison</h2>

        <DataTable
          columns={comparisonColumns}
          data={comparisonRows}
          searchKey="Project"
        />
      </div>
    </div>
  );
}
