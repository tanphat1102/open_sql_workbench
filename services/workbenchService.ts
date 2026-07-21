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
import { toast } from "@/lib/toast";
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

const servicePath = `opu/odata/sap/${process.env.NEXT_PUBLIC_SAP_PACKAGE!}`;
const queryProfileId = process.env.NEXT_PUBLIC_SQLWB_PROFILE_ID ?? "DEV";

const metrics: WorkbenchMetric[] = [
  { label: "Entity sets", value: "0", detail: "Loading..." },
  { label: "Saved templates", value: "1", detail: "SELECT * FROM <entity>" },
  {
    label: "Proxy status",
    value: "Ready",
    detail: "requests routed through /api/sap",
  },
];

const emptyEntities: WorkbenchEntity[] = [];
const emptyTemplates: WorkbenchTemplate[] = [
  {
    id: "default",
    name: "Preview",
    description: "Preview top rows.",
    query: "SELECT * FROM <entity>",
  },
];
const emptyRowsByEntity: Record<string, WorkbenchRow[]> = {};
const emptyActivity: WorkbenchActivity[] = [];

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

    return canonicalNames.get(trimmedName.toLowerCase()) ?? entityName;
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
    normalizeNumber(
      result.TotalPages,
      pageSize > 0 ? Math.ceil(totalRows / pageSize) : 0,
    ),
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

function assertSapSuccess(result: SapRunQueryResult, operationName: string) {
  const status = (result.Status ?? "").toString().toUpperCase();
  if (status && status !== "SUCCESS") {
    if (status === "BLOCKED") {
      toast({
        title: `Error Code: ${result.ErrorCode || "BLOCKED"}`,
        description: result.ErrorText || "Query blocked by SAP",
        variant: "destructive",
      });
    }

    throw Object.assign(
      new Error(
        result.ErrorText ||
          `${operationName} failed with status ${result.Status}`,
      ),
      {
        status: 400,
        sapStatus: result.Status,
        sapErrorCode: result.ErrorCode,
      },
    );
  }
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
  >(buildPageChunkSetPath(resultId, page, options));
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
    const { chunks: batch, debugResponse } = await loadPageChunkBatch(
      resultId,
      page,
      {
        top: chunkBatchSize,
        skip: batchIndex * chunkBatchSize,
      },
    );
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

  assertSapSuccess(result, "RunQuery");

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
      new Error(
        `Requested page ${page} is greater than total pages ${totalPages}`,
      ),
      {
        status: 400,
        sapStatus: result.Status,
        sapErrorCode: "PAGE_OUT_OF_RANGE",
      },
    );
  }

  const reusedColumns = options.reuseColumns;
  const { columns: sapColumns, debugResponses: columnDebugResponses } =
    reusedColumns
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

  assertSapSuccess(result, "PreviewTable");

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
  const { columns: sapColumns, debugResponses: columnDebugResponses } =
    reusedColumns
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
  const description =
    table.Description?.trim() || `${objectType} ${objectName}`;

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
    templates: emptyTemplates,
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
    ],
  };
}

function getFallbackSnapshot(): WorkbenchSnapshot {
  return {
    metrics,
    entities: emptyEntities,
    templates: emptyTemplates,
    rowsByEntity: emptyRowsByEntity,
    activity: [],
  };
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

  getRowsForEntity: () => [] as WorkbenchRow[],

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
