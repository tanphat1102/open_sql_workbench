import type {
  WorkbenchActivity,
  WorkbenchColumn,
  WorkbenchDebugResponse,
  WorkbenchEntity,
  WorkbenchMetric,
  WorkbenchPageInfo,
  WorkbenchRow,
  WorkbenchSnapshot,
  WorkbenchTemplate,
} from "@/types/workbench";
import { jsonrepair } from "jsonrepair";
import { sapClient } from "@/services/sapClient";
import { sqlAssistService } from "@/services/sqlAssistService";
import type {
  SapODataEnvelope,
  SapPreviewTableEnvelope,
  SapRunQueryEnvelope,
  SapRunQueryResult,
  SapSqlwbColumn,
  SapSqlwbPageChunk,
  SapSqlwbTable,
} from "@/types/sap";

const servicePath = `opu/odata/sap/${process.env.NEXT_PUBLIC_SAP_PACKAGE ?? "ZSQLWB_ODATA_SRV"}`;
const queryProfileId = process.env.NEXT_PUBLIC_SQLWB_PROFILE_ID ?? "DEV";

const metrics: WorkbenchMetric[] = [
  {
    label: "Entity sets",
    value: "8",
    detail: "available in the demo catalog",
  },
  {
    label: "Saved templates",
    value: "5",
    detail: "reusable query patterns",
  },
  {
    label: "Proxy status",
    value: "Ready",
    detail: "requests routed through /api/sap",
  },
];

const entities: WorkbenchEntity[] = [
  {
    name: "ZCUSTOMER_SRV",
    description: "Customer master data with sales summary fields.",
    recordCount: 128,
    keyFields: ["CustomerId"],
    tags: ["Master Data", "Sales"],
    lastSyncedRaw: "/Date(1716200000000)/",
  },
  {
    name: "ZORDER_SRV",
    description: "Open order snapshot with status and amount values.",
    recordCount: 342,
    keyFields: ["OrderId"],
    tags: ["Transactions", "Fulfillment"],
    lastSyncedRaw: "/Date(1716286400000)/",
  },
  {
    name: "ZINVENTORY_SRV",
    description: "Warehouse stock levels by material and location.",
    recordCount: 96,
    keyFields: ["MaterialId", "Plant"],
    tags: ["Logistics", "Stock"],
    lastSyncedRaw: "/Date(1716372800000)/",
  },
  {
    name: "ZVENDOR_SRV",
    description: "Supplier directory and risk indicators.",
    recordCount: 64,
    keyFields: ["VendorId"],
    tags: ["Procurement", "Master Data"],
    lastSyncedRaw: "/Date(1716459200000)/",
  },
];

const templates: WorkbenchTemplate[] = [
  {
    id: "preview",
    name: "Preview top rows",
    description: "Load the first slice of the selected entity.",
    query: "SELECT TOP 25 * FROM <entity>",
  },
  {
    id: "counts",
    name: "Count records",
    description: "Produce a quick aggregate before drilling in.",
    query: "SELECT COUNT(*) FROM <entity>",
  },
  {
    id: "keys",
    name: "Inspect keys",
    description: "Show the identifier fields for the target object.",
    query: "DESCRIBE KEYS FOR <entity>",
  },
  {
    id: "freshness",
    name: "Check freshness",
    description: "Verify the latest synchronization metadata.",
    query: "SHOW LAST SYNC FOR <entity>",
  },
  {
    id: "filter",
    name: "Apply filter",
    description: "Start from a reusable filtered query shape.",
    query: "SELECT * FROM <entity> WHERE status = 'OPEN'",
  },
];

