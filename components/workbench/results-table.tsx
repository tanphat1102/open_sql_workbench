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
    <Card className="fiori-surface min-h-0 gap-0 py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base text-foreground">Results</CardTitle>
            <CardDescription className="text-xs">
              {entityName} | {rows.length} rows
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
              onChange={() => {}}
            />
            <div className="relative">
              <button className="rounded-md border border-border bg-white px-3 py-2 text-sm text-primary transition hover:bg-accent">
                Download
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

      <CardContent className="min-h-0 flex-1 p-0">
        {rows.length === 0 ? (
          <div className="m-3 rounded-lg border border-dashed border-[#b8d6ef] bg-accent p-8 text-center text-sm text-muted-foreground">
            No rows loaded yet. Run a query or switch to another entity.
          </div>
        ) : (
          <ScrollArea className="h-full bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {columns.map((column) => (
                    <TableHead
                      key={column}
                      className="sticky top-0 border-b border-border bg-accent px-3 py-2 text-xs font-semibold text-primary"
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
                    className="border-border hover:bg-accent/40"
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column}
                        className="px-3 py-2 text-foreground"
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
