"use client";

import { Input } from "@/components/ui/input";
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
}

export function BuilderFieldSelect({
  fields,
  value,
  onValueChange,
  placeholder,
  showKeyBadge = false,
}: BuilderFieldSelectProps) {
  if (fields.length === 0) {
    return (
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="h-7"
      />
    );
  }

  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className="h-7">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {fields.map((field) => {
          const fieldName = getFieldName(field);

          return (
            <SelectItem key={fieldName} value={fieldName}>
              <span className="flex items-center gap-2">
                <span>{fieldName}</span>
                {showKeyBadge && isKeyField(field) ? (
                  <span className="text-[10px] uppercase text-primary">
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
