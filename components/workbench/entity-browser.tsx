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
    <Card className="border-sky-100 bg-white shadow-[0_18px_50px_rgba(15,90,170,0.08)] backdrop-blur">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl text-slate-900">Schema browser</CardTitle>
        <CardDescription className="text-slate-600">
          Browse available entity sets, key fields, and metadata at a glance.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ScrollArea className="h-75 pr-4">
          <div className="space-y-3">
            {entities.map((entity) => {
              const isSelected = entity.name === selectedEntityName;

              return (
                <Button
                  key={entity.name}
                  type="button"
                  variant={isSelected ? "secondary" : "outline"}
                  onClick={() => onSelectEntity(entity.name)}
                  className={cn(
                    "h-auto w-full justify-start rounded-2xl border px-4 py-4 text-left transition",
                    isSelected
                      ? "border-sky-300 bg-sky-50 text-slate-900 hover:bg-sky-50"
                      : "border-sky-100 bg-white text-slate-900 hover:bg-sky-50 hover:text-slate-900",
                  )}
                >
                  <div className="w-full space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{entity.name}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-600">
                          {entity.description}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-sky-700"
                      >
                        {entity.recordCount} rows
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {entity.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="bg-sky-50 text-sky-700"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>

        <Separator className="bg-sky-100" />

        {selectedEntity ? (
          <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-sky-600">
                  Selected entity
                </div>
                <div className="mt-1 font-medium text-slate-900">
                  {selectedEntity.name}
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-sky-200 bg-white text-sky-700"
              >
                {selectedEntity.keyFields.length} key fields
              </Badge>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <div>
                <span className="text-slate-500">Keys: </span>
                {selectedEntity.keyFields.join(", ")}
              </div>
              <div>
                <span className="text-slate-500">Last sync: </span>
                {formatSapDate(selectedEntity.lastSyncedRaw)}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
