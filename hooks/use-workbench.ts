"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { workbenchService } from "@/services/workbenchService";
import type {
  WorkbenchColumn,
  WorkbenchDebugResponse,
  WorkbenchPageInfo,
  WorkbenchRow,
  WorkbenchTemplate,
} from "@/types/workbench";

const snapshot = workbenchService.getSnapshot();
const defaultEntity = snapshot.entities[0]?.name ?? "";

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
  const [selectedEntityName, setSelectedEntityName] = useState(defaultEntity);
  const [queryText, setQueryText] = useState(
    buildTemplateQuery(snapshot.templates[0], defaultEntity),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [previewingEntityName, setPreviewingEntityName] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState(
    snapshot.templates[0]?.id ?? "",
  );
  const [entities, setEntities] = useState(snapshot.entities);
  const [templates, setTemplates] = useState(snapshot.templates);
  const [rowsByEntity, setRowsByEntity] = useState(snapshot.rowsByEntity);
  const [activityEntries, setActivityEntries] = useState(snapshot.activity);
  const [resultRows, setResultRows] = useState(
    snapshot.rowsByEntity[defaultEntity] ?? [],
  );
  const [resultColumns, setResultColumns] = useState(
    buildFallbackColumns(snapshot.rowsByEntity[defaultEntity] ?? []),
  );
  const [resultDebugResponses, setResultDebugResponses] = useState<
    WorkbenchDebugResponse[]
  >([]);
  const [resultPageInfo, setResultPageInfo] = useState<WorkbenchPageInfo>(
    buildLocalPageInfo(snapshot.rowsByEntity[defaultEntity] ?? []),
  );
  const [resultSource, setResultSource] = useState<ResultSource>({
    type: "query",
  });
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const operationRef = useRef(0);
  const resultContextRef = useRef<ResultContext | null>(null);
  const pageCacheRef = useRef(new Map<string, ResultPageCacheEntry>());

  useEffect(() => {
    let isMounted = true;

    async function loadSnapshot() {
      setIsLoadingSnapshot(true);

      try {
        const { snapshot: liveSnapshot, isLive } =
          await workbenchService.loadSnapshot();

        if (!isMounted) {
          return;
        }

        setLoadError(
          isLive
            ? null
            : "Unable to load live SAP data. Falling back to sample data.",
        );
        setEntities(liveSnapshot.entities);
        setTemplates(liveSnapshot.templates);
        setRowsByEntity(liveSnapshot.rowsByEntity);
        setActivityEntries(liveSnapshot.activity);

        if (liveSnapshot.entities.length > 0) {
          setSelectedEntityName((currentName) => {
            const nextName = liveSnapshot.entities.some(
              (entity) => entity.name === currentName,
            )
              ? currentName
              : liveSnapshot.entities[0].name;

            const nextTemplate = liveSnapshot.templates[0];

            if (nextTemplate) {
              setQueryText(buildTemplateQuery(nextTemplate, nextName));
            }

            const nextRows = liveSnapshot.rowsByEntity[nextName] ?? [];
            setResultRows(nextRows);
            setResultColumns(buildFallbackColumns(nextRows));
            setResultDebugResponses([]);
            setResultPageInfo(buildLocalPageInfo(nextRows));

            return nextName;
          });
        } else {
          setSelectedEntityName("");
          setQueryText("");
          setResultRows([]);
          setResultColumns([]);
          setResultDebugResponses([]);
          setResultPageInfo(buildLocalPageInfo([]));
        }
      } catch (err) {
        if (getErrorStatus(err) === 401) {
          setNeedLogin(true);
          setIsLoadingSnapshot(false);
          return;
        }

        // fallback to prior behavior
        const { snapshot: liveSnapshot, isLive } =
          await workbenchService.loadSnapshot();

        if (!isMounted) {
          return;
        }

        setLoadError(
          isLive
            ? null
            : "Unable to load live SAP data. Falling back to sample data.",
        );
        setEntities(liveSnapshot.entities);
        setTemplates(liveSnapshot.templates);
        setRowsByEntity(liveSnapshot.rowsByEntity);
        setActivityEntries(liveSnapshot.activity);
      }
      setIsLoadingSnapshot(false);
    }

    void loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.name === selectedEntityName),
    [entities, selectedEntityName],
  );

  const queryTemplates = templates;

  const metrics = useMemo(() => {
    const entityCount = entities.length;
    const rowCount = resultRows.length;

    return snapshot.metrics.map((metric) => {
      if (metric.label === "Entity sets") {
        return {
          ...metric,
          value: String(entityCount),
        };
      }

      if (metric.label === "Saved templates") {
        return {
          ...metric,
          value: String(queryTemplates.length),
        };
      }

      if (metric.label === "Proxy status") {
        return {
          ...metric,
          value: isLoadingSnapshot
            ? "Loading"
            : isRunning
              ? "Running"
              : "Ready",
          detail: isLoadingSnapshot
            ? (loadError ??
              "Loading live entity sets from /api/sap/opu/odata/sap/ZSQLWB_ODATA_SRV")
            : isRunning
              ? "Refreshing the current preview"
              : `Showing ${rowCount} preview rows`,
        };
      }

      return metric;
    });
  }, [
    entities.length,
    isLoadingSnapshot,
    isRunning,
    loadError,
    queryTemplates.length,
    resultRows.length,
  ]);

  function handleEntityChange(entityName: string) {
    setSelectedEntityName(entityName);
    resultContextRef.current = null;
    pageCacheRef.current.clear();

    const nextTemplate =
      snapshot.templates.find((template) => template.id === activeTemplateId) ??
      snapshot.templates[0];
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

  function runQuery(page = 1) {
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    setIsRunning(true);

    void (async () => {
      try {
        const execution = await workbenchService.executeQuery(
          queryText,
          selectedEntityName,
          entities.map((entity) => entity.name),
          page,
          {
            onProgress: (progress) => {
              if (operationRef.current !== operationId) {
                return;
              }

              setResultRows(progress.rows);
              setResultColumns(progress.columns);
              setResultDebugResponses(progress.debugResponses);
              setResultPageInfo(progress.pageInfo);
              setResultSource({ type: "query" });
              setSelectedEntityName(progress.entitySetName);
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
        setResultSource({ type: "query" });
        setSelectedEntityName(execution.entitySetName);
        setResultContext(execution, { type: "query" });

        const context = resultContextRef.current;
        if (context) {
          prefetchResultPage(context, execution.pageInfo.page + 1);
        }

        setActivityEntries((currentEntries) => [
          {
            id: `activity-${Date.now()}`,
            title: `Query executed for ${execution.entitySetName}`,
            detail: execution.isCountQuery
              ? `Counted ${execution.rows[0]?.RecordCount ?? 0} records through ${execution.queryPath}`
              : `Loaded page ${execution.pageInfo.page} with ${execution.rows.length} rows through ${execution.queryPath}`,
            timestampRaw: "/Date(1716496400000)/",
            tone: "success",
          },
          ...currentEntries,
        ]);
      } catch (error) {
        if (operationRef.current !== operationId) {
          return;
        }

        // If auth error, prompt for login
        if (getErrorStatus(error) === 401) {
          setNeedLogin(true);
        }
        setResultDebugResponses([]);
        setActivityEntries((currentEntries) => [
          {
            id: `activity-${Date.now()}`,
            title: `Query failed for ${selectedEntityName}`,
            detail:
              error instanceof Error
                ? error.message
                : "Unable to execute live OData query.",
            timestampRaw: "/Date(1716496400000)/",
            tone: "error",
          },
          ...currentEntries,
        ]);
      } finally {
        if (operationRef.current === operationId) {
          setIsRunning(false);
        }
      }
    })();
  }

  function previewTable(entityName: string, page = 1) {
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    setSelectedEntityName(entityName);
    setIsRunning(true);
    setPreviewingEntityName(entityName);

    void (async () => {
      try {
        const execution = await workbenchService.previewTable(
          entityName,
          undefined,
          page,
          {
            onProgress: (progress) => {
              if (operationRef.current !== operationId) {
                return;
              }

              setResultRows(progress.rows);
              setResultColumns(progress.columns);
              setResultDebugResponses(progress.debugResponses);
              setResultPageInfo(progress.pageInfo);
              setResultSource({ type: "preview", entityName });
              setSelectedEntityName(progress.entitySetName);
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
        setResultSource({ type: "preview", entityName });
        setSelectedEntityName(execution.entitySetName);
        setResultContext(execution, { type: "preview", entityName });

        const context = resultContextRef.current;
        if (context) {
          prefetchResultPage(context, execution.pageInfo.page + 1);
        }

        setActivityEntries((currentEntries) => [
          {
            id: `activity-${Date.now()}`,
            title: `Preview loaded for ${execution.entitySetName}`,
            detail: `Loaded preview page ${execution.pageInfo.page} with ${execution.rows.length} rows through ${execution.queryPath}`,
            timestampRaw: "/Date(1716496400000)/",
            tone: "success",
          },
          ...currentEntries,
        ]);
      } catch (error) {
        if (operationRef.current !== operationId) {
          return;
        }

        if (getErrorStatus(error) === 401) {
          setNeedLogin(true);
        }

        setResultDebugResponses([]);
        setActivityEntries((currentEntries) => [
          {
            id: `activity-${Date.now()}`,
            title: `Preview failed for ${entityName}`,
            detail:
              error instanceof Error
                ? error.message
                : "Unable to preview the selected SAP table.",
            timestampRaw: "/Date(1716496400000)/",
            tone: "error",
          },
          ...currentEntries,
        ]);
      } finally {
        if (operationRef.current === operationId) {
          setIsRunning(false);
          setPreviewingEntityName("");
        }
      }
    })();
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
    setIsRunning(true);

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
        if (operationRef.current === operationId) {
          setIsRunning(false);
        }
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
    resultDebugResponses,
    resultPageInfo,
    resultRows,
    handleEntityChange,
    applyTemplate,
    runQuery,
    previewTable,
    loadResultPage,
  };
}
