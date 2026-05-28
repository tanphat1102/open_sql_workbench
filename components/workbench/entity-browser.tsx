"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { parseSapDate } from "@/lib/sapParser";
import { cn } from "@/lib/utils";
import type { WorkbenchEntity } from "@/types/workbench";

type EntityBrowserProps = {
  entities: WorkbenchEntity[];
  selectedEntityName: string;
  onSelectEntity: (entityName: string) => void;
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
}: EntityBrowserProps) {
  const selectedEntity =
    entities.find((entity) => entity.name === selectedEntityName) ??
    entities[0];

  return (
    <Card className="fiori-surface h-full min-h-0 gap-0 py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <CardTitle className="text-base text-foreground">
          Object Explorer
        </CardTitle>
        <CardDescription className="text-xs">
          Entity sets and key fields
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {entities.map((entity) => {
              const isSelected = entity.name === selectedEntityName;

              return (
                <Button
                  key={entity.name}
                  type="button"
                  variant={isSelected ? "secondary" : "outline"}
                  onClick={() => onSelectEntity(entity.name)}
                  className={cn(
                    "h-auto w-full justify-start rounded-md border px-3 py-2 text-left transition",
                    isSelected
                      ? "border-primary/35 bg-accent text-foreground hover:bg-accent"
                      : "border-border bg-white text-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium">{entity.name}</div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {entity.recordCount}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {entity.keyFields.length
                        ? `Keys: ${entity.keyFields.join(", ")}`
                        : entity.description}
                    </div>
                  </div>
                </Button>
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
                {selectedEntity.keyFields.length} key fields
              </Badge>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div>
                <span className="text-muted-foreground">Keys: </span>
                {selectedEntity.keyFields.join(", ")}
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
  );
}
