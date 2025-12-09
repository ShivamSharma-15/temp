"use client";

import { useEffect, useState } from "react";
import { format, parse, isSameDay } from "date-fns";

import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";
import { CalendarIcon, File } from "lucide-react";

import { Card, CardContent, CardTitle } from "./ui/card.jsx";
import { DataTable } from "../components/data-table/data-table.jsx";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog.jsx";

import { useFleetOverviewStore } from "../store/useFleetOverviewStore";

export default function FleetOverview() {
  const {
    loading,
    data,
    error,
    range,
    setRange,
    fetchFleetData
  } = useFleetOverviewStore();

  useEffect(() => {
  if (!range || !range.from || !range.to) {
const d = new Date();
d.setDate(d.getDate() - 1);        // go to yesterday
d.setHours(0, 0, 0, 0);

    setRange({ from: d, to: d });
    fetchFleetData(d, d);
  }
}, [])

  // Auto-load data on first mount (today)
  useEffect(() => {

    if (!range || !range.from || !range.to) {
  // no API call if user has not selected both dates
  return;
}
    if (!range.from || !range.to) {
      const today = new Date();
      setRange({ from: today, to: today });
      fetchFleetData(today, today);
    }
  }, [range]);

  // When user selects range
  const handleRangeChange = (value) => {
    setRange(value);
    if (value?.from && value?.to) {
      fetchFleetData(value.from, value.to);
    }
  };

  const [modalData, setModalData] = useState(null);
const [open, setOpen] = useState(false);

const openModal = (payload) => {
  setModalData(payload);
  setOpen(true);
};

  const siteMessages = {
  Abhaneri: "1 Inverter not connected",

  Asadi: `1 Inverter not connected
Meter not connected`,

  Meenapada: "1 Inverter not connected",

  Khorandi: "Meter not connected",
};


  // ----------------------
  // SUM for Cards
  // ----------------------
// First, sum the raw values
const totals = data.reduce(
  (acc, item) => {
    const site = item.site_data;
    acc.generation += Number(site.generation) || 0;
    acc.netExport += Number(site.netExport) || 0;
    acc.siteCapacity += Number(site.site_capacity) || 0;
    acc.totalDays = range && Math.floor((new Date(range.to) - new Date(range.from)) / (1000 * 60 * 60 * 24)) + 1;; // count number of sites / days
    return acc;
  },
  {
    generation: 0,
    netExport: 0,
    siteCapacity: 0,
    totalDays: 0
  }
);

// Then calculate percentages using formulas
const cufGen = totals.totalDays
  ? ((totals.generation / (totals.siteCapacity * 24 * totals.totalDays)) * 100)
  : 0;

  console.log(totals);
  

const cufExport = totals.totalDays
  ? ((totals.netExport / (totals.siteCapacity * 24 * totals.totalDays)) * 100)
  : 0;

const tlLoss = totals.generation
  ? (((totals.generation - totals.netExport) / totals.generation) * 100)
  : 0;

// Round to 2 decimals if needed
const formattedTotals = {
  ...totals,
  cufGen: cufGen.toFixed(2),
  cufExport: cufExport.toFixed(2),
  tlLoss: tlLoss.toFixed(2)
};

  // ----------------------
  // Table Columns
  // ----------------------
const columns = [
  {
    accessorKey: "name",
    header: "Project",
    cell: (info) => info.getValue() ?? "-", // fallback
  },
  {
    accessorKey: "site_capacity",
    header: "Capacity (kWp)",
    cell: (info) => info.getValue() ?? "-",
  },
  {
    accessorKey: "generation",
    header: "Generation (kWh)",
    cell: (info) => info.getValue() ?? "-",
  },
  {
    accessorKey: "netExport",
    header: "Net Export (kWh)",
    cell: (info) => info.getValue() ?? "-",
  },
  {
    accessorKey: "cufGen",
    header: "CUF Gen (%)",
    cell: (info) => info.getValue() ? `${info.getValue()} %` : "-",
  },
  {
    accessorKey: "cufExport",
    header: "CUF Export (%)",
    cell: (info) => info.getValue() ? `${info.getValue()} %` : "-",
  },
  {
    accessorKey: "tlLoss",
    header: "TL Loss (%)",
    cell: (info) => info.getValue() ? `${info.getValue()} %` : "-",
  },
{
  accessorKey: "action",
  header: "",
  cell: ({ row }) => {
    const siteName = row.original.name; // adjust to your field
    const message = siteMessages[siteName];

    return (
      <button
        onClick={() => {
          if (message) {
           openModal({ siteName, message });
          }
        }}
        className={`text-xs`}
        disabled={!message}
      >
        {message ? <File size={16} color="red" /> : "-"}
      </button>
    );
  },
}


];


  const tableRows = data.map((item) => item.site_data);

  return (
    <div className="space-y-10">

      {/* Date Picker */}
      {/* <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <CalendarIcon size={16} />
            {range?.from && range?.to
              ? `${format(range?.from, "dd-MM-yyyy")} → ${format(range?.to, "dd-MM-yyyy")}`
              : "Select Range"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 bg-white">
          <Calendar mode="range" selected={range} onSelect={handleRangeChange}  disabled={(date) => date > new Date(new Date().setDate(new Date().getDate() - 1))} />
        </PopoverContent>
      </Popover> */}

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 -mb-6">
        <Card className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer"><CardContent className="p-3 text-center">
          <CardTitle className="text-[14px]">Total Capacity</CardTitle>
          <p className="mt-1 text-[14px]">{(formattedTotals.siteCapacity.toFixed(2))} kWp</p>
        </CardContent></Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer"><CardContent className="p-3 text-center">
          <CardTitle className="text-[14px]">Generation</CardTitle>
          <p className="mt-1 text-[14px]">{formattedTotals.generation.toFixed(2)} kWh</p>
        </CardContent></Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer"><CardContent className="p-3 text-center">
          <CardTitle className="text-[14px]">Net Export</CardTitle>
          <p className="mt-1 text-[14px]">{formattedTotals.netExport.toFixed(2)} kWh</p>
        </CardContent></Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer"><CardContent className="p-3 text-center">
          <CardTitle className="text-[14px]">CUF (Gen)</CardTitle>
          <p className="mt-1 text-[14px]">{formattedTotals.cufGen}%</p>
        </CardContent></Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer"><CardContent className="p-3 text-center">
          <CardTitle className="text-[14px]">CUF (Export)</CardTitle>
          <p className="mt-1 text-[14px]">{formattedTotals.cufExport}%</p>
        </CardContent></Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer"><CardContent className="p-3 text-center">
          <CardTitle className="text-[14px]">TL Loss</CardTitle>
          <p className="mt-1 text-[14px]">{formattedTotals.tlLoss}%</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={tableRows} searchKey="name" />

      <Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{modalData?.siteName} - Status</DialogTitle>
    </DialogHeader>

    <pre className="whitespace-pre-wrap text-sm">
      {modalData?.message}
    </pre>
  </DialogContent>
</Dialog>

    </div>
  );
}
