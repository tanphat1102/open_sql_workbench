"use client";

import { useMemo, useState } from "react";

import { workbenchService } from "@/services/workbenchService";
import type { WorkbenchTemplate } from "@/types/workbench";

const snapshot = workbenchService.getSnapshot();
const defaultEntity = snapshot.entities[0]?.name ?? "";

function buildTemplateQuery(template: WorkbenchTemplate, entityName: string) {
  return template.query.replace("<entity>", entityName);
}

export function useWorkbench() {
  const [selectedEntityName, setSelectedEntityName] = useState(defaultEntity);
  const [queryText, setQueryText] = useState(
    buildTemplateQuery(snapshot.templates[0], defaultEntity),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState(
    snapshot.templates[0]?.id ?? "",
  );
  const [activityEntries, setActivityEntries] = useState(snapshot.activity);
  const [resultRows, setResultRows] = useState(
    workbenchService.getRowsForEntity(defaultEntity),
  );

  const selectedEntity = useMemo(
    () =>
      snapshot.entities.find((entity) => entity.name === selectedEntityName),
    [selectedEntityName],
  );

  const queryTemplates = snapshot.templates;

  const metrics = useMemo(() => {
    const entityCount = snapshot.entities.length;
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
          value: isRunning ? "Running" : "Ready",
          detail: isRunning
            ? "Compiling the current query preview"
            : `Showing ${rowCount} preview rows`,
        };
      }

      return metric;
    });
  }, [isRunning, queryTemplates.length, resultRows.length]);

  function handleEntityChange(entityName: string) {
    setSelectedEntityName(entityName);

    const nextTemplate =
      snapshot.templates.find((template) => template.id === activeTemplateId) ??
      snapshot.templates[0];
    if (nextTemplate) {
      setQueryText(buildTemplateQuery(nextTemplate, entityName));
    }

    setResultRows(workbenchService.getRowsForEntity(entityName));
  }

  function applyTemplate(template: WorkbenchTemplate) {
    setActiveTemplateId(template.id);
    setQueryText(buildTemplateQuery(template, selectedEntityName));
  }

  function runQuery() {
    setIsRunning(true);

    const nextRows = workbenchService.getRowsForEntity(selectedEntityName);
    setResultRows(nextRows);
    setActivityEntries((currentEntries) => [
      {
        id: `activity-${Date.now()}`,
        title: `Query executed for ${selectedEntityName}`,
        detail: `Loaded ${nextRows.length} rows through the local workbench seed.`,
        timestampRaw: "/Date(1716496400000)/",
        tone: "success",
      },
      ...currentEntries,
    ]);

    setIsRunning(false);
  }

  return {
    metrics,
    selectedEntity,
    selectedEntityName,
    entities: snapshot.entities,
    templates: queryTemplates,
    queryText,
    setQueryText,
    isRunning,
    activityEntries,
    resultRows,
    handleEntityChange,
    applyTemplate,
    runQuery,
  };
}
