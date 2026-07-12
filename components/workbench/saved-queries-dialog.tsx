"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, LoaderCircle, Pencil, Play, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sqlAssistService } from "@/services/sqlAssistService";
import { toast } from "@/lib/toast";
import type { SapSqlwbSavedQuery } from "@/types/sap";

type SavedQueriesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQueryText: string;
  currentUser?: string;
  onLoadQuery: (queryText: string) => void;
  onRunQuery?: () => void;
};

export function SavedQueriesDialog({
  open,
  onOpenChange,
  currentQueryText,
  currentUser,
  onLoadQuery,
  onRunQuery,
}: SavedQueriesDialogProps) {
  const [queries, setQueries] = useState<SapSqlwbSavedQuery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveQueryText, setSaveQueryText] = useState("");
  const [saveVisibility, setSaveVisibility] = useState("PRIVATE");
  const [saveTags, setSaveTags] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  // Edit mode: when not null, updating an existing query
  const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refetchQueries() {
    setIsLoading(true);
    setError(null);
    sqlAssistService
      .listSavedQueries()
      .then(setQueries)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load saved queries.",
        ),
      )
      .finally(() => setIsLoading(false));
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setShowSaveForm(false);
    setSaveQueryText("");
    setIsLoading(true);
    setError(null);
    sqlAssistService
      .listSavedQueries()
      .then(setQueries)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load saved queries.",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSave() {
    if (!saveName.trim() || !saveQueryText.trim()) return;
    setIsSaving(true);
    try {
      const common = {
        queryName: saveName.trim(),
        queryText: saveQueryText,
        visibility: saveVisibility,
        tags: saveTags.trim(),
        description: saveDescription.trim(),
      };
      const result = editingQueryId
        ? await sqlAssistService.updateSavedQuery({
            ...common,
            queryId: editingQueryId,
          })
        : await sqlAssistService.saveQuery(common);

      const action = editingQueryId ? "Updated" : "Saved";
      if (result.Status === "SUCCESS") {
        toast({
          title: `Query ${action.toLowerCase()}`,
          description: saveName,
          variant: "success",
        });
        setShowSaveForm(false);
        setEditingQueryId(null);
        setSaveName("");
        setSaveTags("");
        setSaveDescription("");
        refetchQueries();
      } else {
        toast({
          title: `${action} failed`,
          description: result.ErrorText || result.ErrorCode || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: editingQueryId ? "Update failed" : "Save failed",
        description:
          err instanceof Error ? err.message : "Unable to save query.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(queryId: string, queryName: string) {
    if (!queryId) return;
    setDeletingId(queryId);
    try {
      await sqlAssistService.deleteSavedQuery(queryId);
      setQueries((prev) => prev.filter((q) => q.QueryId !== queryId));
      toast({ title: "Deleted", description: queryName });
    } catch {
      toast({
        title: "Delete failed",
        description: "The backend may not support DELETE yet.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-border bg-[#f7fbff] px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                <Bookmark className="size-4 text-primary" />
                Saved Queries
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Save, load, and manage your SQL queries
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {currentQueryText.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSaveForm((v) => {
                      if (!v) {
                        setEditingQueryId(null);
                        setSaveQueryText(currentQueryText);
                      }
                      return !v;
                    });
                  }}
                  className="border-border text-primary"
                >
                  <Bookmark className="size-3.5" />
                  {showSaveForm ? "Cancel" : "Save Current"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogHeader>

        {showSaveForm ? (
          <div className="space-y-3 border-b border-border bg-accent/30 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                SQL Text
              </label>
              <textarea
                value={saveQueryText}
                onChange={(e) => setSaveQueryText(e.target.value)}
                className="h-16 w-full resize-y rounded border border-input bg-white px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
                placeholder="SELECT * FROM ..."
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Query Name *
                </label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My query"
                  className="h-8"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Visibility
                </label>
                <Select
                  value={saveVisibility}
                  onValueChange={setSaveVisibility}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                    <SelectItem value="SHARED">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Tags
                </label>
                <Input
                  value={saveTags}
                  onChange={(e) => setSaveTags(e.target.value)}
                  placeholder="test, demo"
                  className="h-8"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <Input
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="What this query does"
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={!saveName.trim() || !saveQueryText.trim() || isSaving}
                className="bg-primary text-primary-foreground"
              >
                {isSaving ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
                {isSaving
                  ? "Saving..."
                  : editingQueryId
                    ? "Update Query"
                    : "Save Query"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3.5 w-1/2 animate-pulse rounded bg-accent" />
                    <div className="h-2.5 w-3/4 animate-pulse rounded bg-accent" />
                  </div>
                  <div className="h-7 w-7 animate-pulse rounded bg-accent" />
                  <div className="h-7 w-7 animate-pulse rounded bg-accent" />
                  <div className="h-7 w-7 animate-pulse rounded bg-accent" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-md text-center">
                {error}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchQueries()}
              >
                Retry
              </Button>
            </div>
          ) : queries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <div className="text-sm">No saved queries yet.</div>
              {currentQueryText.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSaveQueryText(currentQueryText);
                    setShowSaveForm(true);
                  }}
                >
                  Save current query
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {queries.filter(
                (q) =>
                  !q.Owner ||
                  !currentUser ||
                  q.Owner.toUpperCase() === currentUser.toUpperCase(),
              ).length > 0 ? (
                <div>
                  <div className="sticky top-0 z-10 border-b border-border bg-accent/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    My Queries
                  </div>
                  {queries
                    .filter(
                      (q) =>
                        !q.Owner ||
                        !currentUser ||
                        q.Owner.toUpperCase() === currentUser.toUpperCase(),
                    )
                    .map((q) => (
                      <div
                        key={q.QueryId}
                        className="flex items-start gap-3 px-4 py-3 transition hover:bg-accent/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {q.QueryName || "Unnamed"}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                q.Visibility === "SHARED"
                                  ? "border-sky-200 bg-sky-50 text-sky-700 text-[10px]"
                                  : "border-border text-muted-foreground text-[10px]"
                              }
                            >
                              {q.Visibility || "PRIVATE"}
                            </Badge>
                            {q.Tags?.split(",")
                              .filter(Boolean)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] text-muted-foreground"
                                >
                                  {tag.trim()}
                                </span>
                              ))}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {q.QueryText || "-"}
                          </div>
                          {q.Description ? (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {q.Description}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() =>
                              q.QueryText && onLoadQuery(q.QueryText)
                            }
                            disabled={!q.QueryText}
                            className="size-7 border-border text-primary hover:bg-accent"
                            title="Load into editor"
                          >
                            <Bookmark className="size-3.5" />
                          </Button>
                          {onRunQuery ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() => {
                                if (q.QueryText) {
                                  onLoadQuery(q.QueryText);
                                  setTimeout(() => onRunQuery(), 100);
                                }
                              }}
                              disabled={!q.QueryText}
                              className="size-7 border-border text-emerald-600 hover:bg-accent"
                              title="Load and run"
                            >
                              <Play className="size-3.5" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => {
                              setEditingQueryId(q.QueryId ?? null);
                              setSaveName(q.QueryName || "");
                              setSaveQueryText(q.QueryText || "");
                              setSaveVisibility(q.Visibility || "PRIVATE");
                              setSaveTags(q.Tags || "");
                              setSaveDescription(q.Description || "");
                              setShowSaveForm(true);
                            }}
                            className="size-7 border-border text-muted-foreground hover:text-primary"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() =>
                              q.QueryId && q.QueryName
                                ? void handleDelete(q.QueryId, q.QueryName)
                                : null
                            }
                            disabled={!q.QueryId || deletingId === q.QueryId}
                            className="size-7 border-border text-muted-foreground hover:border-destructive/30 hover:text-destructive"
                            title="Delete"
                          >
                            {deletingId === q.QueryId ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
              {queries.filter(
                (q) =>
                  q.Owner &&
                  currentUser &&
                  q.Owner.toUpperCase() !== currentUser.toUpperCase(),
              ).length > 0 ? (
                <div>
                  <div className="sticky top-0 z-10 border-b border-border bg-amber-50/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-amber-800">
                    Shared with me
                  </div>
                  {queries
                    .filter(
                      (q) =>
                        q.Owner &&
                        currentUser &&
                        q.Owner.toUpperCase() !== currentUser.toUpperCase(),
                    )
                    .map((q) => (
                      <div
                        key={q.QueryId}
                        className="flex items-start gap-3 px-4 py-3 transition hover:bg-accent/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {q.QueryName || "Unnamed"}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
                            >
                              SHARED
                            </Badge>
                            {q.Tags?.split(",")
                              .filter(Boolean)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] text-muted-foreground"
                                >
                                  {tag.trim()}
                                </span>
                              ))}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {q.QueryText || "-"}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            <span>By {q.Owner}</span>
                            {q.Description ? (
                              <span> · {q.Description}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() =>
                              q.QueryText && onLoadQuery(q.QueryText)
                            }
                            disabled={!q.QueryText}
                            className="size-7 border-border text-primary hover:bg-accent"
                            title="Load into editor"
                          >
                            <Bookmark className="size-3.5" />
                          </Button>
                          {onRunQuery ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() => {
                                if (q.QueryText) {
                                  onLoadQuery(q.QueryText);
                                  setTimeout(() => onRunQuery(), 100);
                                }
                              }}
                              disabled={!q.QueryText}
                              className="size-7 border-border text-emerald-600 hover:bg-accent"
                              title="Run with your profile permissions"
                            >
                              <Play className="size-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {queries.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border bg-[#f7fbff] px-5 py-2">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {queries.length}
              </span>{" "}
              saved quer{queries.length !== 1 ? "ies" : "y"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-border"
            >
              Close
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
