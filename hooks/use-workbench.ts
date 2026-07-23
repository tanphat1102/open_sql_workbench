"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { workbenchService } from "@/services/workbenchService";
import { getErrorCodeLabel } from "@/lib/sapParser";
import { toast } from "@/lib/toast";
import type {
  WorkbenchActivity,
  WorkbenchColumn,
  WorkbenchDebugResponse,
  WorkbenchPageInfo,
  WorkbenchRow,
  WorkbenchTemplate,
} from "@/types/workbench";

function buildTemplateQuery(template: WorkbenchTemplate, entityName: string) {
  return template.query.replace("<entity>", entityName);
}

function buildFallbackColumns(rows: WorkbenchRow[]): WorkbenchColumn[] {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).map(
    (key, index) => ({
      key,
      fieldName: key,
      label: key,
      position: index + 1,
    }),
  );
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}

function getErrorDetail(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  const parts = [error.message];
  const extra = error as unknown as Record<string, unknown>;

  if (typeof extra.sapStatus === "string" && extra.sapStatus) {
    parts.push(`SAP Status: ${extra.sapStatus}`);
  }
  if (typeof extra.sapErrorCode === "string" && extra.sapErrorCode) {
    const label = getErrorCodeLabel(extra.sapErrorCode);
    parts.push(label !== extra.sapErrorCode ? `${label} (${extra.sapErrorCode})` : `Error Code: ${extra.sapErrorCode}`);
  }

  return parts.join("\n");
}

function buildLocalPageInfo(rows: WorkbenchRow[]): WorkbenchPageInfo {
  return {
    rowCount: rows.length,
    returnedRows: rows.length,
    totalRows: rows.length,
    maxRows: rows.length,
    page: rows.length > 0 ? 1 : 0,
    pageSize: rows.length,
    totalPages: rows.length > 0 ? 1 : 0,
    truncated: false,
  };
}

type ResultSource =
  | { type: "query" }
  | { type: "preview"; entityName: string };

type ResultPageCacheEntry = {
  rows: WorkbenchRow[];
  debugResponses: WorkbenchDebugResponse[];
  pageInfo: WorkbenchPageInfo;
};

type ResultContext = {
  resultId: string;
  cacheKey: string;
  source: ResultSource;
  queryText: string;
  entitySetName: string;
  columns: WorkbenchColumn[];
  pageInfo: WorkbenchPageInfo;
  queryPath: string;
  isCountQuery: boolean;
};

function getResultCacheKey(source: ResultSource, queryText: string) {
  return source.type === "preview"
    ? `preview:${source.entityName}`
    : `query:${queryText.trim()}`;
}

function getResultPageCacheKey(cacheKey: string, page: number) {
  return `${cacheKey}:${page}`;
}

