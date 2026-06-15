"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, LoaderCircle, X } from "lucide-react";
import { parseSapDate } from "@/lib/sapParser";
import { cn } from "@/lib/utils";
import type { WorkbenchEntity } from "@/types/workbench";

type EntityBrowserProps = {
  entities: WorkbenchEntity[];
  selectedEntityName: string;
  onSelectEntity: (entityName: string) => void;
  onPreviewEntity?: (entityName: string) => void;
  previewingEntityName?: string;
  onClose?: () => void;
};

function formatSapDate(rawValue: string) {
  const parsedDate = parseSapDate(rawValue);

  return parsedDate
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsedDate)
    : rawValue;
}

export function EntityBrowser({
  entities,
  selectedEntityName,
  onSelectEntity,
  onPreviewEntity,
  previewingEntityName = "",
  onClose,
}: EntityBrowserProps) {
  const selectedEntity =
    entities.find((entity) => entity.name === selectedEntityName) ??
    entities[0];
  const selectedEntityType = selectedEntity?.tags[1] ?? "Object";

  return (
    <TooltipProvider>
      <Card className="fiori-surface h-full min-h-0 gap-0 py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-foreground">
              Object Explorer
            </CardTitle>
            <CardDescription className="text-xs">
              Entity sets and key fields
            </CardDescription>
          </div>
          {onClose ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-accent hover:text-primary"
                  aria-label="Hide Object Explorer"
                >
                  <X className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Hide Object Explorer</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {entities.map((entity) => {
              const isSelected = entity.name === selectedEntityName;

              return (
                <div
                  key={entity.name}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-accent",
                    isSelected
                      ? "bg-accent text-foreground"
                      : "bg-transparent text-foreground hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectEntity(entity.name)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <div className="truncate font-medium">{entity.name}</div>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {entity.recordCount > 0
                        ? entity.recordCount
                        : (entity.tags[1] ?? "Object")}
                    </span>
                  </button>
                  {onPreviewEntity ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onPreviewEntity(entity.name)}
                          disabled={previewingEntityName === entity.name}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-primary transition hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
                          aria-label={`Preview ${entity.name}`}
                        >
                          {previewingEntityName === entity.name ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                          {previewingEntityName === entity.name
                            ? "Loading"
                            : "Preview"}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Preview top rows from {entity.name}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator className="bg-border" />

        {selectedEntity ? (
          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-primary">
                  Selected entity
                </div>
                <div className="mt-1 truncate font-medium text-foreground">
                  {selectedEntity.name}
                </div>
              </div>
              <Badge variant="outline" className="border-[#b8d6ef] text-primary">
                {selectedEntity.keyFields.length > 0
                  ? `${selectedEntity.keyFields.length} key fields`
                  : selectedEntityType}
              </Badge>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div>
                {selectedEntity.keyFields.length > 0 ? (
                  <>
                    <span className="text-muted-foreground">Keys: </span>
                    {selectedEntity.keyFields.join(", ")}
                  </>
                ) : (
                  selectedEntity.description
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Last sync: </span>
                {formatSapDate(selectedEntity.lastSyncedRaw)}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
      </Card>
    </TooltipProvider>
  );
}
