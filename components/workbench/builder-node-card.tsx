"use client";

import { type PointerEvent as ReactPointerEvent } from "react";
import {
  GripVertical,
  LoaderCircle,
  Search,
  Table2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SapSqlwbField } from "@/types/sap";
import type { WorkbenchEntity } from "@/types/workbench";
import type { BuilderNode } from "@/types/builder";

function normalizeFieldName(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function parseFields(value: string) {
  return value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

function getFieldName(field: SapSqlwbField) {
  return normalizeFieldName(field.FieldName ?? field.JsonKey);
}

function isKeyField(field: SapSqlwbField) {
  const value = field.IsKey;

  return (
    value === true ||
    String(value).toUpperCase() === "X" ||
    String(value).toLowerCase() === "true"
  );
}

function getEntityLabel(entityName: string, entities: WorkbenchEntity[]) {
  return (
    entities.find((entity) => entity.name === entityName)?.description ?? ""
  );
}

interface BuilderNodeCardProps {
  node: BuilderNode;
  allNodes: BuilderNode[];
  nodeFields: SapSqlwbField[];
  loading: boolean;
  entities: WorkbenchEntity[];
  isDragging: boolean;
  hasHaving?: boolean;
  onUpdate: (patch: Partial<BuilderNode>) => void;
  onRemove: () => void;
  onToggleField: (fieldName: string) => void;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragEnd: (event: ReactPointerEvent<HTMLElement>) => void;
  onOpenFieldPicker: (callback: (fieldNames: string[]) => void) => void;
}

const nodeWidth = 220;

export function BuilderNodeCard({
  node,
  allNodes,
  nodeFields,
  loading,
  entities,
  isDragging,
  hasHaving = false,
  onUpdate,
  onRemove,
  onToggleField,
  onDragStart,
  onDragMove,
  onDragEnd,
  onOpenFieldPicker,
}: BuilderNodeCardProps) {
  const selectedFields = new Set(
    parseFields(node.fields).map((field) => normalizeFieldName(field)),
  );
  const normalizedAlias = node.alias.trim().toLowerCase();
  const aliasIsInvalid =
    !normalizedAlias ||
    allNodes.some(
      (item) =>
        item.id !== node.id &&
        item.alias.trim().toLowerCase() === normalizedAlias,
    );

  const nodeFieldsList = parseFields(node.fields);
  const hasAggInSelect = nodeFieldsList.some((f) => f.includes("("));
  const nonAggSelectFields = nodeFieldsList.filter(
    (f) => !f.includes("(") && f.trim() !== "*",
  );

  const isGroupModeActive = hasAggInSelect || hasHaving;

  const validManualGroupBy = node.groupBy.filter(
    (f) =>
      !f.trim() ||
      nonAggSelectFields.some(
        (sf) => normalizeFieldName(sf) === normalizeFieldName(f),
      ) ||
      nodeFields.some(
        (nf) => normalizeFieldName(getFieldName(nf)) === normalizeFieldName(f),
      ),
  );

  const effectiveGroupByItems = isGroupModeActive
    ? Array.from(
        new Set([
          ...validManualGroupBy,
          ...nonAggSelectFields,
        ]),
      )
    : validManualGroupBy;

  const groupByItems = effectiveGroupByItems;

  const updateGroupBy = (newItems: string[]) => {
    const manualItems = newItems.filter(
      (item) => !item.trim() || !nonAggSelectFields.includes(item),
    );
    onUpdate({ groupBy: manualItems });
  };

  const addGroupByRow = () => {
    const hasEmptySlot = groupByItems.some((f) => f.trim() === "");
    if (!hasEmptySlot) {
      onUpdate({ groupBy: [...node.groupBy, ""] });
    }
  };

  const handleRemoveGroupByRow = (index: number) => {
    const itemToRemove = groupByItems[index];
    if (!itemToRemove) return;

    if (nonAggSelectFields.includes(itemToRemove)) {
      onToggleField(itemToRemove);
    } else {
      const nextManual = node.groupBy.filter((item) => item !== itemToRemove);
      onUpdate({ groupBy: nextManual });
    }
  };

  return (
    <div
      className={cn(
        "absolute z-10 rounded-md border border-[#b8d6ef] bg-white shadow-sm will-change-transform",
        isDragging && "shadow-lg ring-2 ring-primary/20",
      )}
      style={{ left: node.x, top: node.y, width: nodeWidth }}
      data-builder-node
    >
      <div className="flex items-center gap-2 rounded-t-md border-b border-border bg-[#f7fbff] px-2 py-1.5">
        <span
          className="cursor-grab rounded p-0.5 text-muted-foreground active:cursor-grabbing"
          onPointerCancel={onDragEnd}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          <GripVertical className="size-4" />
        </span>
        <Table2 className="size-4 text-primary" />
        <div className="min-w-0 flex-1 truncate font-medium">
          {node.entityName}
        </div>
        {loading ? (
          <LoaderCircle className="size-3.5 animate-spin text-primary" />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label={`Remove ${node.entityName}`}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="space-y-2 p-2">
        <div className="grid grid-cols-[56px_1fr] items-center gap-2">
          <span className="text-xs text-muted-foreground">Alias</span>
          <Input
            value={node.alias}
            onChange={(event) =>
              onUpdate({ alias: event.target.value.trim().toLowerCase() })
            }
            className={cn(
              "h-7",
              aliasIsInvalid &&
                "border-destructive focus-visible:ring-destructive/25",
            )}
          />
        </div>

        {/* Fields */}
        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Fields</span>
            <span className="flex items-center gap-1">
              {nodeFields.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        fields: nodeFields
                          .map((f) => getFieldName(f))
                          .join(", "),
                      })
                    }
                    className="text-[10px] text-primary hover:underline"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ fields: "" })}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Input
              value={node.fields}
              onChange={(event) => onUpdate({ fields: event.target.value })}
              placeholder={allNodes.length === 1 ? "*" : "CARRID, CONNID"}
              className="h-7 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onOpenFieldPicker((fieldNames) => {
                  const current = parseFields(node.fields).map(
                    normalizeFieldName,
                  );
                  const newFields = fieldNames
                    .map(normalizeFieldName)
                    .filter((f) => !current.includes(f));
                  if (newFields.length > 0) {
                    const updated = [...parseFields(node.fields), ...newFields];
                    onUpdate({ fields: updated.join(", ") });
                  }
                })
              }
              className="shrink-0 h-7 text-[10px] px-2"
            >
              <Search className="size-3" />
              Browse
            </Button>
          </div>
          {/* Aggregate function quick buttons */}
          {nodeFields.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(() => {
                const addAggregateExprs = (exprs: string[]) => {
                  if (exprs.length === 0) return;

                  const current = parseFields(node.fields);
                  const newExprs = exprs.filter((expr) => !current.includes(expr));
                  if (newExprs.length === 0) return;

                  const newFields = [...current, ...newExprs];
                  const nonAggregates = newFields.filter(
                    (f) => !f.includes("("),
                  );
                  const currentGroupBy = node.groupBy.filter((g) => g.trim());
                  const nextGroupBy = [...currentGroupBy];

                  for (const f of nonAggregates) {
                    if (!nextGroupBy.includes(f)) {
                      nextGroupBy.push(f);
                    }
                  }

                  onUpdate({
                    fields: newFields.join(", "),
                    ...(nextGroupBy.length > currentGroupBy.length
                      ? { groupBy: nextGroupBy }
                      : {}),
                  });
                };

                return (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenFieldPicker((fieldNames) => {
                          if (fieldNames.length === 0) return;
                          const exprs = fieldNames.map(
                            (field) => `MAX( ${field} ) AS MAX_${field}`,
                          );
                          addAggregateExprs(exprs);
                        })
                      }
                      className="h-5 rounded border border-border bg-white px-1.5 text-[10px] leading-none text-muted-foreground hover:border-primary/50 hover:text-primary"
                    >
                      MAX
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenFieldPicker((fieldNames) => {
                          if (fieldNames.length === 0) return;
                          const exprs = fieldNames.map(
                            (field) => `MIN( ${field} ) AS MIN_${field}`,
                          );
                          addAggregateExprs(exprs);
                        })
                      }
                      className="h-5 rounded border border-border bg-white px-1.5 text-[10px] leading-none text-muted-foreground hover:border-primary/50 hover:text-primary"
                    >
                      MIN
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenFieldPicker((fieldNames) => {
                          if (fieldNames.length === 0) return;
                          const exprs = fieldNames.map(
                            (field) => `SUM( ${field} ) AS SUM_${field}`,
                          );
                          addAggregateExprs(exprs);
                        })
                      }
                      className="h-5 rounded border border-border bg-white px-1.5 text-[10px] leading-none text-muted-foreground hover:border-primary/50 hover:text-primary"
                    >
                      SUM
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenFieldPicker((fieldNames) => {
                          if (fieldNames.length === 0) return;
                          const exprs = fieldNames.map(
                            (field) => `AVG( ${field} ) AS AVG_${field}`,
                          );
                          addAggregateExprs(exprs);
                        })
                      }
                      className="h-5 rounded border border-border bg-white px-1.5 text-[10px] leading-none text-muted-foreground hover:border-primary/50 hover:text-primary"
                    >
                      AVG
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        addAggregateExprs(["COUNT( * ) AS TOTAL_FLIGHTS"]);
                      }}
                      className="h-5 rounded border border-border bg-white px-1.5 text-[10px] leading-none text-muted-foreground hover:border-primary/50 hover:text-primary"
                      title="Count all rows (including NULLs)"
                    >
                      COUNT(*)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenFieldPicker((fieldNames) => {
                          if (fieldNames.length === 0) return;
                          const exprs = fieldNames.map(
                            (field) => `COUNT( ${field} ) AS COUNT_${field}`,
                          );
                          addAggregateExprs(exprs);
                        })
                      }
                      className="h-5 rounded border border-border bg-white px-1.5 text-[10px] leading-none text-muted-foreground hover:border-primary/50 hover:text-primary"
                      title="Count non-null values of a specific field"
                    >
                      COUNT(field)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenFieldPicker((fieldNames) => {
                          if (fieldNames.length === 0) return;
                          const exprs = fieldNames.map(
                            (field) => `COUNT( DISTINCT ${field} ) AS UNIQUE_${field}`,
                          );
                          addAggregateExprs(exprs);
                        })
                      }
                      className="h-5 rounded border border-border bg-white px-1.5 text-[10px] leading-none text-muted-foreground hover:border-primary/50 hover:text-primary"
                      title="Count unique non-null values of a specific field"
                    >
                      COUNT DISTINCT
                    </button>
                  </>
                );
              })()}
            </div>
          ) : null}

          {selectedFields.size > 0 ? (
            <div className="flex max-h-20 flex-wrap content-start gap-1 overflow-auto">
              {parseFields(node.fields).map((fieldName) => (
                <button
                  key={fieldName}
                  type="button"
                  onClick={() => onToggleField(fieldName)}
                  className="inline-flex items-center gap-0.5 h-5 rounded border border-primary/40 bg-[#e5f2ff] px-1.5 text-[10px] leading-none text-primary hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                  title="Click to remove"
                >
                  {fieldName}
                  <span className="text-[9px]">×</span>
                </button>
              ))}
            </div>
          ) : allNodes.length > 1 ? (
            <div className="text-[10px] text-muted-foreground italic">
              No fields selected. Use Browse or type field names.
            </div>
          ) : null}
        </div>

        {/* Order By */}
        {nodeFields.length > 0 ? (
          <div className="border-t border-border pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Order By
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    orderBy: [...node.orderBy, { field: "", direction: "ASC" }],
                  })
                }
                className="text-[10px] text-primary hover:underline"
              >
                + Add
              </button>
            </div>
            {node.orderBy.map((order, oi) => (
              <div key={oi} className="mb-1 flex items-center gap-1">
                <Select
                  value={order.field}
                  onValueChange={(v) => {
                    const next = [...node.orderBy];
                    next[oi] = { ...next[oi], field: v };
                    onUpdate({ orderBy: next });
                  }}
                >
                  <SelectTrigger className="h-6 flex-1 text-[10px]">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {nodeFields.map((f) => (
                      <SelectItem key={getFieldName(f)} value={getFieldName(f)}>
                        {getFieldName(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={order.direction}
                  onValueChange={(v) => {
                    const next = [...node.orderBy];
                    next[oi] = {
                      ...next[oi],
                      direction: v as "ASC" | "DESC",
                    };
                    onUpdate({ orderBy: next });
                  }}
                >
                  <SelectTrigger className="h-6 w-16 text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">ASC</SelectItem>
                    <SelectItem value="DESC">DESC</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    onOpenFieldPicker((fieldNames) => {
                      const next = [...node.orderBy];
                      next[oi] = {
                        ...next[oi],
                        field: fieldNames[fieldNames.length - 1] ?? "",
                      };
                      onUpdate({ orderBy: next });
                    })
                  }
                  aria-label="Browse fields"
                  title="Browse fields"
                >
                  <Search className="size-3" />
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    const next = node.orderBy.filter((_, i) => i !== oi);
                    onUpdate({ orderBy: next });
                  }}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Group By */}
        {nodeFields.length > 0 ? (
          <div className="border-t border-border pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Group By
              </span>
              <button
                type="button"
                onClick={addGroupByRow}
                className="text-[10px] text-primary hover:underline"
              >
                + Add
              </button>
            </div>
            {groupByItems.map((field, index) => (
              <div key={index} className="mb-1 flex items-center gap-1">
                <Select
                  value={field}
                  onValueChange={(v) => {
                    const next = [...groupByItems];
                    next[index] = v;
                    updateGroupBy(next);
                  }}
                >
                  <SelectTrigger className="h-6 flex-1 text-[10px]">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {nodeFields
                      .filter(
                        (f) =>
                          !groupByItems.some(
                            (item, i) =>
                              i !== index && item === getFieldName(f),
                          ),
                      )
                      .map((f) => (
                        <SelectItem
                          key={getFieldName(f)}
                          value={getFieldName(f)}
                        >
                          {getFieldName(f)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    onOpenFieldPicker((fieldNames) => {
                      const next = [...groupByItems];
                      next[index] = fieldNames[fieldNames.length - 1] ?? "";
                      updateGroupBy(next);
                    })
                  }
                  aria-label="Browse fields"
                  title="Browse fields"
                >
                  <Search className="size-3" />
                </Button>
                <button
                  type="button"
                  onClick={() => handleRemoveGroupByRow(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="truncate text-xs text-muted-foreground px-2 pb-1.5">
        {getEntityLabel(node.entityName, entities)}
      </div>
    </div>
  );
}
