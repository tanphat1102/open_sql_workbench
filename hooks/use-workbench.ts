"use client";

import { useEffect, useMemo, useState } from "react";

import { validateOpenSql } from "@/lib/openSqlValidation";
import { workbenchService } from "@/services/workbenchService";
import type {
  WorkbenchColumn,
  WorkbenchDebugResponse,
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
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

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

            return nextName;
          });
        } else {
          setSelectedEntityName("");
          setQueryText("");
          setResultRows([]);
          setResultColumns([]);
          setResultDebugResponses([]);
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
  }

  function applyTemplate(template: WorkbenchTemplate) {
    setActiveTemplateId(template.id);
    setQueryText(buildTemplateQuery(template, selectedEntityName));
  }

  function runQuery() {
    const syntaxErrors = validateOpenSql(queryText, {
      availableEntityNames: entities.map((entity) => entity.name),
      validateEntityNames: false,
    });

    if (syntaxErrors.length > 0) {
      setActivityEntries((currentEntries) => [
        {
          id: `activity-${Date.now()}`,
          title: "Query syntax error",
          detail: syntaxErrors[0].message,
          timestampRaw: "/Date(1716496400000)/",
          tone: "warning",
        },
        ...currentEntries,
      ]);
      return;
    }

    setIsRunning(true);

    void (async () => {
      try {
        const execution = await workbenchService.executeQuery(
          queryText,
          selectedEntityName,
          entities.map((entity) => entity.name),
        );

        setResultRows(execution.rows);
        setResultColumns(execution.columns);
        setResultDebugResponses(execution.debugResponses);
        setSelectedEntityName(execution.entitySetName);

        setActivityEntries((currentEntries) => [
          {
            id: `activity-${Date.now()}`,
            title: `Query executed for ${execution.entitySetName}`,
            detail: execution.isCountQuery
              ? `Counted ${execution.rows[0]?.RecordCount ?? 0} records through ${execution.queryPath}`
              : `Loaded ${execution.rows.length} rows through ${execution.queryPath}`,
            timestampRaw: "/Date(1716496400000)/",
            tone: "success",
          },
          ...currentEntries,
        ]);
      } catch (error) {
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
            tone: "warning",
          },
          ...currentEntries,
        ]);
      } finally {
        setIsRunning(false);
      }
    })();
  }

  function previewTable(entityName: string) {
    setSelectedEntityName(entityName);
    setIsRunning(true);
    setPreviewingEntityName(entityName);

    void (async () => {
      try {
        const execution = await workbenchService.previewTable(entityName, 20);

        setResultRows(execution.rows);
        setResultColumns(execution.columns);
        setResultDebugResponses(execution.debugResponses);
        setSelectedEntityName(execution.entitySetName);

        setActivityEntries((currentEntries) => [
          {
            id: `activity-${Date.now()}`,
            title: `Preview loaded for ${execution.entitySetName}`,
            detail: `Loaded ${execution.rows.length} preview rows through ${execution.queryPath}`,
            timestampRaw: "/Date(1716496400000)/",
            tone: "success",
          },
          ...currentEntries,
        ]);
      } catch (error) {
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
            tone: "warning",
          },
          ...currentEntries,
        ]);
      } finally {
        setIsRunning(false);
        setPreviewingEntityName("");
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
    setQueryText,
    isRunning,
    previewingEntityName,
    isLoadingSnapshot,
    loadError,
    needLogin,
    setNeedLogin,
    activityEntries,
    resultColumns,
    resultDebugResponses,
    resultRows,
    handleEntityChange,
    applyTemplate,
    runQuery,
    previewTable,
  };
}
