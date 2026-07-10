"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { GripVertical, LoaderCircle, Table2, Trash2 } from "lucide-react";

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
  onUpdate: (patch: Partial<BuilderNode>) => void;
  onRemove: () => void;
  onToggleField: (fieldName: string) => void;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragEnd: (event: ReactPointerEvent<HTMLElement>) => void;
}

const nodeWidth = 220;

export function BuilderNodeCard({
  node,
  allNodes,
  nodeFields,
  loading,
  entities,
  isDragging,
  onUpdate,
  onRemove,
  onToggleField,
  onDragStart,
  onDragMove,
  onDragEnd,
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
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Fields</span>
          <Input
            value={node.fields}
            onChange={(event) => onUpdate({ fields: event.target.value })}
            placeholder={allNodes.length === 1 ? "*" : "CARRID, CONNID"}
            className="h-7"
          />
          {nodeFields.length > 0 ? (
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {nodeFields.length} fields
              </span>
              <span className="flex gap-1">
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
              </span>
            </div>
          ) : null}
          {nodeFields.length > 0 ? (
            <div className="flex max-h-28 flex-wrap content-start gap-1 overflow-auto">
              {nodeFields.map((field) => {
                const fieldName = getFieldName(field);
                const selected = selectedFields.has(fieldName);

                return (
                  <button
                    key={fieldName}
                    type="button"
                    onClick={() => onToggleField(fieldName)}
                    className={cn(
                      "h-5 rounded border px-1.5 text-[10px] leading-none",
                      selected
                        ? "border-primary bg-[#e5f2ff] text-primary"
                        : "border-border bg-white text-muted-foreground hover:border-primary/60 hover:text-primary",
                    )}
                  >
                    {fieldName}
                    {isKeyField(field) ? (
                      <span className="ml-1 text-[9px] uppercase">Key</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
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
                      orderBy: [
                        ...node.orderBy,
                        { field: "", direction: "ASC" },
                      ],
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
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {getEntityLabel(node.entityName, entities)}
        </div>
      </div>
    </div>
  );
}
