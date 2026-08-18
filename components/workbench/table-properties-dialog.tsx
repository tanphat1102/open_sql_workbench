"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Info,
  Maximize2,
  Minimize2,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sqlAssistService } from "@/services/sqlAssistService";
import type { SapSqlwbField } from "@/types/sap";

type TablePropertiesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  entityType?: string;
  entityDescription?: string;
  onPreviewFields?: (fieldNames: string[]) => void;
  selectionMode?: boolean;
  extraFields?: SapSqlwbField[];
};

function normalizeNumber(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value: string | boolean | undefined) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["X", "TRUE", "1", "YES"].includes(value.toUpperCase());
  }
  return false;
}

const ORIGIN_BADGE_CLASS: Record<string, string> = {
  DIRECT: "border-border text-muted-foreground",
  INCLUDE: "border-blue-300 text-blue-700 bg-blue-50",
  APPEND: "border-amber-300 text-amber-700 bg-amber-50",
  CALCULATED: "border-purple-300 text-purple-700 bg-purple-50",
};

type SortKey = "position" | "name" | "type";

type FieldGroup = {
  key: string;
  label: string;
  originType: string;
  depth: number;
  fields: SapSqlwbField[];
  startPosition: number;
};

function matchesSearch(field: SapSqlwbField, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [field.FieldName, field.JsonKey, field.Element, field.Label].some(
    (v) => v?.toLowerCase().includes(q),
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  position: "Position",
  name: "Name",
  type: "Type",
};

const SKELETON_COLUMNS = 10;

/* Highlight match helper */
function highlightMatch(text: string, query: string) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);

  return (
    <>
      {before}
      <mark className="bg-amber-100 text-amber-900 rounded-sm px-px">
        {match}
      </mark>
      {after}
    </>
  );
}

