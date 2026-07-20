import type { SapSqlwbField } from "@/types/sap";
import type { WorkbenchEntity } from "@/types/workbench";

export type BuilderOrderClause = {
  field: string;
  direction: "ASC" | "DESC";
};

export type BuilderNode = {
  id: string;
  entityName: string;
  alias: string;
  fields: string;
  orderBy: BuilderOrderClause[];
  x: number;
  y: number;
};

export type BuilderJoin = {
  id: string;
  leftNodeId: string;
  rightNodeId: string;
  joinType: "INNER JOIN" | "LEFT OUTER JOIN";
  leftField: string;
  rightField: string;
};

export type BuilderFilter = {
  id: string;
  nodeId: string;
  field: string;
  operator: "=" | "<>" | ">" | ">=" | "<" | "<=" | "LIKE" | "BETWEEN";
  value: string;
  value2?: string;
  conjunction: "AND" | "OR";
};

export type VisualQueryBuilderProps = {
  entities: WorkbenchEntity[];
  onApplySql: (sql: string) => void;
};

export type NodeDragSession = {
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  element: HTMLDivElement;
  frameId: number | null;
};
