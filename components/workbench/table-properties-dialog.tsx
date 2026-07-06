"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
};

function normalizeNumber(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value: string | boolean | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["X", "TRUE", "1", "YES"].includes(value.toUpperCase());
  }

  return false;
}

export function TablePropertiesDialog({
  open,
  onOpenChange,
  entityName,
  entityType = "TABLE",
  entityDescription,
}: TablePropertiesDialogProps) {
  const [fields, setFields] = useState<SapSqlwbField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entityName) {
      return;
    }

    let isMounted = true;

    async function loadFields() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await sqlAssistService.getFields(entityName);

        if (isMounted) {
          setFields(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load field metadata for this table.",
          );
          setFields([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFields();

    return () => {
      isMounted = false;
    };
  }, [open, entityName]);

  const keyFieldCount = fields.filter((f) => normalizeBoolean(f.IsKey)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="shrink-0 border-border text-muted-foreground hover:text-foreground"
            >
              Close
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[800px]">
              <TableHeader>
                <TableRow className="border-b border-border bg-accent">
                  {[
                    "Pos",
                    "Field Name",
                    "JSON Key",
                    "Data Element",
                    "Type",
                    "Len",
                    "Dec",
                    "Key",
                    "Label",
                  ].map((h) => (
                    <TableHead
                      key={h}
                      className="h-8 text-xs font-semibold text-foreground bg-accent"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-transparent">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j} className="py-1.5">
                        <div
                          className="h-3 animate-pulse rounded bg-accent"
                          style={{
                            width: `${j === 0 ? 24 : j === 4 ? 40 : j === 5 || j === 6 ? 28 : j === 7 ? 32 : 60 + Math.floor(Math.random() * 80)}px`,
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
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[800px]">
              <TableHeader>
                <TableRow className="border-b border-border bg-accent sticky top-0">
                  <TableHead className="h-8 w-16 text-xs font-semibold text-foreground bg-accent">
                    Pos
                  </TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-foreground bg-accent">
                    Field Name
                  </TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-foreground bg-accent">
                    JSON Key
                  </TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-foreground bg-accent">
                    Data Element
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
                  <TableHead className="h-8 text-xs font-semibold text-foreground bg-accent">
                    Label
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const isKey = normalizeBoolean(field.IsKey);
                  const position = normalizeNumber(field.Position, index + 1);
                  const length = normalizeNumber(field.Length);
                  const decimals = normalizeNumber(field.Decimals);

                  return (
                    <TableRow
                      key={`${field.FieldName ?? index}-${position}`}
                      className={
                        isKey
                          ? "border-b border-border bg-accent/30 hover:bg-accent/50"
                          : "border-b border-transparent hover:bg-accent/40"
                      }
                    >
                      <TableCell className="py-1.5 pr-0 text-xs tabular-nums text-muted-foreground">
                        {position}
                      </TableCell>
                      <TableCell className="py-1.5 font-medium text-xs text-foreground">
                        {field.FieldName || "-"}
                      </TableCell>
                      <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                        {field.JsonKey || "-"}
                      </TableCell>
                      <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                        {field.Element || "-"}
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
                        {isKey ? (
                          <Badge
                            variant="outline"
                            className="border-primary px-1.5 py-px text-[10px] text-primary"
                          >
                            KEY
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {field.Label || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </table>
          </div>
        )}

        {fields.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border bg-[#f7fbff] px-5 py-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">
                  {fields.length}
                </span>{" "}
                field{fields.length !== 1 ? "s" : ""}
              </span>
              {keyFieldCount > 0 ? (
                <span>
                  <span className="font-semibold text-foreground">
                    {keyFieldCount}
                  </span>{" "}
                  key field{keyFieldCount !== 1 ? "s" : ""}
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
  );
}
