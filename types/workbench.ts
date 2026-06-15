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

export type WorkbenchColumn = {
  key: string;
  fieldName: string;
  label: string;
  position: number;
  abapType?: string;
  length?: number;
  decimals?: number;
  isKey?: boolean;
};

export type WorkbenchMetric = {
  label: string;
  value: string;
  detail: string;
};

export type WorkbenchRow = Record<string, string | number | boolean | null>;

export type WorkbenchPageInfo = {
  resultId?: string;
  rowCount: number;
  returnedRows: number;
  totalRows: number;
  maxRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  truncated: boolean;
};

export type WorkbenchActivity = {
  id: string;
  title: string;
  detail: string;
  timestampRaw: string;
  tone: "success" | "info" | "warning" | "error";
};

export type WorkbenchDebugResponse = {
  label: string;
  path: string;
  status: number;
  contentLength: string;
  upstreamContentLength: string;
  upstreamContentType: string;
  proxyBytes: string;
  receivedChars: number;
  receivedBytes: number;
  summary: string;
  body: string;
};

export type WorkbenchSnapshot = {
  metrics: WorkbenchMetric[];
  entities: WorkbenchEntity[];
  templates: WorkbenchTemplate[];
  rowsByEntity: Record<string, WorkbenchRow[]>;
  activity: WorkbenchActivity[];
};
