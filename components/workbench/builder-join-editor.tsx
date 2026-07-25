"use client";

import { ArrowLeftRight, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuilderFieldSelect } from "@/components/workbench/builder-field-select";
import type { SapSqlwbField } from "@/types/sap";
import type { BuilderJoin, BuilderNode } from "@/types/builder";

interface BuilderJoinEditorProps {
  join: BuilderJoin;
  effectiveJoin: BuilderJoin;
  nodes: BuilderNode[];
  leftNodeFields: SapSqlwbField[];
  rightNodeFields: SapSqlwbField[];
  isValid: boolean;
  onUpdate: (patch: Partial<BuilderJoin>) => void;
  onRemove: () => void;
  onSuggest: () => void;
}

export function BuilderJoinEditor({
  join,
  effectiveJoin,
  nodes,
  leftNodeFields,
  rightNodeFields,
  isValid,
  onUpdate,
  onRemove,
  onSuggest,
}: BuilderJoinEditorProps) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-white p-2">
      <Select
        value={join.joinType}
        onValueChange={(value) =>
          onUpdate({ joinType: value as BuilderJoin["joinType"] })
        }
      >
        <SelectTrigger className="h-6 text-[11px] w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INNER JOIN">Inner join</SelectItem>
          <SelectItem value="LEFT JOIN">Left join</SelectItem>
          <SelectItem value="LEFT OUTER JOIN">Left outer join</SelectItem>
          {/* <SelectItem value="RIGHT OUTER JOIN">Right join</SelectItem> */}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={() =>
            onUpdate({
              leftNodeId: join.rightNodeId,
              rightNodeId: join.leftNodeId,
              leftField: join.rightField,
              rightField: join.leftField,
              joinType:
                join.joinType === "LEFT OUTER JOIN" ||
                join.joinType === "LEFT JOIN"
                  ? "RIGHT OUTER JOIN"
                  : join.joinType === "RIGHT OUTER JOIN"
                    ? "LEFT OUTER JOIN"
                    : join.joinType,
            })
          }
          aria-label="Swap join direction"
        >
          <ArrowLeftRight className="size-3.5" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onSuggest}>
          <Sparkles />
          Suggest
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove join"
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 min-w-0">
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Table</div>
          <Select
            value={join.leftNodeId}
            onValueChange={(value) => onUpdate({ leftNodeId: value })}
          >
            <SelectTrigger className="h-6 text-[11px] min-w-0">
              <SelectValue placeholder="Left" />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.alias}: {node.entityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Table</div>
          <Select
            value={join.rightNodeId}
            onValueChange={(value) => onUpdate({ rightNodeId: value })}
          >
            <SelectTrigger className="h-6 text-[11px] min-w-0">
              <SelectValue placeholder="Right" />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.alias}: {node.entityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Field</div>
          <BuilderFieldSelect
            fields={leftNodeFields}
            value={effectiveJoin.leftField}
            onValueChange={(leftField) => onUpdate({ leftField })}
            placeholder="Left"
            showKeyBadge
            className="h-6 text-[11px] min-w-0"
          />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground mb-0.5">Field</div>
          <BuilderFieldSelect
            fields={rightNodeFields}
            value={effectiveJoin.rightField}
            onValueChange={(rightField) => onUpdate({ rightField })}
            placeholder="Right"
            showKeyBadge
            className="h-6 text-[11px] min-w-0"
          />
        </div>
      </div>
      {!isValid ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Choose valid metadata fields before applying SQL.
        </div>
      ) : null}
    </div>
  );
}