const rowsByEntity: Record<string, WorkbenchRow[]> = {
  ZCUSTOMER_SRV: [
    {
      CustomerId: "C-10023",
      CustomerName: "Northwind Consumer Products",
      Segment: "Retail",
      Revenue: 48210.25,
      Active: true,
    },
    {
      CustomerId: "C-10411",
      CustomerName: "Blue Peak Distribution",
      Segment: "Wholesale",
      Revenue: 38940.0,
      Active: true,
    },
    {
      CustomerId: "C-10987",
      CustomerName: "Metro Supply House",
      Segment: "Industrial",
      Revenue: 12988.45,
      Active: false,
    },
  ],
  ZORDER_SRV: [
    {
      OrderId: "O-88021",
      Status: "OPEN",
      Amount: 1125.5,
      Currency: "EUR",
      DeliveryDate: "2026-05-26",
    },
    {
      OrderId: "O-88045",
      Status: "IN PROCESS",
      Amount: 8420.0,
      Currency: "EUR",
      DeliveryDate: "2026-05-28",
    },
    {
      OrderId: "O-88112",
      Status: "BLOCKED",
      Amount: 212.75,
      Currency: "EUR",
      DeliveryDate: "2026-05-30",
    },
  ],
  ZINVENTORY_SRV: [
    {
      MaterialId: "MAT-4410",
      Plant: "1000",
      Available: 1280,
      Reserved: 240,
      Unit: "EA",
    },
    {
      MaterialId: "MAT-4411",
      Plant: "1000",
      Available: 540,
      Reserved: 85,
      Unit: "EA",
    },
    {
      MaterialId: "MAT-8821",
      Plant: "2000",
      Available: 92,
      Reserved: 11,
      Unit: "EA",
    },
  ],
  ZVENDOR_SRV: [
    {
      VendorId: "V-1020",
      VendorName: "Triton Components",
      Country: "DE",
      RiskScore: 18,
      Active: true,
    },
    {
      VendorId: "V-1044",
      VendorName: "Central Fabrication",
      Country: "CZ",
      RiskScore: 42,
      Active: true,
    },
    {
      VendorId: "V-1181",
      VendorName: "Eastern Logistics Group",
      Country: "PL",
      RiskScore: 63,
      Active: false,
    },
  ],
};

const activity: WorkbenchActivity[] = [
  {
    id: "activity-1",
    title: "Proxy connected",
    detail: "SAP cookies are forwarded through the Next.js route handler.",
    timestampRaw: "/Date(1716485600000)/",
    tone: "success",
  },
  {
    id: "activity-2",
    title: "Template applied",
    detail: "The preview query was prepared for the selected entity set.",
    timestampRaw: "/Date(1716489200000)/",
    tone: "info",
  },
  {
    id: "activity-3",
    title: "Schema refreshed",
    detail: "Entity metadata and key fields were reloaded for inspection.",
    timestampRaw: "/Date(1716492800000)/",
    tone: "warning",
  },
];

type SnapshotLoadResult = {
  snapshot: WorkbenchSnapshot;
  isLive: boolean;
};

type WorkbenchQueryExecution = {
  entitySetName: string;
  columns: WorkbenchColumn[];
  rows: WorkbenchRow[];
  debugResponses: WorkbenchDebugResponse[];
  queryPath: string;
  isCountQuery: boolean;
  pageInfo: WorkbenchPageInfo;
};

type WorkbenchQueryProgress = WorkbenchQueryExecution & {
  isFinal: boolean;
  loadedChunkCount: number;
};

type WorkbenchQueryOptions = {
  onProgress?: (progress: WorkbenchQueryProgress) => void;
  reuseColumns?: WorkbenchColumn[];
};

type EntityNameResolver = (entityName: string) => string;

function buildEntitySetPath(entitySetName: string) {
  return `${servicePath}/${entitySetName}?$format=json`;
}

function buildQueryPath(
  entitySetName: string,
  queryParams: Record<string, string | number | boolean | undefined>,
) {
  const searchParams = new URLSearchParams({ $format: "json" });

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  return `${servicePath}/${entitySetName}?${searchParams.toString()}`;
}