/* Main Dialog Component */
export function TablePropertiesDialog({
  open,
  onOpenChange,
  entityName,
  entityType = "TABLE",
  entityDescription,
  onPreviewFields,
  selectionMode,
  extraFields,
}: TablePropertiesDialogProps) {
  const [fields, setFields] = useState<SapSqlwbField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!open || !entityName) return;

    let isMounted = true;

    async function loadFields() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await sqlAssistService.getFields(entityName);
        if (isMounted) {
          const combined =
            extraFields && extraFields.length > 0
              ? (() => {
                  const existing = new Set(
                    result.map((f) =>
                      (f.FieldName ?? f.JsonKey ?? "").toUpperCase(),
                    ),
                  );
                  const extras = extraFields.filter(
                    (ef) =>
                      !existing.has(
                        (ef.FieldName ?? ef.JsonKey ?? "").toUpperCase(),
                      ),
                  );
                  return [...extras, ...result];
                })()
              : result;
          setFields(combined);
          setSelectedFields(new Set());
          setCollapsedGroups(new Set());
          setSearchQuery("");
          setSortKey("position");
          setSortDir("asc");
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load field metadata for this table.",
          );
          setFields(extraFields || []);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadFields();
    return () => {
      isMounted = false;
    };
  }, [open, entityName, extraFields]);

  /* Tách direct fields và groups, sắp xếp theo tầng */
  const { directFields, groups } = useMemo(() => {
    let filtered = fields;
    if (searchQuery) {
      filtered = fields.filter((f) => matchesSearch(f, searchQuery));
    }

    const direct: SapSqlwbField[] = [];
    const groupMap = new Map<string, FieldGroup>();

    filtered.forEach((f, idx) => {
      const originType = f.OriginType || "DIRECT";
      const originStructure = f.OriginStructure || "";
      const depth = normalizeNumber(f.IncludeDepth, 0);

      if (
        originType === "DIRECT" ||
        originType === "CALCULATED" ||
        !originStructure
      ) {
        direct.push(f);
      } else {
        const groupKey = `__struct__${originStructure}__${depth}`;
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            key: groupKey,
            label: originStructure,
            originType,
            depth,
            fields: [],
            startPosition: normalizeNumber(f.Position, idx),
          });
        }
        const group = groupMap.get(groupKey)!;
        group.fields.push(f);
        group.startPosition = Math.min(
          group.startPosition,
          normalizeNumber(f.Position, idx),
        );
      }
    });

    const sortFn = (a: SapSqlwbField, b: SapSqlwbField) => {
      let cmp = 0;
      if (sortKey === "position") {
        cmp = normalizeNumber(a.Position, 0) - normalizeNumber(b.Position, 0);
      } else if (sortKey === "name") {
        cmp = (a.FieldName ?? "").localeCompare(b.FieldName ?? "");
      } else if (sortKey === "type") {
        cmp = (a.AbapType ?? "").localeCompare(b.AbapType ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    };

    direct.sort(sortFn);

    const groupsArr = Array.from(groupMap.values());
    if (sortKey === "position") {
      groupsArr.sort((a, b) => a.startPosition - b.startPosition);
    } else if (sortKey === "name") {
      groupsArr.sort((a, b) => a.label.localeCompare(b.label));
    }

    groupsArr.forEach((group) => {
      group.fields.sort(sortFn);
    });

    return { directFields: direct, groups: groupsArr };
  }, [fields, searchQuery, sortKey, sortDir]);

  const isSearching = searchQuery.length > 0;
  const totalFields = fields.length;
  const keyFieldCount = fields.filter((f) => normalizeBoolean(f.IsKey)).length;
  const selectedCount = selectedFields.size;

  const visibleFieldNames = useMemo(() => {
    const names: string[] = [];
    directFields.forEach((f) => {
      if (f.FieldName) names.push(f.FieldName);
    });
    groups.forEach((group) => {
      if (!collapsedGroups.has(group.key)) {
        group.fields.forEach((f) => {
          if (f.FieldName) names.push(f.FieldName);
        });
      }
    });
    return new Set(names);
  }, [directFields, groups, collapsedGroups]);

  const allFieldNames = useMemo(
    () => new Set(fields.map((f) => f.FieldName ?? "")),
    [fields],
  );

  const allSelected =
    visibleFieldNames.size > 0 &&
    [...visibleFieldNames].every((n) => selectedFields.has(n));
  const someSelected = [...visibleFieldNames].some((n) =>
    selectedFields.has(n),
  );

  function toggleSelectAll() {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleFieldNames.forEach((n) => next.delete(n));
      } else {
        visibleFieldNames.forEach((n) => next.add(n));
      }
      return next;
    });
  }

  function toggleField(fieldName: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) next.delete(fieldName);
      else next.add(fieldName);
      return next;
    });
  }

  function toggleGroupCollapse(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function handlePreviewSelected() {
    const names = [...selectedFields].filter((n) => allFieldNames.has(n));
    if (names.length > 0) {
      onPreviewFields?.(names);
      toast({
        title: "Fields applied",
        description: `Applied ${names.length} selected field${names.length > 1 ? "s" : ""} from "${entityName}".`,
      });
      if (!selectionMode) {
        onOpenChange(false);
      }
    }
  }

  return (
    <TooltipProvider delayDuration={400}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0 transition-all duration-200",
            isFullscreen
              ? "h-[95vh] w-[95vw] max-w-none"
              : "max-h-[85vh] max-w-5xl",
          )}
          showCloseButton={false}
        >
          {/* Header */}
          <DialogHeader className="border-b border-border bg-[#f7fbff] px-5 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                  <Info className="size-4 text-primary" />
                  <span className="truncate">{entityName}</span>
                  <Badge
                    variant="outline"
                    className="border-[#b8d6ef] text-primary"
                  >
                    {entityType}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  {entityDescription || `Field schema for ${entityName}`}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsFullscreen((v) => !v)}
                      className="rounded-md border border-border bg-white p-2 text-primary transition hover:bg-accent"
                      aria-label={
                        isFullscreen ? "Exit fullscreen" : "Open fullscreen"
                      }
                    >
                      {isFullscreen ? (
                        <Minimize2 className="size-4" />
                      ) : (
                        <Maximize2 className="size-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFullscreen ? "Exit fullscreen" : "Open fullscreen preview"}
                  </TooltipContent>
                </Tooltip>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="border-border text-muted-foreground hover:text-foreground"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogHeader>

        {/* Loading state */}
        {isLoading ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[800px]">
              <TableHeader>
                <TableRow className="border-b border-border bg-accent">
                  {Array.from({ length: SKELETON_COLUMNS }).map((_, j) => (
                    <TableHead
                      key={j}
                      className="h-8 text-xs font-semibold text-foreground bg-accent"
                    >
                      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-transparent">
                    {Array.from({ length: SKELETON_COLUMNS }).map((_, j) => (
                      <TableCell key={j} className="py-1.5">
                        <div
                          className="h-3 animate-pulse rounded bg-accent"
                          style={{
                            width: `${j === 0 ? 20 : j === 1 ? 24 : 50 + Math.floor(Math.random() * 80)}px`,
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-md text-center">
              {error}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : fields.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <div className="text-sm">
              No field metadata available for {entityName}.
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2">
              <div className="relative flex-1 min-w-[160px] max-w-[260px]">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search fields..."
                  className="h-7 w-full rounded border border-border bg-white pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                {(["position", "name", "type"] as SortKey[]).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={sortKey === key ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => {
                      if (sortKey === key) {
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      } else {
                        setSortKey(key);
                        setSortDir("asc");
                      }
                    }}
                  >
                    {SORT_LABELS[key]}
                    {sortKey === key ? (
                      <ArrowUpDown
                        className={`ml-1 size-3 ${sortDir === "desc" ? "rotate-180" : ""}`}
                      />
                    ) : null}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                >
                  <div
                    className={`flex size-3.5 items-center justify-center rounded-sm border ${
                      someSelected && !allSelected
                        ? "border-primary bg-primary/20"
                        : allSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                    }`}
                  >
                    {allSelected ? (
                      <Check className="size-2.5 text-primary-foreground" />
                    ) : null}
                  </div>
                  {allSelected ? "Clear all" : "Select all"}
                </button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={selectedCount === 0}
                  onClick={handlePreviewSelected}
                >
                  <Eye className="size-3" />
                  {selectionMode ? "Apply" : "Preview"} ({selectedCount})
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[800px]">
                <TableHeader>
                  <TableRow className="border-b border-border bg-accent sticky top-0 z-10">
                    <TableHead className="h-8 w-10 bg-accent" />
                    <TableHead className="h-8 w-14 text-xs font-semibold text-foreground bg-accent">
                      Pos
                    </TableHead>
                    <TableHead className="h-8 text-xs font-semibold text-foreground bg-accent">
                      Field Name
                    </TableHead>
                    <TableHead className="h-8 w-20 text-xs font-semibold text-foreground bg-accent">
                      Type
                    </TableHead>
                    <TableHead className="h-8 w-14 text-right text-xs font-semibold text-foreground bg-accent">
                      Len
                    </TableHead>
                    <TableHead className="h-8 w-14 text-right text-xs font-semibold text-foreground bg-accent">
                      Dec
                    </TableHead>
                    <TableHead className="h-8 w-14 text-center text-xs font-semibold text-foreground bg-accent">
                      Key
                    </TableHead>
                    <TableHead className="h-8 w-22 text-xs font-semibold text-foreground bg-accent">
                      Origin
                    </TableHead>
                    <TableHead className="h-8 text-xs font-semibold text-foreground bg-accent">
                      Label
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* DIRECT và CALCULATED fields */}
                  {directFields.map((field, idx) => {
                    const fieldName = field.FieldName ?? "";
                    const isKey = normalizeBoolean(field.IsKey);
                    const position = normalizeNumber(field.Position, idx);
                    const length = normalizeNumber(field.Length);
                    const decimals = normalizeNumber(field.Decimals);
                    const originType = field.OriginType || "DIRECT";
                    const originBadge =
                      ORIGIN_BADGE_CLASS[originType] ??
                      ORIGIN_BADGE_CLASS.DIRECT;
                    const isSelected = selectedFields.has(fieldName);

                    return (
                      <TableRow
                        key={`direct-${fieldName}-${position}`}
                        className={
                          isKey
                            ? "border-b border-border bg-accent/30 hover:bg-accent/50"
                            : "border-b border-transparent hover:bg-accent/40"
                        }
                      >
                        <TableCell
                          className="py-1.5 cursor-pointer"
                          onClick={() => fieldName && toggleField(fieldName)}
                        >
                          <div
                            className={`flex size-3.5 items-center justify-center rounded-sm border ${
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/40"
                            }`}
                          >
                            {isSelected && (
                              <Check className="size-2.5 text-primary-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 pr-0 text-xs tabular-nums text-muted-foreground">
                          {position}
                        </TableCell>
                        <TableCell className="py-1.5 font-medium text-xs text-foreground">
                          {searchQuery
                            ? highlightMatch(fieldName || "-", searchQuery)
                            : fieldName || "-"}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-xs text-foreground">
                          {field.AbapType || "-"}
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                          {length > 0 ? length : "-"}
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                          {decimals > 0 ? decimals : "-"}
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          {isKey && (
                            <Badge
                              variant="outline"
                              className="border-primary px-1.5 py-px text-[10px] text-primary"
                            >
                              KEY
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-px text-[10px] ${originBadge}`}
                          >
                            {originType}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="py-1.5 text-xs text-muted-foreground max-w-[160px] truncate"
                          title={field.Label}
                        >
                          {searchQuery && field.Label
                            ? highlightMatch(field.Label, searchQuery)
                            : field.Label || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Groups (INCLUDE / APPEND) */}
                  {groups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.key);

                    return (
                      <Fragment key={group.key}>
                        {/* Group header */}
                        <TableRow
                          className="border-b border-border bg-accent/20 hover:bg-accent/40 cursor-pointer"
                          onClick={() => toggleGroupCollapse(group.key)}
                        >
                          <TableCell className="py-1.5 pl-2">
                            {isCollapsed ? (
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="size-3.5 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell
                            className="py-1.5 text-xs text-muted-foreground"
                            colSpan={8}
                          >
                            <span className="font-semibold text-foreground">
                              {group.label}
                            </span>
                            <Badge
                              variant="outline"
                              className={`ml-2 px-1.5 py-px text-[10px] ${
                                ORIGIN_BADGE_CLASS[group.originType] ??
                                ORIGIN_BADGE_CLASS.DIRECT
                              }`}
                            >
                              {group.originType}
                            </Badge>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {group.fields.length} field
                              {group.fields.length !== 1 ? "s" : ""}
                            </span>
                          </TableCell>
                        </TableRow>

                        {/* Group fields (collapsed/expanded) */}
                        {!isCollapsed &&
                          group.fields.map((field, idx) => {
                            const fieldName = field.FieldName ?? "";
                            const isKey = normalizeBoolean(field.IsKey);
                            const position = normalizeNumber(
                              field.Position,
                              idx,
                            );
                            const length = normalizeNumber(field.Length);
                            const decimals = normalizeNumber(field.Decimals);
                            const originType = field.OriginType || "DIRECT";
                            const originBadge =
                              ORIGIN_BADGE_CLASS[originType] ??
                              ORIGIN_BADGE_CLASS.DIRECT;
                            const isSelected = selectedFields.has(fieldName);
                            const indent = group.depth;

                            return (
                              <TableRow
                                key={`group-field-${fieldName}-${position}`}
                                className={
                                  isKey
                                    ? "border-b border-border bg-accent/30 hover:bg-accent/50"
                                    : "border-b border-transparent hover:bg-accent/40"
                                }
                              >
                                <TableCell
                                  className="py-1.5 cursor-pointer"
                                  style={{
                                    paddingLeft: `${8 + indent * 16}px`,
                                  }}
                                  onClick={() =>
                                    fieldName && toggleField(fieldName)
                                  }
                                >
                                  <div
                                    className={`flex size-3.5 items-center justify-center rounded-sm border ${
                                      isSelected
                                        ? "border-primary bg-primary"
                                        : "border-muted-foreground/40"
                                    }`}
                                  >
                                    {isSelected && (
                                      <Check className="size-2.5 text-primary-foreground" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5 pr-0 text-xs tabular-nums text-muted-foreground">
                                  {position}
                                </TableCell>
                                <TableCell className="py-1.5 font-medium text-xs text-foreground">
                                  {searchQuery
                                    ? highlightMatch(
                                        fieldName || "-",
                                        searchQuery,
                                      )
                                    : fieldName || "-"}
                                </TableCell>
                                <TableCell className="py-1.5 font-mono text-xs text-foreground">
                                  {field.AbapType || "-"}
                                </TableCell>
                                <TableCell className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                                  {length > 0 ? length : "-"}
                                </TableCell>
                                <TableCell className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                                  {decimals > 0 ? decimals : "-"}
                                </TableCell>
                                <TableCell className="py-1.5 text-center">
                                  {isKey && (
                                    <Badge
                                      variant="outline"
                                      className="border-primary px-1.5 py-px text-[10px] text-primary"
                                    >
                                      KEY
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Badge
                                    variant="outline"
                                    className={`px-1.5 py-px text-[10px] ${originBadge}`}
                                  >
                                    {originType}
                                  </Badge>
                                </TableCell>
                                <TableCell
                                  className="py-1.5 text-xs text-muted-foreground max-w-[160px] truncate"
                                  title={field.Label}
                                >
                                  {searchQuery && field.Label
                                    ? highlightMatch(field.Label, searchQuery)
                                    : field.Label || "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </Fragment>
                    );
                  })}

                  {directFields.length === 0 && groups.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No fields match search &quot;{searchQuery}&quot;.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        {fields.length > 0 && !isLoading ? (
          <div className="flex items-center justify-between border-t border-border bg-[#f7fbff] px-5 py-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">
                  {isSearching
                    ? directFields.length +
                      groups.reduce((sum, g) => sum + g.fields.length, 0)
                    : totalFields}
                </span>
                {isSearching ? (
                  <>
                    {" "}
                    of{" "}
                    <span className="font-semibold text-foreground">
                      {totalFields}
                    </span>
                  </>
                ) : null}{" "}
                field{totalFields !== 1 ? "s" : ""}
              </span>
              {!isSearching && keyFieldCount > 0 ? (
                <span>
                  <span className="font-semibold text-foreground">
                    {keyFieldCount}
                  </span>{" "}
                  key field{keyFieldCount !== 1 ? "s" : ""}
                </span>
              ) : null}
              {selectedCount > 0 ? (
                <span className="text-primary">
                  <span className="font-semibold">{selectedCount}</span>{" "}
                  selected
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-border"
            >
              Close
            </Button>
          </div>
        ) : null}
      </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
