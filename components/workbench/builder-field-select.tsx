"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SapSqlwbField } from "@/types/sap";

function getFieldName(field: SapSqlwbField) {
  return (field.FieldName ?? field.JsonKey ?? "").trim().toUpperCase();
}

function isKeyField(field: SapSqlwbField) {
  const value = field.IsKey;

  return (
    value === true ||
    String(value).toUpperCase() === "X" ||
    String(value).toLowerCase() === "true"
  );
}

interface BuilderFieldSelectProps {
  fields: SapSqlwbField[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  showKeyBadge?: boolean;
  className?: string;
}

export function BuilderFieldSelect({
  fields,
  value,
  onValueChange,
  placeholder,
  showKeyBadge = false,
  className = "h-7",
}: BuilderFieldSelectProps) {
  if (fields.length === 0) {
    return (
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className={cn("min-w-0 overflow-hidden", className)}>
        <SelectValue placeholder={placeholder} className="truncate block" />
      </SelectTrigger>
      <SelectContent className="max-w-[260px]">
        {fields.map((field) => {
          const fieldName = getFieldName(field);

          return (
            <SelectItem key={fieldName} value={fieldName} title={fieldName}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate block max-w-[180px]">{fieldName}</span>
                {showKeyBadge && isKeyField(field) ? (
                  <span className="shrink-0 text-[10px] uppercase text-primary font-semibold">
                    Key
                  </span>
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
