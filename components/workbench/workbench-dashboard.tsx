"use client";

import Link from "next/link";
import {
  RefreshCw,
  TerminalSquare,
} from "lucide-react";

import { EntityBrowser } from "@/components/workbench/entity-browser";
import { QueryWorkbench } from "@/components/workbench/query-workbench";
import { ResultsTable } from "@/components/workbench/results-table";
import { ActionOutput } from "@/components/workbench/action-output";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkbench } from "@/hooks/use-workbench";

export function WorkbenchDashboard() {
  const {
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
    <main className="fiori-page min-h-screen px-3 py-3 text-sm sm:px-4">
      <section className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1800px] flex-col gap-3">
        <header className="fiori-shell-bar flex flex-col gap-2 rounded-lg px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
              Open SQL Workbench
            </Badge>
            <span className="text-muted-foreground">
              {selectedEntityName || "No entity selected"}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              {resultRows.length} result rows
            </span>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              asChild
              variant="outline"
              className="border-[#b8d6ef] bg-white text-primary hover:bg-accent"
            >
              <Link href="/login">
                <TerminalSquare />
                Re-authenticate
              </Link>
            </Button>
            <Button
              type="button"
              onClick={runQuery}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw />
              Execute
            </Button>
          </div>
        </header>

        <div className="grid flex-1 gap-3 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="min-h-0">
            <EntityBrowser
              entities={entities}
              selectedEntityName={selectedEntityName}
              onSelectEntity={handleEntityChange}
            />
          </aside>

          <div className="grid min-h-0 grid-rows-[auto_minmax(260px,1fr)_220px] gap-3">
            <QueryWorkbench
              selectedEntityName={selectedEntityName}
              entities={entities}
              queryText={queryText}
              templates={templates}
              isRunning={isRunning}
              onQueryTextChange={setQueryText}
              onSelectEntity={handleEntityChange}
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
      </section>
    </main>
  );
}
