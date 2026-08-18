"use client";

import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuilderFieldSelect } from "@/components/workbench/builder-field-select";
import type { SapSqlwbField } from "@/types/sap";
import type { BuilderFilter, BuilderNode } from "@/types/builder";

interface BuilderFilterEditorProps {
  filter: BuilderFilter;
  index: number;
  nodes: BuilderNode[];
  nodeFields: SapSqlwbField[];
  isValid: boolean;
  onUpdate: (patch: Partial<BuilderFilter>) => void;
  onRemove: () => void;
}

function parseHavingField(fieldStr: string) {
  const trimmed = (fieldStr || "").trim();
  if (!trimmed || trimmed === "COUNT(*)" || trimmed === "COUNT( * )") {
    return { fn: "COUNT(*)", col: "" };
  }
  const match = /^([A-Z]+)\s*\(\s*(?:DISTINCT\s+)?([A-Z0-9_]+|\*)\s*\)$/i.exec(
    trimmed,
  );
  if (match) {
    const fnName = match[1].toUpperCase();
    const colName = match[2].toUpperCase();
    if (fnName === "COUNT" && colName === "*") {
      return { fn: "COUNT(*)", col: "" };
    }
    return { fn: fnName, col: colName };
  }
  return { fn: "COUNT(*)", col: "" };
}

function composeHavingField(fn: string, col: string) {
  if (fn === "COUNT(*)") {
    return "COUNT(*)";
  }
  return col ? `${fn}(${col})` : `${fn}(*)`;
}

export function BuilderFilterEditor({
  filter,
  index,
  nodes,
  nodeFields,
  isValid,
  onUpdate,
  onRemove,
}: BuilderFilterEditorProps) {
  const isHaving = filter.clause === "HAVING";
  const isInvalidHavingField =
    isHaving &&
    filter.field &&
    !/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(filter.field);
  const havingParsed = parseHavingField(filter.field);

  return (
    <div className="space-y-2 rounded-md border border-border bg-white p-2">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {filter.clause ?? "WHERE"}
          </Badge>
          {index > 0 ? (
            <Select
              value={filter.conjunction}
              onValueChange={(value) =>
                onUpdate({ conjunction: value as BuilderFilter["conjunction"] })
              }
            >
              <SelectTrigger className="h-6 w-14 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove filter"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 min-w-0">
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Object</div>
          <Select
            value={filter.nodeId}
            onValueChange={(nodeId) => onUpdate({ nodeId, field: "" })}
          >
            <SelectTrigger className="h-6 text-[11px]">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {nodes.length > 1
                    ? `${node.alias}: ${node.entityName}`
                    : node.entityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isHaving ? (
          <>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                Aggregate Function
              </div>
              <Select
                value={havingParsed.fn}
                onValueChange={(fn) => {
                  const defaultCol =
                    havingParsed.col ||
                    (
                      nodeFields[0]?.FieldName ??
                      nodeFields[0]?.JsonKey ??
                      ""
                    )
                      .trim()
                      .toUpperCase();
                  onUpdate({ field: composeHavingField(fn, defaultCol) });
                }}
              >
                <SelectTrigger className="h-6 text-[11px] font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COUNT(*)">COUNT(*)</SelectItem>
                  <SelectItem value="COUNT">COUNT</SelectItem>
                  <SelectItem value="MAX">MAX</SelectItem>
                  <SelectItem value="MIN">MIN</SelectItem>
                  <SelectItem value="SUM">SUM</SelectItem>
                  <SelectItem value="AVG">AVG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                Field
              </div>
              {havingParsed.fn === "COUNT(*)" ? (
                <Input
                  value="*"
                  disabled
                  className="h-6 text-[11px] font-mono min-w-0 bg-slate-50 text-muted-foreground"
                />
              ) : (
                <BuilderFieldSelect
                  fields={nodeFields}
                  value={havingParsed.col}
                  onValueChange={(col) =>
                    onUpdate({
                      field: composeHavingField(havingParsed.fn, col),
                    })
                  }
                  placeholder="Select field"
                  className="h-6 text-[11px] min-w-0"
                />
              )}
            </div>
          </>
        ) : (
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground mb-0.5">
              Field
            </div>
            <BuilderFieldSelect
              fields={nodeFields}
              value={filter.field}
              onValueChange={(field) => onUpdate({ field })}
              placeholder="Select field"
              className="h-6 text-[11px] min-w-0"
            />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Operator</div>
          <Select
            value={filter.operator}
            onValueChange={(op) =>
              onUpdate({ operator: op as BuilderFilter["operator"] })
            }
          >
            <SelectTrigger className="h-6 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="=">=</SelectItem>
              <SelectItem value="<>">&lt;&gt;</SelectItem>
              <SelectItem value=">">&gt;</SelectItem>
              <SelectItem value="<">&lt;</SelectItem>
              <SelectItem value=">=">&gt;=</SelectItem>
              <SelectItem value="<=">&lt;=</SelectItem>
              <SelectItem value="LIKE">LIKE</SelectItem>
              <SelectItem value="BETWEEN">BETWEEN</SelectItem>
              <SelectItem value="IN">IN ()</SelectItem>
              <SelectItem value="NOT IN">NOT IN ()</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground mb-0.5">Value</div>
          <Input
            value={filter.value}
            onChange={(event) => onUpdate({ value: event.target.value })}
            placeholder={
              filter.operator === "IN" || filter.operator === "NOT IN"
                ? "Values (comma separated)"
                : filter.operator === "LIKE"
                  ? "e.g. AA%"
                  : "Value"
            }
            className="h-6 text-[11px]"
          />
        </div>
        {filter.operator === "BETWEEN" ? (
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-muted-foreground mb-0.5">
              Value 2
            </div>
            <Input
              value={filter.value2 ?? ""}
              onChange={(event) => onUpdate({ value2: event.target.value })}
              placeholder="To"
              className="h-6 text-[11px]"
            />
          </div>
        ) : null}
      </div>
      {isInvalidHavingField ? (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
          <div className="flex items-center justify-between gap-1 font-semibold">
            <span>⚠️ HAVING requires aggregate functions</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-5 shrink-0 border-red-300 bg-white text-[10px] text-red-700 hover:bg-red-100 hover:text-red-900"
              onClick={() => onUpdate({ clause: "WHERE" })}
            >
              Move to WHERE
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-red-700 leading-normal">
            Non-aggregate field &quot;{filter.field}&quot; cannot be used in HAVING. Move to WHERE clause for optimal performance.
          </p>
        </div>
      ) : !isValid ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Choose a field and value for this condition.
        </div>
      ) : null}
    </div>
  );
}
