export type WorkbenchTemplate = {
  id: string;
  name: string;
  description: string;
  query: string;
};

export type WorkbenchEntity = {
  name: string;
  description: string;
  recordCount: number;
  keyFields: string[];
  tags: string[];
  lastSyncedRaw: string;
};

export type WorkbenchMetric = {
  label: string;
  value: string;
  detail: string;
};

export type WorkbenchRow = Record<string, string | number | boolean | null>;

export type WorkbenchActivity = {
  id: string;
  title: string;
  detail: string;
  timestampRaw: string;
  tone: "success" | "info" | "warning";
};

export type WorkbenchSnapshot = {
  metrics: WorkbenchMetric[];
  entities: WorkbenchEntity[];
  templates: WorkbenchTemplate[];
  rowsByEntity: Record<string, WorkbenchRow[]>;
  activity: WorkbenchActivity[];
};
