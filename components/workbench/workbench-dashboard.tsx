"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Sidebar,
  TableProperties,
  MessageSquareText,
  UserCircle,
} from "lucide-react";

import { EntityBrowser } from "@/components/workbench/entity-browser";
import { QueryWorkbench } from "@/components/workbench/query-workbench";
import { ResultsTable } from "@/components/workbench/results-table";
import { TablePropertiesDialog } from "@/components/workbench/table-properties-dialog";
import { SavedQueriesDialog } from "@/components/workbench/saved-queries-dialog";
import { ActionOutput } from "@/components/workbench/action-output";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkbench } from "@/hooks/use-workbench";
import { toast } from "@/lib/toast";
import { authService } from "@/services/authService";
import type { SapSessionInfo } from "@/types/sap";

type ResizeDragState =
  | {
      type: "objectExplorer";
      startX: number;
      startWidth: number;
    }
  | {
      type: "query";
      startY: number;
      startHeight: number;
      containerHeight: number;
    }
  | {
      type: "messages";
      startY: number;
      startHeight: number;
      containerHeight: number;
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function WorkbenchDashboard() {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SapSessionInfo | null>(null);
  const [showObjectExplorer, setShowObjectExplorer] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showFullscreenResults, setShowFullscreenResults] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const [propertiesEntityName, setPropertiesEntityName] = useState("");
  const [showSavedQueriesDialog, setShowSavedQueriesDialog] = useState(false);
  const [objectExplorerWidth, setObjectExplorerWidth] = useState(300);
  const [queryPanelHeight, setQueryPanelHeight] = useState(260);
  const [messagesPanelHeight, setMessagesPanelHeight] = useState(150);
  const [activeResize, setActiveResize] = useState<
    ResizeDragState["type"] | null
  >(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const lowerStackRef = useRef<HTMLDivElement | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);
  const {
    selectedEntity,
    selectedEntityName,
    entities,
    templates,
    queryText,
    setQueryText,
    isRunning,
    isLoadingSnapshot,
    activityEntries,
    resultColumns,
    resultDebugResponses,
    resultPageInfo,
    resultRows,
    previewingEntityName,
    handleEntityChange,
    applyTemplate,
    runQuery,
    previewTable,
    loadResultPage,
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

  function executeAndShowResults() {
    setShowResults(true);
    runQuery();
  }

  function handleShowProperties(entityName: string) {
    setPropertiesEntityName(entityName);
    setShowPropertiesDialog(true);
  }

  function setResultsFullscreen(open: boolean) {
    if (open) {
      setShowResults(true);
    }

    setShowFullscreenResults(open);
  }

  function beginObjectExplorerResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    resizeDragRef.current = {
      type: "objectExplorer",
      startX: event.clientX,
      startWidth: objectExplorerWidth,
    };
    setActiveResize("objectExplorer");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function beginQueryResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !workspaceRef.current) {
      return;
    }

    resizeDragRef.current = {
      type: "query",
      startY: event.clientY,
      startHeight: queryPanelHeight,
      containerHeight: workspaceRef.current.clientHeight,
    };
    setActiveResize("query");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function beginMessagesResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !lowerStackRef.current) {
      return;
    }

    resizeDragRef.current = {
      type: "messages",
      startY: event.clientY,
      startHeight: messagesPanelHeight,
      containerHeight: lowerStackRef.current.clientHeight,
    };
    setActiveResize("messages");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleResizeMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = resizeDragRef.current;

    if (!dragState) {
      return;
    }

    if (dragState.type === "objectExplorer") {
      setObjectExplorerWidth(
        clamp(
          dragState.startWidth + event.clientX - dragState.startX,
          220,
          560,
        ),
      );
    }

    if (dragState.type === "query") {
      setQueryPanelHeight(
        clamp(
          dragState.startHeight + event.clientY - dragState.startY,
          180,
          Math.max(220, dragState.containerHeight - 180),
        ),
      );
    }

    if (dragState.type === "messages") {
      setMessagesPanelHeight(
        clamp(
          dragState.startHeight - (event.clientY - dragState.startY),
          96,
          Math.max(120, dragState.containerHeight - 160),
        ),
      );
    }

    event.preventDefault();
  }

  function endResize(event: PointerEvent<HTMLDivElement>) {
    const dragState = resizeDragRef.current;

    if (!dragState) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resizeDragRef.current = null;
    setActiveResize(null);
  }

  const hasLowerPanel = showResults || showMessages;
  const isResizing = activeResize !== null;

  return (
    <main
      className={`fiori-page h-dvh overflow-hidden px-3 py-3 text-sm sm:px-4 ${
        isResizing ? "cursor-grabbing select-none" : ""
      }`}
    >
      <section className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col gap-3">
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
              Page {resultPageInfo.page || "-"}: {resultRows.length} rows
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowObjectExplorer((current) => !current)}
              className={
                showObjectExplorer
                  ? "border-primary/35 bg-accent text-primary hover:bg-accent"
                  : "border-[#b8d6ef] bg-white text-primary hover:bg-accent"
              }
            >
              <Sidebar />
              Object Explorer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowResults((current) => !current)}
              className={
                showResults
                  ? "border-primary/35 bg-accent text-primary hover:bg-accent"
                  : "border-[#b8d6ef] bg-white text-primary hover:bg-accent"
              }
            >
              <TableProperties />
              Results
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMessages((current) => !current)}
              className={
                showMessages
                  ? "border-primary/35 bg-accent text-primary hover:bg-accent"
                  : "border-[#b8d6ef] bg-white text-primary hover:bg-accent"
              }
            >
              <MessageSquareText />
              Messages
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

        <div className="flex min-h-0 flex-1">
          {showObjectExplorer ? (
            <aside
              className="min-h-0 shrink-0"
              style={{ width: `${objectExplorerWidth}px` }}
            >
              <EntityBrowser
                entities={entities}
                selectedEntityName={selectedEntityName}
                onSelectEntity={handleEntityChange}
                onPreviewEntity={(entityName) => {
                  setShowResults(true);
                  previewTable(entityName);
                }}
                previewingEntityName={previewingEntityName}
                onShowProperties={handleShowProperties}
                isLoading={isLoadingSnapshot}
                onClose={() => setShowObjectExplorer(false)}
              />
            </aside>
          ) : null}
          {showObjectExplorer ? (
            <div
              role="separator"
              aria-orientation="vertical"
              className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center"
              onPointerDown={beginObjectExplorerResize}
              onPointerMove={handleResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              title="Resize Object Explorer"
            >
              <div className="h-16 w-1 rounded-full bg-border transition group-hover:bg-primary/60" />
            </div>
          ) : null}

          <div
            ref={workspaceRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div
              data-testid="workbench-query-panel"
              data-ready={isLoadingSnapshot ? "false" : "true"}
              className={hasLowerPanel ? "min-h-0 shrink-0" : "min-h-0 flex-1"}
              style={
                hasLowerPanel ? { height: `${queryPanelHeight}px` } : undefined
              }
            >
              <QueryWorkbench
                selectedEntityName={selectedEntityName}
                entities={entities}
                queryText={queryText}
                templates={templates}
                isRunning={isRunning}
                onQueryTextChange={setQueryText}
                onSelectEntity={handleEntityChange}
                onApplyTemplate={applyTemplate}
                onRunQuery={executeAndShowResults}
                onOpenSavedQueries={() => setShowSavedQueriesDialog(true)}
                editorHeight="100%"
              />
            </div>

            {hasLowerPanel ? (
              <div
                role="separator"
                aria-orientation="horizontal"
                className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center"
                onPointerDown={beginQueryResize}
                onPointerMove={handleResizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                title="Resize Query and lower panel"
              >
                <div className="h-1 w-16 rounded-full bg-border transition group-hover:bg-primary/60" />
              </div>
            ) : null}

            {showResults && showMessages ? (
              <div ref={lowerStackRef} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1">
                  <ResultsTable
                    entityName={selectedEntity?.name ?? selectedEntityName}
                    columns={resultColumns}
                    debugResponses={resultDebugResponses}
                    pageInfo={resultPageInfo}
                    rows={resultRows}
                    isFullscreen={false}
                    isLoading={isRunning}
                    onFullscreenChange={setResultsFullscreen}
                    onPageChange={loadResultPage}
                    onClose={() => setShowResults(false)}
                  />
                </div>
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center"
                  onPointerDown={beginMessagesResize}
                  onPointerMove={handleResizeMove}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}
                  title="Resize Results and Messages"
                >
                  <div className="h-1 w-16 rounded-full bg-border transition group-hover:bg-primary/60" />
                </div>
                <div
                  className="min-h-0 shrink-0"
                  style={{ height: `${messagesPanelHeight}px` }}
                >
                  <ActionOutput
                    activity={activityEntries}
                    onClose={() => setShowMessages(false)}
                  />
                </div>
              </div>
            ) : showResults ? (
              <div className="min-h-0 flex-1">
                <ResultsTable
                  entityName={selectedEntity?.name ?? selectedEntityName}
                  columns={resultColumns}
                  debugResponses={resultDebugResponses}
                  pageInfo={resultPageInfo}
                  rows={resultRows}
                  isFullscreen={false}
                  isLoading={isRunning}
                  onFullscreenChange={setResultsFullscreen}
                  onPageChange={loadResultPage}
                  onClose={() => setShowResults(false)}
                />
              </div>
            ) : showMessages ? (
              <div className="min-h-0 flex-1">
                <ActionOutput
                  activity={activityEntries}
                  onClose={() => setShowMessages(false)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <Dialog
        open={showFullscreenResults}
        onOpenChange={setShowFullscreenResults}
      >
        <DialogContent
          className="flex h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none flex-col gap-0 overflow-hidden rounded-lg p-0"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Fullscreen Results</DialogTitle>
          <DialogDescription className="sr-only">
            Fullscreen data preview for the current result set.
          </DialogDescription>
          <ResultsTable
            entityName={selectedEntity?.name ?? selectedEntityName}
            columns={resultColumns}
            debugResponses={resultDebugResponses}
            pageInfo={resultPageInfo}
            rows={resultRows}
            isFullscreen
            isLoading={isRunning}
            onFullscreenChange={setResultsFullscreen}
            onPageChange={loadResultPage}
          />
        </DialogContent>
      </Dialog>
      <TablePropertiesDialog
        open={showPropertiesDialog}
        onOpenChange={setShowPropertiesDialog}
        entityName={propertiesEntityName}
        entityType={selectedEntity?.tags[1]}
        entityDescription={selectedEntity?.description}
      />
      <SavedQueriesDialog
        open={showSavedQueriesDialog}
        onOpenChange={setShowSavedQueriesDialog}
        currentQueryText={queryText}
        currentUser={sessionInfo?.user}
        onLoadQuery={setQueryText}
        onRunQuery={executeAndShowResults}
      />
    </main>
  );
}
