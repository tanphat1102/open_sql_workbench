"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  RefreshCw,
  UserCircle,
} from "lucide-react";

import { EntityBrowser } from "@/components/workbench/entity-browser";
import { QueryWorkbench } from "@/components/workbench/query-workbench";
import { ResultsTable } from "@/components/workbench/results-table";
import { ActionOutput } from "@/components/workbench/action-output";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkbench } from "@/hooks/use-workbench";
import { toast } from "@/lib/toast";
import { authService } from "@/services/authService";
import type { SapSessionInfo } from "@/types/sap";

export function WorkbenchDashboard() {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SapSessionInfo | null>(null);
  const {
    selectedEntity,
    selectedEntityName,
    entities,
    templates,
    queryText,
    setQueryText,
    isRunning,
    activityEntries,
    resultColumns,
    resultDebugResponses,
    resultRows,
    handleEntityChange,
    applyTemplate,
    runQuery,
    needLogin,
  } = useWorkbench();

  async function refreshSessionInfo(isMounted = true) {
    try {
      const session = await authService.getSession();

      if (isMounted) {
        setSessionInfo(session);
      }
    } catch {
      if (isMounted) {
        setSessionInfo(null);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    authService
      .getSession()
      .then((session) => {
        if (isMounted) {
          setSessionInfo(session);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSessionInfo(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!needLogin) {
      return;
    }

    toast({
      title: "SAP session required",
      description: "Sign in again before running SAP queries.",
      variant: "destructive",
    });
    router.push("/login");
  }, [needLogin, router]);

  function handleProfileToggle() {
    setProfileOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        void refreshSessionInfo();
      }

      return nextOpen;
    });
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await authService.logout();
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
      setProfileOpen(false);
    }
  }

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

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              onClick={runQuery}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw />
              Execute
            </Button>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={handleProfileToggle}
                className="border-[#b8d6ef] bg-white text-primary hover:bg-accent"
              >
                <UserCircle />
                {sessionInfo?.user || "User"}
                <ChevronDown className="size-4" />
              </Button>
              {profileOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-border bg-white p-1 shadow-md">
                  <div className="border-b border-border px-3 py-2">
                    <div className="text-sm font-medium text-foreground">
                      {sessionInfo?.user || "SAP user"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sessionInfo?.client
                        ? `Client ${sessionInfo.client}`
                        : "SAP session"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={isLoggingOut}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                  >
                    <LogOut className="size-4 text-primary" />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              ) : null}
            </div>
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
            />

            <ResultsTable
              entityName={selectedEntity?.name ?? selectedEntityName}
              columns={resultColumns}
              debugResponses={resultDebugResponses}
              rows={resultRows}
            />
            <ActionOutput activity={activityEntries} />
          </div>
        </div>
      </section>
    </main>
  );
}