function buildRunQueryPath(queryText: string, page = 1) {
  const encodeODataFunctionString = (value: string) =>
    encodeURIComponent(value).replace(/'/g, "%27");
  const sqlText = queryText.replace(/\s+/g, " ").trim();
  const queryParts = [
    `ProfileId='${encodeODataFunctionString(queryProfileId)}'`,
    `SqlText='${encodeODataFunctionString(sqlText)}'`,
    `Page=${page}`,
  ];

  return `${servicePath}/RunQuery?${queryParts.join("&")}`;
}

function buildPreviewTablePath(objectName: string, maxRows = 100, page = 1) {
  const searchParams = new URLSearchParams({
    ProfileId: `'${queryProfileId}'`,
    ObjectName: `'${escapeODataStringLiteral(objectName)}'`,
    MaxRows: String(maxRows),
    Page: String(page),
  });

  return `${servicePath}/PreviewTable?${searchParams.toString()}`;
}

function escapeODataStringLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function buildFilteredSetPath(
  entitySetName: string,
  filter: string,
  extraParams: Record<string, string | number | undefined> = {},
) {
  const searchParams = new URLSearchParams({
    $format: "json",
    $filter: filter,
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  return `${servicePath}/${entitySetName}?${searchParams.toString()}`;
}

function buildColumnSetPath(
  resultId: string,
  options: { top: number; skip: number },
) {
  return buildFilteredSetPath(
    "SqlwbColumnSet",
    `ResultId eq '${escapeODataStringLiteral(resultId)}'`,
    {
      $select:
        "ResultId,Position,FieldName,JsonKey,Element,AbapType,Length,Decimals,IsKey,Label",
      $top: options.top,
      $skip: options.skip,
    },
  );
}

function buildPageChunkSetPath(
  resultId: string,
  page: number,
  options: { top: number; skip: number },
) {
  return buildFilteredSetPath(
    "SqlwbPageChunkSet",
    `ResultId eq '${escapeODataStringLiteral(resultId)}' and PageNo eq '${String(page)}'`,
    {
      $select: "ResultId,PageNo,ChunkNo,PayloadPart,PayloadLen,IsLastChunk",
      $top: options.top,
      $skip: options.skip,
    },
  );
}

function extractQueryEntityName(queryText: string, fallbackEntity: string) {
  const fromMatch = /\bFROM\s+([A-Z0-9_./-]+)/i.exec(queryText);

  return fromMatch?.[1] ?? fallbackEntity;
}

function createEntityNameResolver(
  availableEntityNames: string[],
): EntityNameResolver {
  const canonicalNames = new Map(
    availableEntityNames.map((name) => [name.toLowerCase(), name]),
  );

  return (entityName: string) => {
    const trimmedName = entityName.trim();

    if (!trimmedName) {
      return entityName;
    }

    return (
      canonicalNames.get(trimmedName.toLowerCase()) ??
      entityName
    );
  };
}

function parseSimpleFilterClause(filterClause: string) {
  return filterClause
    .replace(/\bAND\b/gi, " and ")
    .replace(/\bOR\b/gi, " or ")
    .replace(/<>|!=/g, " ne ")
    .replace(/>=/g, " ge ")
    .replace(/<=/g, " le ")
    .replace(/\bLIKE\b/gi, " like ")
    .replace(
      /\b([A-Z0-9_./-]+)\s*=\s*('(?:[^']|'{2})*'|[A-Z0-9_.-]+)/gi,
      "$1 eq $2",
    )
    .replace(/\b([A-Z0-9_./-]+)\s+like\s+('(?:[^']|'{2})*')/gi, "$1 like $2");
}

function parseWorkbenchQuery(
  queryText: string,
  fallbackEntity: string,
  resolveEntityName: EntityNameResolver = (entityName) => entityName,
): {
  entitySetName: string;
  queryParams: Record<string, string | number | boolean | undefined>;
  isCountQuery: boolean;
} {
  const upperQuery = queryText.toUpperCase();
  const entitySetName = resolveEntityName(
    extractQueryEntityName(queryText, fallbackEntity),
  );
  const queryParams: Record<string, string | number | boolean | undefined> = {};

  const topMatch = /\bTOP\s+(\d+)/i.exec(queryText);
  if (topMatch?.[1]) {
    queryParams.$top = Number(topMatch[1]);
  }

  const orderByMatch = /\bORDER\s+BY\s+(.+?)(?:\bLIMIT\b|$)/i.exec(queryText);
  if (orderByMatch?.[1]) {
    const orderByClause = orderByMatch[1].trim();
    if (orderByClause) {
      queryParams.$orderby = orderByClause;
    }
  }

  const whereMatch = /\bWHERE\s+(.+?)(?:\bORDER\s+BY\b|\bGROUP\s+BY\b|$)/i.exec(
    queryText,
  );
  if (whereMatch?.[1]) {
    queryParams.$filter = parseSimpleFilterClause(whereMatch[1].trim());
  }

  const isCountQuery =
    /^\s*SELECT\s+COUNT\s*\(\s*\*\s*\)\s+FROM\s+[A-Z0-9_./-]+(?:\s*)$/i.test(
      queryText,
    ) && !/\b(?:GROUP\s+BY|JOIN)\b/i.test(upperQuery);

  return {
    entitySetName,
    queryParams,
    isCountQuery,
  };
}

function stripMetadataFields(row: Record<string, unknown>): WorkbenchRow {
  const normalizedEntries = Object.entries(row).filter(
    ([key]) => !key.startsWith("__"),
  );

  return Object.fromEntries(normalizedEntries) as WorkbenchRow;
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["X", "TRUE", "1", "YES"].includes(value.toUpperCase());
  }

  return false;
}

