"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WorkbenchActivity } from "@/types/workbench";

type ActionOutputProps = {
  activity: WorkbenchActivity[];
};

export function ActionOutput({ activity }: ActionOutputProps) {
  return (
    <Card className="border-sky-100 bg-white shadow-[0_12px_30px_rgba(15,90,170,0.06)]">
      <CardHeader>
        <CardTitle className="text-slate-900">Action Output</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-40">
          <div className="space-y-2 text-sm text-slate-700">
            {activity.length === 0 ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                No actions yet.
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-sky-50 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-900">
                        {a.title}
                      </div>
                      <div className="text-xs text-sky-700/80">
                        {a.timestampRaw}
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
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
