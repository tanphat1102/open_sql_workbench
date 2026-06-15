"use client";

import { X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseSapDate } from "@/lib/sapParser";
import type { WorkbenchActivity } from "@/types/workbench";

type ActionOutputProps = {
  activity: WorkbenchActivity[];
  onClose?: () => void;
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

const toneStyles: Record<
  WorkbenchActivity["tone"],
  {
    badge: string;
    row: string;
    title: string;
    detail: string;
    label: string;
  }
> = {
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    row: "border-l-4 border-l-emerald-500 bg-emerald-50/40",
    title: "text-emerald-950",
    detail: "text-emerald-900",
    label: "Success",
  },
  info: {
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    row: "border-l-4 border-l-sky-500 bg-sky-50/40",
    title: "text-sky-950",
    detail: "text-sky-900",
    label: "Info",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    row: "border-l-4 border-l-amber-500 bg-amber-50/60",
    title: "text-amber-950",
    detail: "text-amber-900",
    label: "Warning",
  },
  error: {
    badge: "border-red-200 bg-red-50 text-red-700",
    row: "border-l-4 border-l-red-500 bg-red-50/70",
    title: "text-red-950",
    detail: "text-red-900",
    label: "Error",
  },
};

function getCurrentStatus(activity: WorkbenchActivity[]) {
  return (
    activity.find((entry) => entry.tone === "error") ??
    activity.find((entry) => entry.tone === "warning") ??
    activity.find((entry) => entry.tone === "success") ??
    activity.find((entry) => entry.tone === "info")
  );
}

export function ActionOutput({ activity, onClose }: ActionOutputProps) {
  const currentStatus = getCurrentStatus(activity);
  const statusTone = currentStatus?.tone ?? "info";
  const statusStyle = toneStyles[statusTone];

  return (
    <Card className="fiori-surface h-full min-h-0 gap-0 py-0">
      <CardHeader className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-foreground">Messages</CardTitle>
          <div className="flex items-center gap-2">
            <div
              className={`rounded-md border px-2 py-1 text-xs font-medium ${statusStyle.badge}`}
            >
              {currentStatus ? statusStyle.label : "Ready"}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-accent hover:text-primary"
                aria-label="Hide Messages"
                title="Hide Messages"
              >
                <X className="size-4" />
              </button>
            ) : null}
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
                {activity.map((a) => {
                  const style = toneStyles[a.tone];

                  return (
                    <div key={a.id} className={`p-3 ${style.row}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-sm font-medium ${style.title}`}>
                          {a.title}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {style.label}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {formatSapDate(a.timestampRaw)}
                      </div>
                    </div>
                    <div className={`mt-2 whitespace-pre-wrap font-mono text-xs leading-5 ${style.detail}`}>
                      {a.detail}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
