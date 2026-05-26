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
