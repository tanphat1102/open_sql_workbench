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
import { parseSapDate } from "@/lib/sapParser";
import type { WorkbenchActivity } from "@/types/workbench";

type ActivityFeedProps = {
  activity: WorkbenchActivity[];
};

const toneLabelMap: Record<WorkbenchActivity["tone"], string> = {
  success: "success",
  info: "info",
  warning: "warning",
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

export function ActivityFeed({ activity }: ActivityFeedProps) {
  return (
    <Card className="fiori-surface">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl text-foreground">Activity feed</CardTitle>
        <CardDescription>
          Track local workbench actions and later swap in server-backed events.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-70 pr-4">
          <div className="space-y-3">
            {activity.map((entry) => (
              <div
                key={entry.id}
                className="fiori-subtle rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-foreground">
                      {entry.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                      {entry.detail}
                    </div>
                  </div>
                  <Badge
                    variant={entry.tone === "success" ? "secondary" : "outline"}
                    className="shrink-0 border-[#b8d6ef] bg-white text-primary"
                  >
                    {toneLabelMap[entry.tone]}
                  </Badge>
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.14em] text-primary/75">
                  {formatSapDate(entry.timestampRaw)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
