"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
  type PointerEvent,
} from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  X,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseSapDate } from "@/lib/sapParser";
import type {
  WorkbenchColumn,
  WorkbenchDebugResponse,
  WorkbenchPageInfo,
  WorkbenchRow,
} from "@/types/workbench";

type ResultsTableProps = {
  entityName: string;
  columns: WorkbenchColumn[];
  debugResponses: WorkbenchDebugResponse[];
  pageInfo: WorkbenchPageInfo;
  rows: WorkbenchRow[];
  onClose?: () => void;
  onPageChange?: (page: number) => void;
};

type HeaderDragState = {
  pointerId: number;
  startX: number;
  scrollLeft: number;
};

const estimatedResultRowHeight = 37;
const resultRowOverscan = 8;

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

function buildSheetRows(columns: WorkbenchColumn[], rows: WorkbenchRow[]) {
  return [
    columns.map((column) => column.label || column.fieldName),
    ...rows.map((row) =>
      columns.map((column) => formatCellValue(row[column.key])),
    ),
  ];
}

function buildFallbackColumns(rows: WorkbenchRow[]): WorkbenchColumn[] {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).map(
    (key, index) => ({
      key,
      fieldName: key,
      label: key,
      position: index + 1,
    }),
  );
}

export function ResultsTable({
  entityName,
  columns,
  debugResponses,
  pageInfo,
  rows,
  onClose,
  onPageChange,
}: ResultsTableProps) {
  const [searchText, setSearchText] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [selectedDebugIndex, setSelectedDebugIndex] = useState(0);
  const [isHeaderDragging, setIsHeaderDragging] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const headerDragRef = useRef<HeaderDragState | null>(null);
  const visibleColumns = useMemo(
    () => (columns.length > 0 ? columns : buildFallbackColumns(rows)),
    [columns, rows],
  );
  const visibleRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) =>
      visibleColumns.some((column) =>
        formatCellValue(row[column.key])
          .toLowerCase()
          .includes(normalizedSearch),
      ),
    );
  }, [rows, searchText, visibleColumns]);
  const currentPage = Math.max(0, pageInfo.page);
  const totalPages = Math.max(0, pageInfo.totalPages);
  const pageSize = Math.max(0, pageInfo.pageSize);
  const returnedRows = Math.max(rows.length, pageInfo.returnedRows);
  const totalRows = Math.max(rows.length, pageInfo.totalRows);
  const pageStart =
    currentPage > 0 && pageSize > 0 && returnedRows > 0
      ? (currentPage - 1) * pageSize + 1
      : rows.length > 0
        ? 1
        : 0;
  const pageEnd =
    pageStart > 0 ? pageStart + Math.max(visibleRows.length, returnedRows) - 1 : 0;
  const pageRows = visibleRows;
  const virtualStartIndex = Math.max(
    0,
    Math.floor(scrollTop / estimatedResultRowHeight) - resultRowOverscan,
  );
  const virtualEndIndex = Math.min(
    pageRows.length,
    Math.ceil((scrollTop + viewportHeight) / estimatedResultRowHeight) +
      resultRowOverscan,
  );
  const virtualRows = pageRows.slice(virtualStartIndex, virtualEndIndex);
  const topSpacerHeight = virtualStartIndex * estimatedResultRowHeight;
  const bottomSpacerHeight =
    (pageRows.length - virtualEndIndex) * estimatedResultRowHeight;
  const canGoPrevious = Boolean(onPageChange && currentPage > 1);
  const canGoNext = Boolean(
    onPageChange &&
      currentPage > 0 &&
      totalPages > 0 &&
      currentPage < totalPages,
  );
  const tableMinWidth = Math.max(visibleColumns.length * 168, 720);

  function handleSearchChange(value: string) {
    setSearchText(value);
    setScrollTop(0);
    tableScrollRef.current?.scrollTo({ top: 0 });
  }

  function handleTableScroll(event: UIEvent<HTMLDivElement>) {
    setScrollTop(event.currentTarget.scrollTop);
  }

  function handleHeaderPointerDown(
    event: PointerEvent<HTMLTableSectionElement>,
  ) {
    const scrollContainer = tableScrollRef.current;

    if (
      event.button !== 0 ||
      !scrollContainer ||
      scrollContainer.scrollWidth <= scrollContainer.clientWidth
    ) {
      return;
    }

    headerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: scrollContainer.scrollLeft,
    };
    setIsHeaderDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleHeaderPointerMove(
    event: PointerEvent<HTMLTableSectionElement>,
  ) {
    const scrollContainer = tableScrollRef.current;
    const dragState = headerDragRef.current;

    if (!scrollContainer || !dragState) {
      return;
    }

    scrollContainer.scrollLeft =
      dragState.scrollLeft - (event.clientX - dragState.startX);
    event.preventDefault();
  }

  function handleHeaderPointerEnd(
    event: PointerEvent<HTMLTableSectionElement>,
  ) {
    const dragState = headerDragRef.current;

    if (!dragState) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(dragState.pointerId)) {
      event.currentTarget.releasePointerCapture(dragState.pointerId);
    }

    headerDragRef.current = null;
    setIsHeaderDragging(false);
  }

  async function handleDownload({ format }: { format: "xlsx" | "csv" }) {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet(
      buildSheetRows(visibleColumns, visibleRows),
    );

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

  const selectedDebugResponse = debugResponses[selectedDebugIndex];

  useEffect(() => {
    const scrollContainer = tableScrollRef.current;

    if (!scrollContainer) {
      return;
    }

    function updateViewportHeight() {
      setViewportHeight(scrollContainer?.clientHeight ?? 480);
    }

    updateViewportHeight();

    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(scrollContainer);

    return () => resizeObserver.disconnect();
  }, [visibleRows.length]);

  return (
    <Card className="fiori-surface h-full min-h-0 gap-0 py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base text-foreground">Results</CardTitle>
            <CardDescription className="text-xs">
              {entityName} | Page {currentPage || "-"} of {totalPages || "-"} |{" "}
              {returnedRows} of {totalRows} rows
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={debugResponses.length === 0}
              onClick={() => {
                setSelectedDebugIndex(0);
                setDebugOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <FileJson className="size-4" />
              SAP responses
            </button>
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
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-transparent p-2 text-muted-foreground transition hover:border-border hover:bg-accent hover:text-primary"
                aria-label="Hide Results"
                title="Hide Results"
              >
                <X className="size-4" />
              </button>
            ) : null}
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
          <div
            ref={tableScrollRef}
            className="h-full min-w-0 overflow-auto bg-white"
            onScroll={handleTableScroll}
          >
            <table
              className="w-full table-fixed caption-bottom text-sm"
              style={{ minWidth: `${tableMinWidth}px` }}
            >
              <TableHeader
                className={
                  isHeaderDragging
                    ? "cursor-grabbing select-none"
                    : "cursor-grab select-none"
                }
                onPointerDown={handleHeaderPointerDown}
                onPointerMove={handleHeaderPointerMove}
                onPointerUp={handleHeaderPointerEnd}
                onPointerCancel={handleHeaderPointerEnd}
              >
                <TableRow className="border-border hover:bg-transparent">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className="sticky top-0 w-[168px] border-b border-border bg-accent px-3 py-2 text-xs font-semibold text-primary"
                      title={[
                        column.fieldName,
                        column.abapType,
                        column.length ? `Length ${column.length}` : undefined,
                        column.decimals
                          ? `Decimals ${column.decimals}`
                          : undefined,
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    >
                      {column.label || column.fieldName}
                      {column.isKey ? (
                        <span className="ml-2 rounded border border-border px-1 text-[10px] font-medium">
                          KEY
                        </span>
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSpacerHeight > 0 ? (
                  <TableRow aria-hidden="true" className="border-0">
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="p-0"
                      style={{ height: `${topSpacerHeight}px` }}
                    />
                  </TableRow>
                ) : null}
                {virtualRows.map((row, rowIndex) => (
                  <TableRow
                    key={`${entityName}-${currentPage}-${virtualStartIndex + rowIndex}`}
                    className="border-border hover:bg-accent/40"
                  >
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        className="w-[168px] truncate px-3 py-2 text-foreground"
                        title={formatCellValue(row[column.key])}
                      >
                        {formatCellValue(row[column.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {bottomSpacerHeight > 0 ? (
                  <TableRow aria-hidden="true" className="border-0">
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="p-0"
                      style={{ height: `${bottomSpacerHeight}px` }}
                    />
                  </TableRow>
                ) : null}
              </TableBody>
            </table>
          </div>
        )}
      </CardContent>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>
          {visibleRows.length === 0
            ? "No rows"
            : searchText.trim()
              ? `Filtered ${visibleRows.length} of ${rows.length} rows on page ${currentPage || "-"}`
              : `Showing ${pageStart}-${pageEnd} of ${totalRows} rows`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs">
            Page {currentPage || "-"} of {totalPages || "-"} | Page size{" "}
            {pageSize || "-"}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => onPageChange?.(1)}
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => onPageChange?.(currentPage - 1)}
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => onPageChange?.(currentPage + 1)}
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => onPageChange?.(totalPages)}
              className="rounded-md border border-border bg-white p-1.5 text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {debugOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-border bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <div className="text-base font-semibold text-foreground">
                  SAP column and chunk responses
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Raw response.text() captured by the FE through /api/sap.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDebugOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-primary hover:bg-accent"
              >
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
              <div className="min-h-0 border-b border-border p-3 md:border-r md:border-b-0">
                <div className="space-y-2">
                  {debugResponses.map((response, index) => (
                    <button
                      key={`${response.label}-${index}`}
                      type="button"
                      onClick={() => setSelectedDebugIndex(index)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                        index === selectedDebugIndex
                          ? "border-primary bg-accent text-primary"
                          : "border-border bg-white text-foreground hover:bg-accent"
                      }`}
                    >
                      <div className="font-medium">{response.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {response.summary}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 space-y-3 overflow-auto p-4">
                {selectedDebugResponse ? (
                  <>
                    <div className="grid gap-2 text-sm md:grid-cols-5">
                      <div className="rounded-md border border-border bg-accent p-3">
                        <div className="text-xs text-muted-foreground">
                          HTTP
                        </div>
                        <div className="font-medium">
                          {selectedDebugResponse.status}
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-accent p-3">
                        <div className="text-xs text-muted-foreground">
                          Browser Content-Length
                        </div>
                        <div className="font-medium">
                          {selectedDebugResponse.contentLength || "-"}
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-accent p-3">
                        <div className="text-xs text-muted-foreground">
                          SAP Content-Length
                        </div>
                        <div className="font-medium">
                          {selectedDebugResponse.upstreamContentLength || "-"}
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-accent p-3">
                        <div className="text-xs text-muted-foreground">
                          Received
                        </div>
                        <div className="font-medium">
                          {selectedDebugResponse.receivedBytes} bytes /{" "}
                          {selectedDebugResponse.receivedChars} chars
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-accent p-3">
                        <div className="text-xs text-muted-foreground">
                          Proxy bytes
                        </div>
                        <div className="font-medium">
                          {selectedDebugResponse.proxyBytes || "-"}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <div className="rounded-md border border-border bg-accent p-3">
                        <div className="text-xs text-muted-foreground">
                          Summary
                        </div>
                        <div className="font-medium">
                          {selectedDebugResponse.summary}
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-accent p-3">
                        <div className="text-xs text-muted-foreground">
                          SAP Content-Type
                        </div>
                        <div className="font-medium">
                          {selectedDebugResponse.upstreamContentType || "-"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-accent p-3 font-mono text-xs text-muted-foreground">
                      {selectedDebugResponse.path}
                    </div>

                    <textarea
                      readOnly
                      value={selectedDebugResponse.body}
                      className="h-[52vh] w-full resize-none rounded-md border border-border bg-white p-3 font-mono text-xs text-foreground outline-none"
                    />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
