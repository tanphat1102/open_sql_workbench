"use client";

import { useMemo, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
} from "lucide-react";

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

function buildFileName(entityName: string, suffix: string) {
  const safeEntityName = entityName.replace(/[^a-z0-9_-]+/gi, "_");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return `${safeEntityName || "results"}-${timestamp}.${suffix}`;
}

function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildSheetRows(columns: string[], rows: WorkbenchRow[]) {
  return [
    columns,
    ...rows.map((row) => columns.map((column) => formatCellValue(row[column]))),
  ];
}

export function ResultsTable({ entityName, rows }: ResultsTableProps) {
  const [searchText, setSearchText] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const columns = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))),
    [rows],
  );
  const visibleRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) =>
      columns.some((column) =>
        formatCellValue(row[column]).toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [columns, rows, searchText]);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = currentPageIndex * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, visibleRows.length);
  const pageRows = visibleRows.slice(pageStart, pageEnd);
  const canGoPrevious = currentPageIndex > 0;
  const canGoNext = currentPageIndex < pageCount - 1;

  function handleSearchChange(value: string) {
    setSearchText(value);
    setPageIndex(0);
  }

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setPageIndex(0);
  }

  async function handleDownload({ format }: { format: "xlsx" | "csv" }) {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet(buildSheetRows(columns, visibleRows));

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
      XLSX.writeFile(workbook, buildFileName(entityName, "xlsx"), {
        compression: true,
      });
      setDownloadOpen(false);
      return;
    }

    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const content = `\uFEFFsep=,\r\n${csv}`;
    const fileName = buildFileName(entityName, "csv");

    downloadTextFile(fileName, content);
    setDownloadOpen(false);
  }

  return (
    <Card className="fiori-surface min-h-0 gap-0 py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base text-foreground">Results</CardTitle>
            <CardDescription className="text-xs">
              {entityName} | {visibleRows.length} of {rows.length} rows
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
              value={searchText}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
            <div className="relative">
              <button
                type="button"
                disabled={visibleRows.length === 0}
                onClick={() => setDownloadOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <Download className="size-4" />
                Download
              </button>
              {downloadOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-border bg-white p-1 shadow-md">
                  <button
                    type="button"
                    onClick={() => void handleDownload({ format: "xlsx" })}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition hover:bg-accent"
                  >
                    <FileSpreadsheet className="size-4 text-primary" />
                    Excel workbook
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload({ format: "csv" })}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition hover:bg-accent"
                  >
                    <Download className="size-4 text-primary" />
                    CSV
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-0">
        {visibleRows.length === 0 ? (
          <div className="m-3 rounded-lg border border-dashed border-[#b8d6ef] bg-accent p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No rows loaded yet. Run a query or switch to another entity."
              : "No rows match the current search."}
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
                {pageRows.map((row, rowIndex) => (
                  <TableRow
                    key={`${entityName}-${pageStart + rowIndex}`}
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
      <div className="flex flex-col gap-2 border-t border-border px-3 py-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>
          {visibleRows.length === 0
            ? "No rows"
            : `Showing ${pageStart + 1}-${pageEnd} of ${visibleRows.length} rows`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs" htmlFor="result-page-size">
            Rows per page
          </label>
          <select
            id="result-page-size"
            value={pageSize}
            onChange={(event) => handlePageSizeChange(event.target.value)}
            className="h-8 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <div className="text-xs">
            Page {currentPageIndex + 1} of {pageCount}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setPageIndex(0)}
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() =>
                setPageIndex((current) => Math.min(pageCount - 1, current + 1))
              }
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPageIndex(pageCount - 1)}
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