function buildPageInfo(
  result: SapRunQueryResult,
  fallbackRowsLength: number,
): WorkbenchPageInfo {
  const page = Math.max(1, normalizeNumber(result.Page, 1));
  const pageSize = Math.max(
    0,
    normalizeNumber(result.PageSize, fallbackRowsLength),
  );
  const returnedRows = Math.max(
    0,
    normalizeNumber(result.ReturnedRows, fallbackRowsLength),
  );
  const totalRows = Math.max(
    0,
    normalizeNumber(result.TotalRows ?? result.RowCount, fallbackRowsLength),
  );
  const totalPages = Math.max(
    totalRows > 0 ? 1 : 0,
    normalizeNumber(result.TotalPages, pageSize > 0 ? Math.ceil(totalRows / pageSize) : 0),
  );

  return {
    resultId: result.ResultId?.trim(),
    rowCount: Math.max(0, normalizeNumber(result.RowCount, totalRows)),
    returnedRows,
    totalRows,
    maxRows: Math.max(0, normalizeNumber(result.MaxRows, pageSize)),
    page,
    pageSize,
    totalPages,
    truncated: normalizeBoolean(result.Truncated),
  };
}

function getODataResults<T>(payload: SapODataEnvelope<T>) {
  return payload.d?.results ?? [];
}

