"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table.jsx";

import { DataTableToolbar } from "./data-table-toolbar.jsx";
import { DataTablePagination } from "./data-table-pagination.jsx";
import { ChevronUp, ChevronDown } from "lucide-react";

export const DataTable = ({
  columns,
  data,
  searchKey,
  initialPageSize = 10,
  toolbarSlot,
  emptyState = "No records found.",
  defaultSort = null, // ← NEW PROP
}) => {
  // 👉 DEFAULT SORT: Descending on 'Date' IF available
  const hasDateColumn = columns.some((col) => col.accessorKey === "Date" || col.id === "Date");

const [sorting, setSorting] = useState(() => {
  if (defaultSort) {
    return [
      {
        id: defaultSort.id,
        desc: defaultSort.desc ?? false,
      },
    ];
  }

  // automatic: if a Date column exists, sort by Date DESC
  const dateColumn = columns.find(
    (c) =>
      ["date", "created_at", "createdAt"].includes(
        (c.accessorKey || c.id)?.toLowerCase()
      )
  );

  return dateColumn
    ? [{ id: dateColumn.accessorKey || dateColumn.id, desc: true }]
    : [];
});

  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-3">
      <DataTableToolbar table={table} searchKey={searchKey}>
        {toolbarSlot}
      </DataTableToolbar>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSorted = header.column.getIsSorted(); // asc, desc, false

                  return (
                    <TableHead
                      key={header.id}
                      className="cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}

                        {isSorted === "asc" && <ChevronUp size={14} />}
                        {isSorted === "desc" && <ChevronDown size={14} />}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
<TableCell key={cell.id}>
  {(() => {
    const rendered = flexRender(cell.column.columnDef.cell, cell.getContext());
    return rendered ?? "-"; // fallback if null/undefined
  })()}
</TableCell>

                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
};
