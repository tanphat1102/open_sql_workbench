"use client";

import Link from "next/link";
import {
  ArrowRight,
  DatabaseZap,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";

import { ActivityFeed } from "@/components/workbench/activity-feed";
import { EntityBrowser } from "@/components/workbench/entity-browser";
import { QueryWorkbench } from "@/components/workbench/query-workbench";
import { ResultsTable } from "@/components/workbench/results-table";
import { ActionOutput } from "@/components/workbench/action-output";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useWorkbench } from "@/hooks/use-workbench";

export function WorkbenchDashboard() {
  const {
    metrics,
    selectedEntity,
    selectedEntityName,
    entities,
    templates,
    queryText,
    setQueryText,
    isRunning,
    activityEntries,
    resultRows,
    handleEntityChange,
    applyTemplate,
    runQuery,
    needLogin,
    setNeedLogin,
  } = useWorkbench();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(60,130,246,0.13),transparent_35%),radial-gradient(circle_at_right,rgba(14,165,233,0.1),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef5fb_100%)] px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <section className="flex w-full flex-col gap-4">
        <header className="rounded-[1.75rem] border border-sky-100 bg-white/85 p-4 shadow-[0_18px_50px_rgba(15,90,170,0.08)] backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-sky-500 text-white hover:bg-sky-400">
                  Open SQL Workbench
                </Badge>
                <Badge
                  variant="outline"
                  className="border-sky-200 bg-sky-50 text-sky-700"
                >
                  SAP work shell
                </Badge>
                <Badge
                  variant="outline"
                  className="border-sky-200 bg-white text-sky-700"
                >
                  Full-width Fiori-inspired layout
                </Badge>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl xl:text-5xl">
                  A wide working surface for SAP queries, browsing, and result
                  inspection.
                </h1>
                <p className="max-w-5xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                  This shell is intentionally stretched across the viewport so
                  you can keep schema, editor, results, and activity visible at
                  the same time.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 xl:justify-end">
              <Button
                asChild
                variant="outline"
                className="border-sky-200 bg-white text-sky-800 hover:bg-sky-50 hover:text-sky-900"
              >
                <Link href="/login">
                  <TerminalSquare />
                  Re-authenticate
                </Link>
              </Button>
              <Button
                type="button"
                onClick={runQuery}
                className="bg-sky-600 text-white hover:bg-sky-500"
              >
                <RefreshCw />
                Run preview
              </Button>
            </div>
          </div>

          <Separator className="my-4 bg-sky-100" />

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {metrics.map((metric) => (
              <Card key={metric.label} className="border-sky-100 bg-sky-50/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-sky-700/80">
                        {metric.label}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {metric.value}
                      </div>
                    </div>
                    <DatabaseZap className="size-5 text-sky-500" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {metric.detail}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-14rem)] gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4">
            <EntityBrowser
              entities={entities}
              selectedEntityName={selectedEntityName}
              onSelectEntity={handleEntityChange}
            />
            <ActivityFeed activity={activityEntries} />
          </div>

          <div className="space-y-4">
            <QueryWorkbench
              selectedEntityName={selectedEntityName}
              queryText={queryText}
              templates={templates}
              isRunning={isRunning}
              onQueryTextChange={setQueryText}
              onApplyTemplate={applyTemplate}
              onRunQuery={runQuery}
              needLogin={needLogin}
              setNeedLogin={setNeedLogin}
            />

            <ResultsTable
              entityName={selectedEntity?.name ?? selectedEntityName}
              rows={resultRows}
            />
            <ActionOutput activity={activityEntries} />
          </div>

          <aside className="space-y-4">
            <Card className="border-sky-100 bg-white/85 shadow-[0_18px_50px_rgba(15,90,170,0.08)] backdrop-blur">
              <CardContent className="space-y-4 p-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.24em] text-sky-600">
                    Workspace view
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This right rail is reserved for filters, saved variants, and
                    future action panels so the page keeps a true workbench
                    feel.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-sky-700/80">
                      Active entity
                    </div>
                    <div className="mt-2 text-lg font-medium text-slate-900">
                      {selectedEntity?.name ?? selectedEntityName}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-sky-700/80">
                      Result rows
                    </div>
                    <div className="mt-2 text-lg font-medium text-slate-900">
                      {resultRows.length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        <footer className="flex flex-col gap-3 border-t border-sky-100 py-2 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            Keep the SAP calls behind{" "}
            <span className="text-slate-900">/api/sap/[...path]</span> and
            normalize OData payloads in{" "}
            <span className="text-slate-900">lib/sapParser.ts</span>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sky-700 transition hover:text-sky-600"
          >
            Back to landing
            <ArrowRight className="size-4" />
          </Link>
        </footer>
      </section>
    </main>
  );
}
