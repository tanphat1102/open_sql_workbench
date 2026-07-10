"use client";

import { Sparkles, Trash2 } from "lucide-react";

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
      <div className="flex items-center justify-between gap-2">
        <Select
          value={join.joinType}
          onValueChange={(value) =>
            onUpdate({ joinType: value as BuilderJoin["joinType"] })
          }
        >
          <SelectTrigger className="h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INNER JOIN">Inner join</SelectItem>
            <SelectItem value="LEFT OUTER JOIN">Left outer join</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSuggest}
        >
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
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={join.leftNodeId}
          onValueChange={(value) => onUpdate({ leftNodeId: value })}
        >
          <SelectTrigger className="h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nodes.map((node) => (
              <SelectItem key={node.id} value={node.id}>
                {node.alias}: {node.entityName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={join.rightNodeId}
          onValueChange={(value) => onUpdate({ rightNodeId: value })}
        >
          <SelectTrigger className="h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nodes.map((node) => (
              <SelectItem key={node.id} value={node.id}>
                {node.alias}: {node.entityName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <BuilderFieldSelect
          fields={leftNodeFields}
          value={effectiveJoin.leftField}
          onValueChange={(leftField) => onUpdate({ leftField })}
          placeholder="Left field"
          showKeyBadge
        />
        <BuilderFieldSelect
          fields={rightNodeFields}
          value={effectiveJoin.rightField}
          onValueChange={(rightField) => onUpdate({ rightField })}
          placeholder="Right field"
          showKeyBadge
        />
      </div>
      {!isValid ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Choose valid metadata fields before applying SQL.
        </div>
      ) : null}
    </div>
  );
}