function createDebugResponse({
  label,
  summary,
  response,
}: {
  label: string;
  summary: string;
  response: {
    path: string;
    text: string;
    status: number;
    contentLength: string;
    upstreamContentLength: string;
    upstreamContentType: string;
    proxyBytes: string;
    receivedChars: number;
    receivedBytes: number;
  };
}): WorkbenchDebugResponse {
  return {
    label,
    path: response.path,
    status: response.status,
    contentLength: response.contentLength,
    upstreamContentLength: response.upstreamContentLength,
    upstreamContentType: response.upstreamContentType,
    proxyBytes: response.proxyBytes,
    receivedChars: response.receivedChars,
    receivedBytes: response.receivedBytes,
    summary,
    body: response.text,
  };
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

function normalizeColumns(columns: SapSqlwbColumn[], rows: WorkbenchRow[]) {
  if (columns.length === 0) {
    return buildFallbackColumns(rows);
  }

  return columns
    .flatMap((column, index) => {
      const key = column.JsonKey?.trim() || column.FieldName?.trim() || "";

      if (!key) {
        return [];
      }

      const fieldName = column.FieldName?.trim() || key;

      return [
        {
          key,
          fieldName,
          label: column.Label?.trim() || fieldName,
          position: normalizeNumber(column.Position, index + 1),
          abapType: column.AbapType?.trim() || undefined,
          length:
            column.Length === undefined
              ? undefined
              : normalizeNumber(column.Length),
          decimals:
            column.Decimals === undefined
              ? undefined
              : normalizeNumber(column.Decimals),
          isKey: normalizeBoolean(column.IsKey),
        } satisfies WorkbenchColumn,
      ];
    })
    .sort((a, b) => a.position - b.position);
}

function unwrapRunQueryResult(payload: SapRunQueryEnvelope) {
  const data = payload.d;

  if (!data) {
    return {};
  }

  if ("RunQuery" in data && data.RunQuery) {
    return data.RunQuery;
  }

  return data as SapRunQueryResult;
}

function unwrapPreviewTableResult(payload: SapPreviewTableEnvelope) {
  const data = payload.d;

  if (!data) {
    return {};
  }

  if ("PreviewTable" in data && data.PreviewTable) {
    return data.PreviewTable;
  }

  return data as SapRunQueryResult;
}

function parseRowsJson(rowsJson: string): WorkbenchRow[] {
  if (!rowsJson.trim()) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rowsJson) as unknown;
  } catch (error) {
    throw new Error(
      [
        "Joined PayloadPart did not parse as JSON.",
        `RowsJson chars: ${rowsJson.length}`,
        `RowsJson bytes: ${new TextEncoder().encode(rowsJson).length}`,
        `Tail: ${rowsJson.slice(-240)}`,
        error instanceof Error ? `Error: ${error.message}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("SAP page chunks did not produce a JSON array");
  }

  return parsed
    .filter((row): row is Record<string, unknown> => {
      return row !== null && typeof row === "object" && !Array.isArray(row);
    })
    .map((row) => stripMetadataFields(row));
}

function parsePartialRowsJson(rowsJson: string): WorkbenchRow[] | null {
  if (!rowsJson.trim()) {
    return [];
  }

  try {
    return parseRowsJson(rowsJson);
  } catch {
    try {
      const repaired = jsonrepair(rowsJson);
      return parseRowsJson(repaired);
    } catch {
      return null;
    }
  }
}

function joinChunkPayloads(chunks: SapSqlwbPageChunk[]) {
  return chunks
    .slice()
    .sort((a, b) => normalizeNumber(a.ChunkNo) - normalizeNumber(b.ChunkNo))
    .map((chunk) => chunk.PayloadPart ?? "")
    .join("");
}

async function loadResultColumnBatch(
  resultId: string,
  options: { top: number; skip: number },
) {
  const response = await sapClient.requestRawJson<
    SapODataEnvelope<SapSqlwbColumn>
  >(buildColumnSetPath(resultId, options));
  const columns = getODataResults(response.data);

  return {
    columns,
    debugResponse: createDebugResponse({
      label: `SqlwbColumnSet skip ${options.skip}`,
      summary: `Column rows: ${columns.length}`,
      response,
    }),
  };
}

async function loadResultColumns(resultId: string) {
  const columnBatchSize = 100;
  const maxColumnBatches = 100;
  const columns: SapSqlwbColumn[] = [];
  const debugResponses: WorkbenchDebugResponse[] = [];

  for (let batchIndex = 0; batchIndex < maxColumnBatches; batchIndex += 1) {
    const { columns: batch, debugResponse } = await loadResultColumnBatch(
      resultId,
      {
        top: columnBatchSize,
        skip: batchIndex * columnBatchSize,
      },
    );

    debugResponses.push(debugResponse);

    if (batch.length === 0) {
      break;
    }

    columns.push(...batch);

    if (batch.length < columnBatchSize) {
      break;
    }
  }

  return {
    columns,
    debugResponses,
  };
}

function hasLastChunk(chunks: SapSqlwbPageChunk[]) {
  return chunks.some((chunk) => normalizeBoolean(chunk.IsLastChunk));
}

async function loadPageChunkBatch(
  resultId: string,
  page: number,
  options: { top: number; skip: number },
) {
  const response = await sapClient.requestRawJson<
    SapODataEnvelope<SapSqlwbPageChunk>
  >(
    buildPageChunkSetPath(resultId, page, options),
  );
  const chunks = getODataResults(response.data);

  return {
    chunks,
    debugResponse: createDebugResponse({
      label: `SqlwbPageChunkSet skip ${options.skip}`,
      summary: `Chunk rows: ${chunks.length}. Last chunk in batch: ${
        hasLastChunk(chunks) ? "yes" : "no"
      }`,
      response,
    }),
  };
}

async function loadResultRows(
  resultId: string,
  page: number,
  options: {
    onPartialRows?: (progress: {
      rows: WorkbenchRow[];
      debugResponses: WorkbenchDebugResponse[];
      loadedChunkCount: number;
      isFinal: boolean;
    }) => void;
  } = {},
) {
  const chunkBatchSize = 100;
  const maxChunkBatches = 1000;
  const chunks: SapSqlwbPageChunk[] = [];
  const debugResponses: WorkbenchDebugResponse[] = [];

  for (let batchIndex = 0; batchIndex < maxChunkBatches; batchIndex += 1) {
    const { chunks: batch, debugResponse } = await loadPageChunkBatch(resultId, page, {
      top: chunkBatchSize,
      skip: batchIndex * chunkBatchSize,
    });
    debugResponses.push(debugResponse);

    if (batch.length === 0) {
      break;
    }

    chunks.push(...batch);

    const isFinalBatch = hasLastChunk(batch) || batch.length < chunkBatchSize;
    const partialRowsJson = joinChunkPayloads(chunks);
    const partialRows = isFinalBatch
      ? parseRowsJson(partialRowsJson)
      : parsePartialRowsJson(partialRowsJson);

    if (partialRows) {
      options.onPartialRows?.({
        rows: partialRows,
        debugResponses: [...debugResponses],
        loadedChunkCount: chunks.length,
        isFinal: isFinalBatch,
      });
    }

    if (isFinalBatch) {
      break;
    }
  }

  console.log("SAP page chunks loaded", {
    resultId,
    page,
    chunkCount: chunks.length,
    hasLastChunk: hasLastChunk(chunks),
  });

  if (chunks.length === 0) {
    return {
      rows: [] as WorkbenchRow[],
      debugResponses,
    };
  }

  const rowsJson = joinChunkPayloads(chunks);

  return {
    rows: parseRowsJson(rowsJson),
    debugResponses,
  };
}

async function executeLiveRunQuery(
  queryText: string,
  fallbackEntity: string,
  availableEntityNames: string[],
  pageNumber = 1,
  options: WorkbenchQueryOptions = {},
): Promise<WorkbenchQueryExecution> {
  const queryPlan = parseWorkbenchQuery(
    queryText,
    fallbackEntity,
    createEntityNameResolver(availableEntityNames),
  );
  const queryPath = buildRunQueryPath(queryText, pageNumber);

  const result = unwrapRunQueryResult(
    await sapClient.request<SapRunQueryEnvelope>(queryPath, { method: "POST" }),
  );

  const status = (result.Status ?? "").toString().toUpperCase();
  if (status && status !== "SUCCESS") {
    throw Object.assign(
      new Error(
        result.ErrorText || `RunQuery failed with status ${result.Status}`,
      ),
      {
        status: 400,
        sapStatus: result.Status,
        sapErrorCode: result.ErrorCode,
      },
    );
  }

  const resultId = result.ResultId?.trim();

  if (!resultId) {
    throw Object.assign(new Error("RunQuery did not return ResultId"), {
      status: 400,
      sapStatus: result.Status,
      sapErrorCode: result.ErrorCode || "MISSING_RESULT_ID",
    });
  }

  const page = Math.max(1, normalizeNumber(result.Page, 1));
  const totalPages = normalizeNumber(result.TotalPages, 1);

  if (totalPages > 0 && page > totalPages) {
    throw Object.assign(
      new Error(`Requested page ${page} is greater than total pages ${totalPages}`),
      {
        status: 400,
        sapStatus: result.Status,
        sapErrorCode: "PAGE_OUT_OF_RANGE",
      },
    );
  }

  const reusedColumns = options.reuseColumns;
  const {
    columns: sapColumns,
    debugResponses: columnDebugResponses,
  } = reusedColumns
    ? { columns: [] as SapSqlwbColumn[], debugResponses: [] }
    : await loadResultColumns(resultId);
  const entitySetName = result.ObjectName || queryPlan.entitySetName;
  const { rows, debugResponses: chunkDebugResponses } = await loadResultRows(
    resultId,
    page,
    {
      onPartialRows: (progress) => {
        const partialDebugResponses = [
          ...columnDebugResponses,
          ...progress.debugResponses,
        ];

        options.onProgress?.({
          entitySetName,
          columns: reusedColumns ?? normalizeColumns(sapColumns, progress.rows),
          rows: progress.rows,
          debugResponses: partialDebugResponses,
          queryPath,
          isCountQuery: queryPlan.isCountQuery,
          pageInfo: buildPageInfo(result, progress.rows.length),
          isFinal: progress.isFinal,
          loadedChunkCount: progress.loadedChunkCount,
        });
      },
    },
  );
  const debugResponses = [...columnDebugResponses, ...chunkDebugResponses];
  const columns = reusedColumns ?? normalizeColumns(sapColumns, rows);
  const pageInfo = buildPageInfo(result, rows.length);

  return {
    entitySetName,
    columns,
    rows,
    debugResponses,
    queryPath,
    isCountQuery: queryPlan.isCountQuery,
    pageInfo,
  };
}

async function executeLivePreviewTable(
  objectName: string,
  maxRows = 100,
  pageNumber = 1,
  options: WorkbenchQueryOptions = {},
): Promise<WorkbenchQueryExecution> {
  const queryPath = buildPreviewTablePath(objectName, maxRows, pageNumber);
  const result = unwrapPreviewTableResult(
    await sapClient.request<SapPreviewTableEnvelope>(queryPath, {
      method: "POST",
    }),
  );

  const status = (result.Status ?? "").toString().toUpperCase();
  if (status && status !== "SUCCESS") {
    throw Object.assign(
      new Error(
        result.ErrorText || `PreviewTable failed with status ${result.Status}`,
      ),
      {
        status: 400,
        sapStatus: result.Status,
        sapErrorCode: result.ErrorCode,
      },
    );
  }

  const resultId = result.ResultId?.trim();

  if (!resultId) {
    throw Object.assign(new Error("PreviewTable did not return ResultId"), {
      status: 400,
      sapStatus: result.Status,
      sapErrorCode: result.ErrorCode || "MISSING_RESULT_ID",
    });
  }

  const page = Math.max(1, normalizeNumber(result.Page, pageNumber));
  const reusedColumns = options.reuseColumns;
  const {
    columns: sapColumns,
    debugResponses: columnDebugResponses,
  } = reusedColumns
    ? { columns: [] as SapSqlwbColumn[], debugResponses: [] }
    : await loadResultColumns(resultId);
  const entitySetName = result.ObjectName || objectName;
  const { rows, debugResponses: chunkDebugResponses } = await loadResultRows(
    resultId,
    page,
    {
      onPartialRows: (progress) => {
        const partialDebugResponses = [
          ...columnDebugResponses,
          ...progress.debugResponses,
        ];

        options.onProgress?.({
          entitySetName,
          columns: reusedColumns ?? normalizeColumns(sapColumns, progress.rows),
          rows: progress.rows,
          debugResponses: partialDebugResponses,
          queryPath,
          isCountQuery: false,
          pageInfo: buildPageInfo(result, progress.rows.length),
          isFinal: progress.isFinal,
          loadedChunkCount: progress.loadedChunkCount,
        });
      },
    },
  );
  const debugResponses = [...columnDebugResponses, ...chunkDebugResponses];
  const pageInfo = buildPageInfo(result, rows.length);

  return {
    entitySetName,
    columns: reusedColumns ?? normalizeColumns(sapColumns, rows),
    rows,
    debugResponses,
    queryPath,
    isCountQuery: false,
    pageInfo,
  };
}

async function loadEntityRows(entitySetName: string) {
  const rawRows = await sapClient.fetchCollection<Record<string, unknown>>(
    buildEntitySetPath(entitySetName),
  );

  return rawRows.map((row) => stripMetadataFields(row));
}

export async function executeWorkbenchQuery(
  queryText: string,
  fallbackEntity: string,
  availableEntityNames: string[],
): Promise<WorkbenchQueryExecution> {
  const queryPlan = parseWorkbenchQuery(
    queryText,
    fallbackEntity,
    createEntityNameResolver(availableEntityNames),
  );

  if (queryPlan.isCountQuery) {
    const rows = await loadEntityRows(queryPlan.entitySetName);
    const countRows = [
      {
        RecordCount: rows.length,
        EntitySet: queryPlan.entitySetName,
      },
    ];

    return {
      entitySetName: queryPlan.entitySetName,
      columns: buildFallbackColumns(countRows),
      rows: countRows,
      debugResponses: [],
      queryPath: buildQueryPath(queryPlan.entitySetName, queryPlan.queryParams),
      isCountQuery: true,
      pageInfo: {
        rowCount: rows.length,
        returnedRows: countRows.length,
        totalRows: rows.length,
        maxRows: rows.length,
        page: 1,
        pageSize: countRows.length,
        totalPages: 1,
        truncated: false,
      },
    };
  }

  const rows = await sapClient.fetchCollection<Record<string, unknown>>(
    buildQueryPath(queryPlan.entitySetName, queryPlan.queryParams),
  );
  const normalizedRows = rows.map((row) => stripMetadataFields(row));

  return {
    entitySetName: queryPlan.entitySetName,
    columns: buildFallbackColumns(normalizedRows),
    rows: normalizedRows,
    debugResponses: [],
    queryPath: buildQueryPath(queryPlan.entitySetName, queryPlan.queryParams),
    isCountQuery: false,
    pageInfo: {
      rowCount: normalizedRows.length,
      returnedRows: normalizedRows.length,
      totalRows: normalizedRows.length,
      maxRows: normalizedRows.length,
      page: normalizedRows.length > 0 ? 1 : 0,
      pageSize: normalizedRows.length,
      totalPages: normalizedRows.length > 0 ? 1 : 0,
      truncated: false,
    },
  };
}

function mapSearchTableToEntity(
  table: SapSqlwbTable,
  index: number,
): WorkbenchEntity | null {
  const objectName = table.ObjectName?.trim();

  if (!objectName) {
    return null;
  }

  const objectType = table.ObjectType?.trim() || "TABLE";
  const description = table.Description?.trim() || `${objectType} ${objectName}`;

  return {
    name: objectName,
    description,
    recordCount: 0,
    keyFields: [],
    tags: ["SAP Whitelist", objectType],
    lastSyncedRaw: `/Date(${Date.now() + index})/`,
  };
}

async function buildLiveSnapshot(): Promise<WorkbenchSnapshot> {
  const allowedTables = await sqlAssistService.fetchAllTables();
  const entities = allowedTables
    .map((table, index) => mapSearchTableToEntity(table, index))
    .filter((entity): entity is WorkbenchEntity => Boolean(entity))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rowsByEntity = Object.fromEntries(
    entities.map((entity) => [entity.name, [] as WorkbenchRow[]]),
  );

  return {
    metrics,
    entities,
    templates,
    rowsByEntity,
    activity: [
      {
        id: "activity-live-1",
        title: "Allowed SAP tables loaded",
        detail:
          entities.length > 0
            ? "Object Explorer was populated from SearchTables without a search key."
            : "SearchTables returned no queryable objects for the active profile.",
        timestampRaw: `/Date(${Date.now()})/`,
        tone: "success",
      },
      ...activity,
    ],
  };
}

function getFallbackSnapshot(): WorkbenchSnapshot {
  return {
    metrics,
    entities,
    templates,
    rowsByEntity,
    activity,
  };
}

function cloneRows(rows: WorkbenchRow[]) {
  return rows.map((row) => ({ ...row }));
}

export const workbenchService = {
  getSnapshot: getFallbackSnapshot,

  loadSnapshot: async (): Promise<SnapshotLoadResult> => {
    try {
      return {
        snapshot: await buildLiveSnapshot(),
        isLive: true,
      };
    } catch {
      return {
        snapshot: getFallbackSnapshot(),
        isLive: false,
      };
    }
  },

  getRowsForEntity: (entityName: string) =>
    cloneRows(rowsByEntity[entityName] ?? []),

  executeQuery: async (
    queryText: string,
    fallbackEntity: string,
    availableEntityNames: string[],
    page = 1,
    options?: WorkbenchQueryOptions,
  ) => {
    return executeLiveRunQuery(
      queryText,
      fallbackEntity,
      availableEntityNames,
      page,
      options,
    );
  },

  previewTable: async (
    objectName: string,
    maxRows = 100,
    page = 1,
    options?: WorkbenchQueryOptions,
  ) => {
    return executeLivePreviewTable(objectName, maxRows, page, options);
  },
};
