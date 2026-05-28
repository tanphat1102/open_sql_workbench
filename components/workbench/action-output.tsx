"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseSapDate } from "@/lib/sapParser";
import type { WorkbenchActivity } from "@/types/workbench";

type ActionOutputProps = {
  activity: WorkbenchActivity[];
};

function formatSapDate(rawValue: string) {
  const parsedDate = parseSapDate(rawValue);

  return parsedDate
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(parsedDate)
    : rawValue;
}

export function ActionOutput({ activity }: ActionOutputProps) {
  const latestWarning = activity.find((entry) => entry.tone === "warning");

  return (
    <Card className="fiori-surface min-h-0 gap-0 py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-foreground">Messages</CardTitle>
          <div
            className={
              latestWarning
                ? "rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                : "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
            }
          >
            {latestWarning ? "Warning" : "Ready"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="divide-y divide-border text-sm text-foreground">
            {activity.length === 0 ? (
              <div className="p-3 text-muted-foreground">
                No actions yet.
              </div>
            ) : (
              <div>
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className={
                      a.tone === "warning"
                        ? "bg-amber-50/70 p-3"
                        : "bg-white p-3"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={
                          a.tone === "warning"
                            ? "text-sm font-medium text-amber-900"
                            : "text-sm font-medium text-foreground"
                        }
                      >
                        {a.title}
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {formatSapDate(a.timestampRaw)}
                      </div>
                    </div>
                    <div
                      className={
                        a.tone === "warning"
                          ? "mt-1 whitespace-pre-wrap font-mono text-xs leading-5 text-amber-900"
                          : "mt-1 whitespace-pre-wrap font-mono text-xs leading-5 text-muted-foreground"
                      }
                    >
                      {a.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
