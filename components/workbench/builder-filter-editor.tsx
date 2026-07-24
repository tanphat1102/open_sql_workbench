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

export function BuilderFilterEditor({
  filter,
  index,
  nodes,
  nodeFields,
  isValid,
  onUpdate,
  onRemove,
}: BuilderFilterEditorProps) {
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
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Field</div>
          <BuilderFieldSelect
            fields={nodeFields}
            value={filter.field}
            onValueChange={(field) => onUpdate({ field })}
            placeholder="Select"
            className="h-6 text-[11px] min-w-0"
          />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Operator</div>
          <Select
            value={filter.operator}
            onValueChange={(operator) =>
              onUpdate({ operator: operator as BuilderFilter["operator"] })
            }
          >
            <SelectTrigger className="h-6 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="=">=</SelectItem>
              <SelectItem value="<>">&lt;&gt;</SelectItem>
              <SelectItem value=">">&gt;</SelectItem>
              <SelectItem value=">=">&gt;=</SelectItem>
              <SelectItem value="<">&lt;</SelectItem>
              <SelectItem value="<=">&lt;=</SelectItem>
              <SelectItem value="LIKE">LIKE</SelectItem>
              <SelectItem value="BETWEEN">BETWEEN</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">
            {filter.operator === "BETWEEN" ? "From" : "Value"}
          </div>
          <Input
            value={filter.value}
            onChange={(event) => onUpdate({ value: event.target.value })}
            placeholder={filter.operator === "BETWEEN" ? "From" : "Value"}
            className="h-6 text-[11px]"
          />
        </div>
        {filter.operator === "BETWEEN" ? (
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground mb-0.5">To</div>
            <Input
              value={filter.value2 ?? ""}
              onChange={(event) => onUpdate({ value2: event.target.value })}
              placeholder="To"
              className="h-6 text-[11px]"
            />
          </div>
        ) : null}
      </div>
      {!isValid ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Choose a field and value for this condition.
        </div>
      ) : null}
    </div>
  );
}
