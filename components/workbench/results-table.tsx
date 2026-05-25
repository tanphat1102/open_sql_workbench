"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseSapDate } from "@/lib/sapParser";
import type { WorkbenchRow } from "@/types/workbench";

type ResultsTableProps = {
  entityName: string;
  rows: WorkbenchRow[];
};

function formatCellValue(value: WorkbenchRow[string]) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    const parsedDate = parseSapDate(value);

    if (parsedDate) {
      return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsedDate);
    }
  }

  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function ResultsTable({ entityName, rows }: ResultsTableProps) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <Card className="border-sky-100 bg-white shadow-[0_18px_50px_rgba(15,90,170,0.08)] backdrop-blur">
      <CardHeader className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">
              Result Grid
            </CardTitle>
            <CardDescription className="text-slate-600">
              Latest rows for {entityName}. Use the toolbar to export or search.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search"
              className="rounded-lg border border-sky-100 px-3 py-2 text-sm text-slate-700"
              onChange={() => {}}
            />
            <div className="relative">
              <button className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm text-sky-700">
                Tải xuống
              </button>
              <div className="absolute right-0 mt-10 hidden w-40 rounded-md border bg-white shadow-md">
                <button className="w-full px-3 py-2 text-left text-sm">
                  Excel (csv)
                </button>
                <button className="w-full px-3 py-2 text-left text-sm">
                  CSV (csv)
                </button>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-8 text-center text-sm text-slate-600">
            No rows loaded yet. Run a query or switch to another entity.
          </div>
        ) : (
          <ScrollArea className="h-90 rounded-2xl border border-sky-100 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-sky-100 hover:bg-transparent">
                  {columns.map((column) => (
                    <TableHead
                      key={column}
                      className="border-b border-sky-100 px-4 py-3 text-xs uppercase tracking-[0.2em] text-sky-700/80"
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIndex) => (
                  <TableRow
                    key={`${entityName}-${rowIndex}`}
                    className="border-sky-100"
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column}
                        className="px-4 py-3 text-slate-700"
                      >
                        {formatCellValue(row[column])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
