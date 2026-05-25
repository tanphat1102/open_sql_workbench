import type {
  WorkbenchActivity,
  WorkbenchEntity,
  WorkbenchMetric,
  WorkbenchRow,
  WorkbenchSnapshot,
  WorkbenchTemplate,
} from "@/types/workbench";
import { sapClient } from "@/services/sapClient";
import type { SapRunQueryResult } from "@/types/sap";

const servicePath = "opu/odata/sap/ZSQLWB_ODATA_SRV";
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

type SapEntityDefinition = {
  name: string;
  entityType: string;
  keyFields: string[];
};

type SnapshotLoadResult = {
  snapshot: WorkbenchSnapshot;
  isLive: boolean;
};

type WorkbenchQueryExecution = {
  entitySetName: string;
  rows: WorkbenchRow[];
  queryPath: string;
  isCountQuery: boolean;
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
  const searchParams = new URLSearchParams({
    ProfileId: `'${queryProfileId}'`,
    SqlText: `'${queryText}'`,
    Page: String(page),
  });

  return `${servicePath}/RunQuery?${searchParams.toString()}`;
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
      availableEntityNames[0] ??
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

  const isCountQuery = upperQuery.includes("COUNT(*)");

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

function parseRunQueryRows(rowsJson: string | null | undefined) {
  if (!rowsJson) {
    return [] as Record<string, unknown>[];
  }

  try {
    const parsed = JSON.parse(rowsJson);

    if (Array.isArray(parsed)) {
      return parsed as Record<string, unknown>[];
    }
  } catch {
    // If the backend returns malformed JSON, fall back to an empty result set.
  }

  return [] as Record<string, unknown>[];
}

async function executeLiveRunQuery(
  queryText: string,
  fallbackEntity: string,
  availableEntityNames: string[],
): Promise<WorkbenchQueryExecution> {
  const queryPlan = parseWorkbenchQuery(
    queryText,
    fallbackEntity,
    createEntityNameResolver(availableEntityNames),
  );
  const queryPath = buildRunQueryPath(queryText);

  const result = await sapClient.fetchEntity<SapRunQueryResult>(queryPath, {
    method: "POST",
  });

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

  console.log("sap response result:", JSON.stringify(result).substring(0, 300));
const rows = parseRunQueryRows(result.RowsJson).map((row) =>
    stripMetadataFields(row),
  );

  if (queryPlan.isCountQuery) {
    const countValue =
      Number(result.RowCount ?? result.TotalRows ?? rows.length) || 0;

    return {
      entitySetName: queryPlan.entitySetName,
      rows: [
        {
          RecordCount: countValue,
          EntitySet: queryPlan.entitySetName,
        },
      ],
      queryPath,
      isCountQuery: true,
    };
  }

  return {
    entitySetName: queryPlan.entitySetName,
    rows,
    queryPath,
    isCountQuery: false,
  };
}

function parseEntityDefinitions(metadataXml: string): SapEntityDefinition[] {
  const entityTypeKeyMap = new Map<string, string[]>();
  const entityTypeRegex =
    /<EntityType\b[^>]*Name="([^"]+)"[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/EntityType>/g;

  for (const match of metadataXml.matchAll(entityTypeRegex)) {
    const [, entityTypeName, keyBlock] = match;
    const keyFields = [
      ...keyBlock.matchAll(/<PropertyRef\b[^>]*Name="([^"]+)"/g),
    ]
      .map((keyMatch) => keyMatch[1])
      .filter(Boolean);

    if (entityTypeName) {
      entityTypeKeyMap.set(entityTypeName, keyFields);
    }
  }

  const entitySets: SapEntityDefinition[] = [];
  const entitySetRegex =
    /<EntitySet\b[^>]*Name="([^"]+)"[^>]*EntityType="([^"]+)"[^>]*\/?>(?:<\/EntitySet>)?/g;

  for (const match of metadataXml.matchAll(entitySetRegex)) {
    const [, entitySetName, entityTypeName] = match;
    const shortEntityType = entityTypeName?.split(".").pop() ?? entityTypeName;
    entitySets.push({
      name: entitySetName,
      entityType: entityTypeName,
      keyFields: entityTypeKeyMap.get(shortEntityType) ?? [],
    });
  }

  return entitySets;
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

    return {
      entitySetName: queryPlan.entitySetName,
      rows: [
        {
          RecordCount: rows.length,
          EntitySet: queryPlan.entitySetName,
        },
      ],
      queryPath: buildQueryPath(queryPlan.entitySetName, queryPlan.queryParams),
      isCountQuery: true,
    };
  }

  const rows = await sapClient.fetchCollection<Record<string, unknown>>(
    buildQueryPath(queryPlan.entitySetName, queryPlan.queryParams),
  );

  return {
    entitySetName: queryPlan.entitySetName,
    rows: rows.map((row) => stripMetadataFields(row)),
    queryPath: buildQueryPath(queryPlan.entitySetName, queryPlan.queryParams),
    isCountQuery: false,
  };
}

function buildEntityDescription(entityType: string, rowCount: number) {
  const shortType = entityType.split(".").pop() ?? entityType;

  return `${shortType} exposed by ZSQLWB_ODATA_SRV${rowCount > 0 ? ` with ${rowCount} rows` : ""}`;
}

async function buildLiveSnapshot(): Promise<WorkbenchSnapshot> {
  const metadataXml = await sapClient.requestText(`${servicePath}/$metadata`);
  const entityDefinitions = parseEntityDefinitions(metadataXml);

  if (entityDefinitions.length === 0) {
    return getFallbackSnapshot();
  }

  const entityResults = await Promise.all(
    entityDefinitions.map(async (definition) => {
      const rows = await loadEntityRows(definition.name);

      return {
        entity: {
          name: definition.name,
          description: buildEntityDescription(
            definition.entityType,
            rows.length,
          ),
          recordCount: rows.length,
          keyFields: definition.keyFields.length
            ? definition.keyFields
            : Object.keys(rows[0] ?? {}).slice(0, 1),
          tags: [
            "SAP OData",
            definition.entityType.split(".").pop() ?? "Entity",
          ],
          lastSyncedRaw: `/Date(${Date.now()})/`,
        },
        rows,
      };
    }),
  );

  const entities = entityResults.map(({ entity }) => entity);
  const rowsByEntity = Object.fromEntries(
    entityResults.map(({ entity, rows }) => [entity.name, rows]),
  );

  return {
    metrics,
    entities,
    templates,
    rowsByEntity,
    activity: [
      {
        id: "activity-live-1",
        title: "Live SAP metadata loaded",
        detail:
          "Entity sets were discovered from $metadata through the proxy layer.",
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
  ) => {
    try {
      return await executeLiveRunQuery(
        queryText,
        fallbackEntity,
        availableEntityNames,
      );
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        ("status" in error || "sapStatus" in error)
      ) {
        const typedError = error as {
          status?: number;
          sapStatus?: string;
        };

        if (typedError.status === 401 || typedError.sapStatus) {
          throw error;
        }
      }

      return executeWorkbenchQuery(
        queryText,
        fallbackEntity,
        availableEntityNames,
      );
    }
  },
};
