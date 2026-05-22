import type {
  WorkbenchActivity,
  WorkbenchEntity,
  WorkbenchMetric,
  WorkbenchRow,
  WorkbenchSnapshot,
  WorkbenchTemplate,
} from "@/types/workbench";

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

function cloneRows(rows: WorkbenchRow[]) {
  return rows.map((row) => ({ ...row }));
}

export const workbenchService = {
  getSnapshot: (): WorkbenchSnapshot => ({
    metrics,
    entities,
    templates,
    rowsByEntity,
    activity,
  }),

  getRowsForEntity: (entityName: string) =>
    cloneRows(rowsByEntity[entityName] ?? []),
};