export function useWorkbench() {
  const [selectedEntityName, setSelectedEntityName] = useState("");
  const [queryText, setQueryText] = useState("");
  const [previewingEntityName, setPreviewingEntityName] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [resultRows, setResultRows] = useState<WorkbenchRow[]>([]);
  const [resultColumns, setResultColumns] = useState<WorkbenchColumn[]>([]);
  const [resultDebugResponses, setResultDebugResponses] = useState<
    WorkbenchDebugResponse[]
  >([]);
  const [resultPageInfo, setResultPageInfo] = useState<WorkbenchPageInfo>(
    buildLocalPageInfo([]),
  );
  const [resultSource, setResultSource] = useState<ResultSource>({
    type: "query",
  });
  const [needLogin, setNeedLogin] = useState(false);
  const [activityEntries, setActivityEntries] = useState<WorkbenchActivity[]>([]);
  const operationRef = useRef(0);
  const resultContextRef = useRef<ResultContext | null>(null);
  const pageCacheRef = useRef(new Map<string, ResultPageCacheEntry>());
  const queryTextOverrideRef = useRef<string | null>(null);
  const entitiesInitializedRef = useRef(false);

  const {
    data: snapshot,
    isLoading: isLoadingSnapshot,
    error: snapshotError,
  } = useQuery({
    queryKey: ["snapshot"],
    queryFn: async () => {
      const { snapshot: live, isLive } = await workbenchService.loadSnapshot();
      if (live.entities.length === 0) {
        const pkg = process.env.NEXT_PUBLIC_SAP_PACKAGE ?? "unknown";
        throw new Error(
          isLive
            ? `No tables returned from ${pkg} for profile "${process.env.NEXT_PUBLIC_SQLWB_PROFILE_ID ?? "DEV"}". Check whitelist configuration.`
            : `Cannot connect to SAP package ${pkg}. Check SAP_PACKAGE and connection.`,
        );
      }
      return { ...live, isLive };
    },
    staleTime: 60_000,
  });

  const entities = snapshot?.entities ?? [];
  const templates = snapshot?.templates ?? [];
  const rowsByEntity = snapshot?.rowsByEntity ?? {};
  const loadError = snapshotError
    ? snapshotError instanceof Error
      ? snapshotError.message
      : "Failed to load SAP data"
    : snapshot?.isLive === false
      ? "Unable to load live SAP data."
      : null;

  // Toast on snapshot load errors
  useEffect(() => {
    if (snapshotError) {
      const msg =
        snapshotError instanceof Error
          ? snapshotError.message
          : "Failed to load SAP entity data.";
      toast({ title: "Connection error", description: msg.slice(0, 200), variant: "destructive" });
    }
  }, [snapshotError]);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Initialize entity selection and activity from first snapshot load
  useEffect(() => {
    if (entities.length === 0 || entitiesInitializedRef.current) return;
    entitiesInitializedRef.current = true;

    const defaultEntity = entities[0].name;
    const defaultTemplate = templates[0];
    setSelectedEntityName(defaultEntity);
    setActiveTemplateId(defaultTemplate?.id ?? "");
    setQueryText(
      defaultTemplate
        ? buildTemplateQuery(defaultTemplate, defaultEntity)
        : "",
    );
    const defaultRows = rowsByEntity[defaultEntity] ?? [];
    setResultRows(defaultRows);
    setResultColumns(buildFallbackColumns(defaultRows));

    if (snapshot?.activity.length) {
      setActivityEntries(snapshot.activity);
    }
  }, [entities, templates, rowsByEntity, snapshot]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.name === selectedEntityName),
    [entities, selectedEntityName],
  );

  const queryTemplates = templates;

  function handleEntityChange(entityName: string) {
    setSelectedEntityName(entityName);
    resultContextRef.current = null;
    pageCacheRef.current.clear();

    const nextTemplate =
      templates.find((template) => template.id === activeTemplateId) ??
      templates[0];
    if (nextTemplate) {
      setQueryText(buildTemplateQuery(nextTemplate, entityName));
    }

    const nextRows = rowsByEntity[entityName] ?? [];
    setResultRows(nextRows);
    setResultColumns(buildFallbackColumns(nextRows));
    setResultDebugResponses([]);
    setResultPageInfo(buildLocalPageInfo(nextRows));
  }

  function applyTemplate(template: WorkbenchTemplate) {
    setActiveTemplateId(template.id);
    setQueryText(buildTemplateQuery(template, selectedEntityName));
    resultContextRef.current = null;
    pageCacheRef.current.clear();
  }

  function handleQueryTextChange(value: string) {
    setQueryText(value);
    // Override next runQuery with this exact text (supports selection-based execution)
    queryTextOverrideRef.current = value;
    resultContextRef.current = null;
    pageCacheRef.current.clear();
  }

  function cacheResultPage(
    cacheKey: string,
    pageInfo: WorkbenchPageInfo,
    rows: WorkbenchRow[],
    debugResponses: WorkbenchDebugResponse[],
  ) {
    if (!cacheKey || pageInfo.page < 1) {
      return;
    }

    pageCacheRef.current.set(getResultPageCacheKey(cacheKey, pageInfo.page), {
      rows,
      debugResponses,
      pageInfo,
    });
  }

  function setResultContext(
    execution: {
      entitySetName: string;
      columns: WorkbenchColumn[];
      debugResponses: WorkbenchDebugResponse[];
      isCountQuery: boolean;
      pageInfo: WorkbenchPageInfo;
      queryPath: string;
      rows: WorkbenchRow[];
    },
    source: ResultSource,
  ) {
    const resultId = execution.pageInfo.resultId;
    const cacheKey = getResultCacheKey(source, queryText);

    if (!resultId) {
      resultContextRef.current = null;
      pageCacheRef.current.clear();
      return;
    }

    if (resultContextRef.current?.cacheKey !== cacheKey) {
      pageCacheRef.current.clear();
    }

    resultContextRef.current = {
      resultId,
      cacheKey,
      source,
      queryText,
      entitySetName: execution.entitySetName,
      columns: execution.columns,
      pageInfo: execution.pageInfo,
      queryPath: execution.queryPath,
      isCountQuery: execution.isCountQuery,
    };
    cacheResultPage(
      cacheKey,
      execution.pageInfo,
      execution.rows,
      execution.debugResponses,
    );
  }

  function prefetchResultPage(context: ResultContext, page: number) {
    if (
      page < 1 ||
      (context.pageInfo.totalPages > 0 && page > context.pageInfo.totalPages)
    ) {
      return;
    }

    const pageCacheKey = getResultPageCacheKey(context.cacheKey, page);

    if (pageCacheRef.current.has(pageCacheKey)) {
      return;
    }

    const request =
      context.source.type === "preview"
        ? workbenchService.previewTable(
            context.source.entityName,
            undefined,
            page,
            { reuseColumns: context.columns },
          )
        : workbenchService.executeQuery(
            context.queryText,
            context.entitySetName,
            entities.map((entity) => entity.name),
            page,
            { reuseColumns: context.columns },
          );

    void request
      .then((execution) => {
        if (resultContextRef.current?.cacheKey !== context.cacheKey) {
          return;
        }

        cacheResultPage(
          context.cacheKey,
          execution.pageInfo,
          execution.rows,
          execution.debugResponses,
        );
      })
      .catch(() => {
        // Prefetch is opportunistic. User-triggered navigation will retry.
      });
  }

  type ExecuteVars = {
    type: "query" | "preview";
    queryText: string;
    entityName: string;
    page?: number;
  };

  const executeMutation = useMutation({
    onMutate: () => {
      // Clear stale results so user sees loading state, not old cached data
      setResultRows([]);
      setResultDebugResponses([]);
      resultContextRef.current = null;
      pageCacheRef.current.clear();
    },
    mutationFn: async ({ type, queryText: qText, entityName, page = 1 }: ExecuteVars) => {
      if (type === "preview") {
        return workbenchService.previewTable(entityName, undefined, page, {
          onProgress: (progress) => {
            setResultRows(progress.rows);
            setResultColumns(progress.columns);
            setResultDebugResponses(progress.debugResponses);
            setResultPageInfo(progress.pageInfo);
            setResultSource({ type: "preview", entityName });
            setSelectedEntityName(progress.entitySetName);
          },
        });
      }
      return workbenchService.executeQuery(
        qText,
        entityName,
        entities.map((e) => e.name),
        page,
        {
          onProgress: (progress) => {
            setResultRows(progress.rows);
            setResultColumns(progress.columns);
            setResultDebugResponses(progress.debugResponses);
            setResultPageInfo(progress.pageInfo);
            setResultSource({ type: "query" });
            setSelectedEntityName(progress.entitySetName);
          },
        },
      );
    },
    onSuccess: (execution, vars) => {
      setResultRows(execution.rows);
      setResultColumns(execution.columns);
      setResultDebugResponses(execution.debugResponses);
      setResultPageInfo(execution.pageInfo);
      setResultSource(
        vars.type === "preview"
          ? { type: "preview", entityName: vars.entityName }
          : { type: "query" },
      );
      setSelectedEntityName(execution.entitySetName);
      setResultContext(execution, vars.type === "preview" ? { type: "preview", entityName: vars.entityName } : { type: "query" });

      const context = resultContextRef.current;
      if (context) {
        prefetchResultPage(context, execution.pageInfo.page + 1);
      }

      const label = vars.type === "preview" ? "Preview loaded" : "Query executed";
      setActivityEntries((prev) => [
        {
          id: `activity-${Date.now()}`,
          title: `${label} for ${execution.entitySetName}`,
          detail: execution.isCountQuery
            ? `Counted ${execution.rows[0]?.RecordCount ?? 0} records through ${execution.queryPath}`
            : `Loaded page ${execution.pageInfo.page} with ${execution.rows.length} rows through ${execution.queryPath}`,
          timestampRaw: "/Date(1716496400000)/",
          tone: "success",
        },
        ...prev,
      ]);
    },
    onError: (error, vars) => {
      if (getErrorStatus(error) === 401) {
        setNeedLogin(true);
        return;
      }
      const detail = getErrorDetail(error, "Unable to execute live OData query.");
      const label = vars.type === "preview" ? "Preview failed" : "Query failed";
      toast({ title: label, description: detail.slice(0, 200), variant: "destructive" });
      setActivityEntries((prev) => [
        {
          id: `activity-${Date.now()}`,
          title: `${label} for ${vars.entityName}`,
          detail,
          timestampRaw: "/Date(1716496400000)/",
          tone: "error",
        },
        ...prev,
      ]);
    },
    onSettled: (_data, _error, vars) => {
      if (vars.type === "preview") {
        setPreviewingEntityName("");
      }
    },
  });

  const isRunning = executeMutation.isPending;

  const metrics = useMemo(() => {
    const entityCount = entities.length;
    const rowCount = resultRows.length;
    const pkg = process.env.NEXT_PUBLIC_SAP_PACKAGE!;

    return [
      { label: "Entity sets", value: String(entityCount), detail: `${entityCount} loaded` },
      { label: "Saved templates", value: String(queryTemplates.length), detail: "query patterns" },
      {
        label: "Proxy status",
        value: isLoadingSnapshot ? "Loading" : isRunning ? "Running" : "Ready",
        detail: isLoadingSnapshot
          ? `Loading entity sets from /api/sap/opu/odata/sap/${pkg}`
          : isRunning
            ? "Refreshing the current preview"
            : `Showing ${rowCount} preview rows`,
      },
    ];
  }, [
    entities.length,
    isLoadingSnapshot,
    isRunning,
    queryTemplates.length,
    resultRows.length,
  ]);

  function runQuery(page = 1) {
    const effectiveQuery = queryTextOverrideRef.current ?? queryText;
    queryTextOverrideRef.current = null;
    executeMutation.mutate({
      type: "query",
      queryText: effectiveQuery,
      entityName: selectedEntityName,
      page,
    });
  }

  function previewTable(entityName: string, page = 1) {
    setSelectedEntityName(entityName);
    setPreviewingEntityName(entityName);
    executeMutation.mutate({
      type: "preview",
      queryText: "",
      entityName,
      page,
    });
  }

  function loadResultPage(page: number) {
    if (page < 1 || (resultPageInfo.totalPages > 0 && page > resultPageInfo.totalPages)) {
      return;
    }

    const context = resultContextRef.current;

    if (!context || context.source.type !== resultSource.type) {
      if (resultSource.type === "preview") {
        previewTable(resultSource.entityName, page);
        return;
      }

      runQuery(page);
      return;
    }

    if (
      resultSource.type === "preview" &&
      (context.source.type !== "preview" ||
        context.source.entityName !== resultSource.entityName)
    ) {
      previewTable(resultSource.entityName, page);
      return;
    }

    const cachedPage = pageCacheRef.current.get(
      getResultPageCacheKey(context.cacheKey, page),
    );

    if (cachedPage) {
      setResultRows(cachedPage.rows);
      setResultColumns(context.columns);
      setResultDebugResponses(cachedPage.debugResponses);
      setResultPageInfo(cachedPage.pageInfo);
      prefetchResultPage(context, page + 1);
      return;
    }

    const operationId = operationRef.current + 1;
    operationRef.current = operationId;

    void (async () => {
      try {
        const execution =
          resultSource.type === "preview"
            ? await workbenchService.previewTable(
                resultSource.entityName,
                undefined,
                page,
                {
                  reuseColumns: context.columns,
                  onProgress: (progress) => {
                    if (operationRef.current !== operationId) {
                      return;
                    }

                    setResultRows(progress.rows);
                    setResultColumns(progress.columns);
                    setResultDebugResponses(progress.debugResponses);
                    setResultPageInfo(progress.pageInfo);
                  },
                },
              )
            : await workbenchService.executeQuery(
                context.queryText,
                context.entitySetName,
                entities.map((entity) => entity.name),
                page,
                {
                  reuseColumns: context.columns,
                  onProgress: (progress) => {
                    if (operationRef.current !== operationId) {
                      return;
                    }

                    setResultRows(progress.rows);
                    setResultColumns(progress.columns);
                    setResultDebugResponses(progress.debugResponses);
                    setResultPageInfo(progress.pageInfo);
                  },
                },
              );

        if (operationRef.current !== operationId) {
          return;
        }

        setResultRows(execution.rows);
        setResultColumns(execution.columns);
        setResultDebugResponses(execution.debugResponses);
        setResultPageInfo(execution.pageInfo);
        setResultContext(execution, context.source);
        cacheResultPage(
          context.cacheKey,
          execution.pageInfo,
          execution.rows,
          execution.debugResponses,
        );
        const nextContext = resultContextRef.current;
        if (nextContext) {
          prefetchResultPage(nextContext, page + 1);
        }
      } catch {
        if (operationRef.current !== operationId) {
          return;
        }

        if (resultSource.type === "preview") {
          previewTable(resultSource.entityName, page);
          return;
        }

        runQuery(page);
      } finally {
        // mutation handles loading state
      }
    })();
  }

  return {
    metrics,
    selectedEntity,
    selectedEntityName,
    entities,
    templates: queryTemplates,
    queryText,
    setQueryText: handleQueryTextChange,
    isRunning,
    previewingEntityName,
    isLoadingSnapshot,
    loadError,
    needLogin,
    setNeedLogin,
    activityEntries,
    resultColumns,
    resultPageInfo,
    resultRows,
    handleEntityChange,
    applyTemplate,
    runQuery,
    previewTable,
    loadResultPage,
  };
}
