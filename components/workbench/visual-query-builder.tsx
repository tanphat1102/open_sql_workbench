"use client";

import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CornerDownRight,
  GripVertical,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Table2,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { sqlAssistService } from "@/services/sqlAssistService";
import type { SapSqlwbField } from "@/types/sap";
import type { WorkbenchEntity } from "@/types/workbench";

type BuilderOrderClause = {
  field: string;
  direction: "ASC" | "DESC";
};

type BuilderNode = {
  id: string;
  entityName: string;
  alias: string;
  fields: string;
  orderBy: BuilderOrderClause[];
  x: number;
  y: number;
};

type BuilderJoin = {
  id: string;
  leftNodeId: string;
  rightNodeId: string;
  joinType: "INNER JOIN" | "LEFT OUTER JOIN";
  leftField: string;
  rightField: string;
};

type BuilderFilter = {
  id: string;
  nodeId: string;
  field: string;
  operator: "=" | "<>" | ">" | ">=" | "<" | "<=" | "LIKE";
  value: string;
  conjunction: "AND" | "OR";
};

type VisualQueryBuilderProps = {
  entities: WorkbenchEntity[];
  onApplySql: (sql: string) => void;
};

type NodeDragSession = {
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

const nodeWidth = 220;
const nodeAnchorOffsetY = 74;
const preferredJoinFields = new Set([
  "CARRID",
  "CONNID",
  "FLDATE",
  "BOOKID",
  "CUSTOMID",
  "PLANETYPE",
  "AGENCYNUM",
  "ID",
]);
const blockedJoinFields = new Set(["MANDT"]);

function getEntityLabel(entityName: string, entities: WorkbenchEntity[]) {
  return (
    entities.find((entity) => entity.name === entityName)?.description ?? ""
  );
}

function getAlias(index: number) {
  return String.fromCharCode("a".charCodeAt(0) + index);
}

function getNextAlias(nodes: BuilderNode[]) {
  const usedAliases = new Set(
    nodes.map((node) => node.alias.trim().toLowerCase()).filter(Boolean),
  );

  for (let index = 0; index < 26; index += 1) {
    const alias = getAlias(index);

    if (!usedAliases.has(alias)) {
      return alias;
    }
  }

  return `t${nodes.length + 1}`;
}

function parseFields(value: string) {
  return value
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

function normalizeFieldName(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function getFieldName(field: SapSqlwbField) {
  return normalizeFieldName(field.FieldName ?? field.JsonKey);
}

function isKeyField(field: SapSqlwbField) {
  const value = field.IsKey;

  return (
    value === true ||
    String(value).toUpperCase() === "X" ||
    String(value).toLowerCase() === "true"
  );
}

function getFieldPosition(field: SapSqlwbField) {
  const position = Number(field.Position);

  return Number.isFinite(position) ? position : Number.MAX_SAFE_INTEGER;
}

function sortFields(fields: SapSqlwbField[]) {
  return [...fields].sort((left, right) => {
    const keyDelta = Number(isKeyField(right)) - Number(isKeyField(left));

    if (keyDelta !== 0) {
      return keyDelta;
    }

    const positionDelta = getFieldPosition(left) - getFieldPosition(right);

    if (positionDelta !== 0) {
      return positionDelta;
    }

    return getFieldName(left).localeCompare(getFieldName(right));
  });
}

function getNodeFields(
  node: BuilderNode | undefined,
  fieldsByEntity: Record<string, SapSqlwbField[]>,
) {
  if (!node) {
    return [];
  }

  return fieldsByEntity[node.entityName] ?? [];
}

function scoreFieldPair(leftField: SapSqlwbField, rightField: SapSqlwbField) {
  const leftName = getFieldName(leftField);
  const rightName = getFieldName(rightField);

  if (
    !leftName ||
    !rightName ||
    blockedJoinFields.has(leftName) ||
    blockedJoinFields.has(rightName)
  ) {
    return 0;
  }

  let score = 0;

  if (leftName === rightName) {
    score += 100;
  } else if (leftName.endsWith(rightName) || rightName.endsWith(leftName)) {
    score += 24;
  }

  if (score === 0) {
    return 0;
  }

  if (isKeyField(leftField) && isKeyField(rightField)) {
    score += 35;
  } else if (isKeyField(leftField) || isKeyField(rightField)) {
    score += 16;
  }

  if (preferredJoinFields.has(leftName) || preferredJoinFields.has(rightName)) {
    score += 12;
  }

  return score;
}

function findJoinSuggestion(
  leftNode: BuilderNode | undefined,
  rightNode: BuilderNode | undefined,
  fieldsByEntity: Record<string, SapSqlwbField[]>,
) {
  const leftFields = getNodeFields(leftNode, fieldsByEntity);
  const rightFields = getNodeFields(rightNode, fieldsByEntity);
  let bestSuggestion:
    | { leftField: string; rightField: string; score: number }
    | undefined;

  for (const leftField of leftFields) {
    for (const rightField of rightFields) {
      const score = scoreFieldPair(leftField, rightField);

      if (!score) {
        continue;
      }

      if (!bestSuggestion || score > bestSuggestion.score) {
        bestSuggestion = {
          leftField: getFieldName(leftField),
          rightField: getFieldName(rightField),
          score,
        };
      }
    }
  }

  return bestSuggestion;
}

function findJoinNodes(nodes: BuilderNode[], join: BuilderJoin) {
  return {
    leftNode: nodes.find((node) => node.id === join.leftNodeId),
    rightNode: nodes.find((node) => node.id === join.rightNodeId),
  };
}

function applySuggestionToJoin(
  join: BuilderJoin,
  nodes: BuilderNode[],
  fieldsByEntity: Record<string, SapSqlwbField[]>,
) {
  if (join.leftField && join.rightField) {
    return join;
  }

  const { leftNode, rightNode } = findJoinNodes(nodes, join);
  const suggestion = findJoinSuggestion(leftNode, rightNode, fieldsByEntity);

  if (!suggestion) {
    return join;
  }

  return {
    ...join,
    leftField: join.leftField || suggestion.leftField,
    rightField: join.rightField || suggestion.rightField,
  };
}

function buildSelectList(nodes: BuilderNode[]) {
  if (nodes.length === 1) {
    const fields = parseFields(nodes[0].fields);
    return fields.length > 0 ? fields.join(", ") : "*";
  }

  const fields = nodes.flatMap((node) =>
    parseFields(node.fields).map((field) =>
      field.includes("~") ? field : `${node.alias}~${field}`,
    ),
  );

  return fields.length > 0 ? fields.join(", ") : "<select fields>";
}

function hasSelectedProjectionFields(nodes: BuilderNode[]) {
  return nodes.some((node) => parseFields(node.fields).length > 0);
}

function hasDuplicateAliases(nodes: BuilderNode[]) {
  const aliases = nodes.map((node) => node.alias.trim().toLowerCase());

  return aliases.some(
    (alias, index) => !alias || aliases.indexOf(alias) !== index,
  );
}

function formatWhereValue(value: string) {
  const trimmedValue = value.trim();

  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
    return trimmedValue;
  }

  return `'${trimmedValue.replace(/'/g, "''")}'`;
}

function buildWhereClause(nodes: BuilderNode[], filters: BuilderFilter[]) {
  const conditions = filters
    .filter((filter) => filter.nodeId && filter.field && filter.value.trim())
    .map((filter, index) => {
      const node = nodes.find((item) => item.id === filter.nodeId);
      const fieldRef =
        nodes.length > 1 && node
          ? `${node.alias}~${filter.field}`
          : filter.field;
      const condition = `${fieldRef} ${filter.operator} ${formatWhereValue(
        filter.value,
      )}`;

      return index === 0 ? condition : `${filter.conjunction} ${condition}`;
    });

  return conditions.length > 0 ? `WHERE ${conditions.join("\n")}` : "";
}

function buildSql(
  nodes: BuilderNode[],
  joins: BuilderJoin[],
  filters: BuilderFilter[],
) {
  if (nodes.length === 0) {
    return "";
  }

  if (nodes.length === 1) {
    return [
      `SELECT ${buildSelectList(nodes)}`,
      `FROM ${nodes[0].entityName}`,
      buildWhereClause(nodes, filters),
    ]
      .filter(Boolean)
      .join("\n");
  }

  const [firstNode] = nodes;
  const lines = [
    `SELECT ${buildSelectList(nodes)}`,
    `FROM ${firstNode.entityName} AS ${firstNode.alias}`,
  ];

  for (const join of joins) {
    const rightNode = nodes.find((node) => node.id === join.rightNodeId);
    const leftNode = nodes.find((node) => node.id === join.leftNodeId);

    if (!rightNode || !leftNode) {
      continue;
    }

    const leftField = join.leftField.trim() || "FIELD";
    const rightField = join.rightField.trim() || "FIELD";

    lines.push(
      `${join.joinType} ${rightNode.entityName} AS ${rightNode.alias}`,
      `ON ${leftNode.alias}~${leftField} = ${rightNode.alias}~${rightField}`,
    );
  }

  const whereClause = buildWhereClause(nodes, filters);

  if (whereClause) {
    lines.push(whereClause);
  }

  const orderByClause = buildOrderByClause(nodes);

  if (orderByClause) {
    lines.push(orderByClause);
  }

  return lines.join("\n");
}

function buildOrderByClause(nodes: BuilderNode[]) {
  const clauses = nodes.flatMap((node) =>
    node.orderBy
      .filter((o) => o.field)
      .map((o) =>
        nodes.length > 1
          ? `${node.alias}~${o.field} ${o.direction}`
          : `${o.field} ${o.direction}`,
      ),
  );

  return clauses.length > 0 ? `ORDER BY ${clauses.join(", ")}` : "";
}

function centerPosition(index: number) {
  return {
    x: 24 + (index % 3) * 244,
    y: 24 + Math.floor(index / 3) * 160,
  };
}

function getJoinLabel(join: BuilderJoin) {
  return join.joinType === "INNER JOIN" ? "INNER" : "LEFT";
}

function getConnectorGeometry(leftNode: BuilderNode, rightNode: BuilderNode) {
  const leftIsBeforeRight = leftNode.x <= rightNode.x;
  const startX = leftIsBeforeRight ? leftNode.x + nodeWidth : leftNode.x;
  const endX = leftIsBeforeRight ? rightNode.x : rightNode.x + nodeWidth;
  const startY = leftNode.y + nodeAnchorOffsetY;
  const endY = rightNode.y + nodeAnchorOffsetY;
  const controlOffset = Math.max(80, Math.abs(endX - startX) / 2);
  const firstControlX = leftIsBeforeRight
    ? startX + controlOffset
    : startX - controlOffset;
  const secondControlX = leftIsBeforeRight
    ? endX - controlOffset
    : endX + controlOffset;

  return {
    path: `M ${startX} ${startY} C ${firstControlX} ${startY}, ${secondControlX} ${endY}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2 - 70,
    labelY: (startY + endY) / 2 - 12,
    startX,
    startY,
    endX,
    endY,
  };
}

function nodeHasField(
  node: BuilderNode | undefined,
  fieldName: string,
  fieldsByEntity: Record<string, SapSqlwbField[]>,
) {
  const normalizedFieldName = normalizeFieldName(fieldName);

  if (blockedJoinFields.has(normalizedFieldName)) {
    return false;
  }

  return getNodeFields(node, fieldsByEntity).some(
    (field) => getFieldName(field) === normalizedFieldName,
  );
}

function isJoinValid(
  join: BuilderJoin,
  nodes: BuilderNode[],
  fieldsByEntity: Record<string, SapSqlwbField[]>,
) {
  if (!join.leftField.trim() || !join.rightField.trim()) {
    return false;
  }

  const { leftNode, rightNode } = findJoinNodes(nodes, join);

  return (
    nodeHasField(leftNode, join.leftField, fieldsByEntity) &&
    nodeHasField(rightNode, join.rightField, fieldsByEntity)
  );
}

function isFilterValid(
  filter: BuilderFilter,
  nodes: BuilderNode[],
  fieldsByEntity: Record<string, SapSqlwbField[]>,
) {
  if (!filter.nodeId || !filter.field || !filter.value.trim()) {
    return false;
  }

  const node = nodes.find((item) => item.id === filter.nodeId);
  const normalizedField = normalizeFieldName(filter.field);

  if (!node || blockedJoinFields.has(normalizedField)) {
    return false;
  }

  return getNodeFields(node, fieldsByEntity).some(
    (field) => getFieldName(field) === normalizedField,
  );
}

export function VisualQueryBuilder({
  entities,
  onApplySql,
}: VisualQueryBuilderProps) {
  const [nodes, setNodes] = useState<BuilderNode[]>([]);
  const [joins, setJoins] = useState<BuilderJoin[]>([]);
  const [filters, setFilters] = useState<BuilderFilter[]>([]);
  const [fieldsByEntity, setFieldsByEntity] = useState<
    Record<string, SapSqlwbField[]>
  >({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>(
    {},
  );
  const [activeDragNodeId, setActiveDragNodeId] = useState("");
  const dragSessionRef = useRef<NodeDragSession | null>(null);

  const effectiveJoins = useMemo(
    () =>
      joins.map((join) => applySuggestionToJoin(join, nodes, fieldsByEntity)),
    [fieldsByEntity, joins, nodes],
  );
  const joinConnectors = useMemo(
    () =>
      effectiveJoins.flatMap((join) => {
        if (!isJoinValid(join, nodes, fieldsByEntity)) {
          return [];
        }

        const { leftNode, rightNode } = findJoinNodes(nodes, join);

        if (!leftNode || !rightNode) {
          return [];
        }

        return [
          {
            join,
            leftNode,
            rightNode,
            geometry: getConnectorGeometry(leftNode, rightNode),
          },
        ];
      }),
    [effectiveJoins, fieldsByEntity, nodes],
  );
  const generatedSql = useMemo(
    () => buildSql(nodes, effectiveJoins, filters),
    [effectiveJoins, filters, nodes],
  );

  async function ensureFields(entityName: string) {
    if (fieldsByEntity[entityName] || loadingFields[entityName]) {
      return;
    }

    setLoadingFields((current) => ({ ...current, [entityName]: true }));

    try {
      const fields = await sqlAssistService.getFields(entityName);
      setFieldsByEntity((current) => ({
        ...current,
        [entityName]: fields.filter((field) => getFieldName(field)),
      }));
    } catch (error) {
      console.warn(`Unable to load fields for ${entityName}`, error);
      toast({
        title: "Field metadata unavailable",
        description: `${entityName} fields could not be loaded.`,
        variant: "destructive",
      });
    } finally {
      setLoadingFields((current) => {
        const next = { ...current };
        delete next[entityName];
        return next;
      });
    }
  }

  function addNode(entityName: string, x?: number, y?: number) {
    void ensureFields(entityName);

    if (nodes.some((node) => node.entityName === entityName)) {
      return;
    }

    const position =
      typeof x === "number" && typeof y === "number"
        ? { x, y }
        : centerPosition(nodes.length);
    const nextNode: BuilderNode = {
      id: `${entityName}-${Date.now()}`,
      entityName,
      alias: getNextAlias(nodes),
      fields: "",
      orderBy: [],
      x: position.x,
      y: position.y,
    };
    const nextNodes = [...nodes, nextNode];

    setNodes(nextNodes);

    if (nodes.length > 0) {
      const leftNode = nodes[nodes.length - 1];
      const suggestion = findJoinSuggestion(leftNode, nextNode, fieldsByEntity);

      if (suggestion) {
        setJoins((currentJoins) => [
          ...currentJoins,
          {
            id: `join-${Date.now()}`,
            leftNodeId: leftNode.id,
            rightNodeId: nextNode.id,
            joinType: "INNER JOIN",
            leftField: suggestion?.leftField ?? "",
            rightField: suggestion?.rightField ?? "",
          },
        ]);
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const entityName =
      event.dataTransfer.getData("application/x-open-sql-entity") ||
      event.dataTransfer.getData("text/plain");

    if (!entityName) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    addNode(
      entityName,
      Math.max(12, event.clientX - bounds.left - nodeWidth / 2),
      Math.max(12, event.clientY - bounds.top - 24),
    );
  }

  function updateNode(nodeId: string, patch: Partial<BuilderNode>) {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId ? { ...node, ...patch } : node,
      ),
    );
  }

  function scheduleNodeDrag(session: NodeDragSession) {
    if (session.frameId !== null) {
      return;
    }

    session.frameId = window.requestAnimationFrame(() => {
      session.frameId = null;
      const deltaX = session.currentX - session.startX;
      const deltaY = session.currentY - session.startY;

      session.element.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    });
  }

  function finishNodeDrag() {
    const session = dragSessionRef.current;

    if (!session) {
      return;
    }

    if (session.frameId !== null) {
      window.cancelAnimationFrame(session.frameId);
    }

    const nextX = Math.max(
      8,
      session.originX + session.currentX - session.startX,
    );
    const nextY = Math.max(
      8,
      session.originY + session.currentY - session.startY,
    );

    session.element.style.transform = "";
    dragSessionRef.current = null;
    setActiveDragNodeId("");
    updateNode(session.nodeId, { x: nextX, y: nextY });
  }

  function handleNodeDragStart(
    event: ReactPointerEvent<HTMLElement>,
    node: BuilderNode,
  ) {
    if (event.button !== 0) {
      return;
    }

    const element = event.currentTarget.closest<HTMLDivElement>(
      "[data-builder-node]",
    );

    if (!element) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSessionRef.current = {
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      currentX: event.clientX,
      currentY: event.clientY,
      element,
      frameId: null,
    };
    setActiveDragNodeId(node.id);
  }

  function handleNodeDragMove(event: ReactPointerEvent<HTMLElement>) {
    const session = dragSessionRef.current;

    if (!session) {
      return;
    }

    session.currentX = event.clientX;
    session.currentY = event.clientY;
    scheduleNodeDrag(session);
  }

  function handleNodeDragEnd(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishNodeDrag();
  }

  function removeNode(nodeId: string) {
    setNodes((currentNodes) =>
      currentNodes.filter((node) => node.id !== nodeId),
    );
    setJoins((currentJoins) =>
      currentJoins.filter(
        (join) => join.leftNodeId !== nodeId && join.rightNodeId !== nodeId,
      ),
    );
    setFilters((currentFilters) =>
      currentFilters.filter((filter) => filter.nodeId !== nodeId),
    );
  }

  function updateJoin(joinId: string, patch: Partial<BuilderJoin>) {
    setJoins((currentJoins) =>
      currentJoins.map((join) =>
        join.id === joinId ? { ...join, ...patch } : join,
      ),
    );
  }

  function addFilter() {
    if (nodes.length === 0) {
      return;
    }

    setFilters((currentFilters) => [
      ...currentFilters,
      {
        id: `filter-${Date.now()}`,
        nodeId: nodes[0].id,
        field: "",
        operator: "=",
        value: "",
        conjunction: "AND",
      },
    ]);
  }

  function updateFilter(filterId: string, patch: Partial<BuilderFilter>) {
    setFilters((currentFilters) =>
      currentFilters.map((filter) =>
        filter.id === filterId ? { ...filter, ...patch } : filter,
      ),
    );
  }

  function toggleNodeField(nodeId: string, fieldName: string) {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        const selectedFields = parseFields(node.fields);
        const selectedFieldNames = new Set(
          selectedFields.map((field) => normalizeFieldName(field)),
        );
        const normalizedFieldName = normalizeFieldName(fieldName);
        const nextFields = selectedFieldNames.has(normalizedFieldName)
          ? selectedFields.filter(
              (field) => normalizeFieldName(field) !== normalizedFieldName,
            )
          : [...selectedFields, normalizedFieldName];

        return { ...node, fields: nextFields.join(", ") };
      }),
    );
  }

  function applyJoinSuggestion(joinId: string) {
    const join = joins.find((item) => item.id === joinId);

    if (!join) {
      return;
    }

    const { leftNode, rightNode } = findJoinNodes(nodes, join);
    const suggestion = findJoinSuggestion(leftNode, rightNode, fieldsByEntity);

    if (!suggestion) {
      toast({
        title: "No join suggestion",
        description: "No matching fields were found for these two objects.",
        variant: "destructive",
      });
      return;
    }

    updateJoin(joinId, {
      leftField: suggestion.leftField,
      rightField: suggestion.rightField,
    });
  }

  function addSuggestedJoin() {
    if (nodes.length < 2) {
      return;
    }

    const leftNode = nodes[0];
    const rightNode = nodes[nodes.length - 1];
    const suggestion = findJoinSuggestion(leftNode, rightNode, fieldsByEntity);

    if (!suggestion) {
      toast({
        title: "No valid join fields",
        description:
          "Select objects with related fields or load their metadata first.",
        variant: "destructive",
      });
      return;
    }

    setJoins((currentJoins) => [
      ...currentJoins,
      {
        id: `join-${Date.now()}`,
        leftNodeId: leftNode.id,
        rightNodeId: rightNode.id,
        joinType: "INNER JOIN",
        leftField: suggestion.leftField,
        rightField: suggestion.rightField,
      },
    ]);
  }

  function applySql() {
    if (!generatedSql) {
      toast({
        title: "No query diagram",
        description: "Drop at least one object before applying SQL.",
        variant: "destructive",
      });
      return;
    }

    if (nodes.length > 1) {
      if (hasDuplicateAliases(nodes)) {
        toast({
          title: "Unique aliases required",
          description: "Each joined object must have a non-empty unique alias.",
          variant: "destructive",
        });
        return;
      }

      if (!hasSelectedProjectionFields(nodes)) {
        toast({
          title: "Select fields required",
          description: "Joined queries must select explicit fields.",
          variant: "destructive",
        });
        return;
      }

      const invalidJoin = effectiveJoins.find(
        (join) => !isJoinValid(join, nodes, fieldsByEntity),
      );

      if (effectiveJoins.length < nodes.length - 1 || invalidJoin) {
        toast({
          title: "Join fields required",
          description:
            "Choose fields that exist in both joined objects before applying SQL.",
          variant: "destructive",
        });
        return;
      }
    }

    const invalidFilter = filters.find(
      (filter) => !isFilterValid(filter, nodes, fieldsByEntity),
    );

    if (invalidFilter) {
      toast({
        title: "Valid WHERE condition required",
        description:
          "Choose a metadata field and enter a value for every filter.",
        variant: "destructive",
      });
      return;
    }

    onApplySql(generatedSql);
    toast({
      title: "SQL generated",
      description: "The visual model was applied to the SQL editor.",
      variant: "success",
    });
  }

  function renderFieldSelect({
    nodeId,
    value,
    onValueChange,
    placeholder,
  }: {
    nodeId: string;
    value: string;
    onValueChange: (fieldName: string) => void;
    placeholder: string;
  }) {
    const node = nodes.find((item) => item.id === nodeId);
    const fields = sortFields(getNodeFields(node, fieldsByEntity)).filter(
      (field) => !blockedJoinFields.has(getFieldName(field)),
    );

    if (!node || fields.length === 0) {
      return (
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          className="h-7"
        />
      );
    }

    return (
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className="h-7">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => {
            const fieldName = getFieldName(field);

            return (
              <SelectItem key={fieldName} value={fieldName}>
                <span className="flex items-center gap-2">
                  <span>{fieldName}</span>
                  {isKeyField(field) ? (
                    <span className="text-[10px] uppercase text-primary">
                      Key
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  function renderFilterFieldSelect(filter: BuilderFilter) {
    const node = nodes.find((item) => item.id === filter.nodeId);
    const fields = sortFields(getNodeFields(node, fieldsByEntity)).filter(
      (field) => !blockedJoinFields.has(getFieldName(field)),
    );

    if (!node || fields.length === 0) {
      return (
        <Input
          value={filter.field}
          onChange={(event) =>
            updateFilter(filter.id, {
              field: normalizeFieldName(event.target.value),
            })
          }
          placeholder="Field"
          className="h-7"
        />
      );
    }

    return (
      <Select
        value={filter.field || undefined}
        onValueChange={(field) => updateFilter(filter.id, { field })}
      >
        <SelectTrigger className="h-7">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => {
            const fieldName = getFieldName(field);

            return (
              <SelectItem key={fieldName} value={fieldName}>
                {fieldName}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[#f7fbff] px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
            Builder
          </Badge>
          <span className="text-xs text-muted-foreground">
            {nodes.length} objects
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={(value) => addNode(value)}>
            <SelectTrigger className="h-8 min-w-44">
              <SelectValue placeholder="Add object" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((entity) => (
                <SelectItem key={entity.name} value={entity.name}>
                  {entity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNodes([]);
              setJoins([]);
              setFilters([]);
            }}
            disabled={nodes.length === 0}
          >
            <RotateCcw />
            Reset
          </Button>
          <Button type="button" onClick={applySql}>
            <CornerDownRight />
            Apply SQL
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div
          className={cn(
            "relative min-h-[280px] overflow-hidden bg-[linear-gradient(#eef5fb_1px,transparent_1px),linear-gradient(90deg,#eef5fb_1px,transparent_1px)] bg-[size:24px_24px]",
            nodes.length === 0 && "grid place-items-center",
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          {joinConnectors.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 z-0 size-full"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="builder-join-arrow"
                  markerHeight="7"
                  markerWidth="7"
                  orient="auto"
                  refX="6"
                  refY="3.5"
                >
                  <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#0a6ed1" />
                </marker>
              </defs>
              {joinConnectors.map(({ join, geometry }) => {
                const isLeftJoin = join.joinType === "LEFT OUTER JOIN";

                return (
                  <g key={join.id}>
                    <path
                      d={geometry.path}
                      fill="none"
                      markerEnd="url(#builder-join-arrow)"
                      stroke={isLeftJoin ? "#b36b00" : "#0a6ed1"}
                      strokeDasharray={isLeftJoin ? "6 4" : undefined}
                      strokeLinecap="round"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx={geometry.startX}
                      cy={geometry.startY}
                      fill="#fff"
                      r="4"
                      stroke={isLeftJoin ? "#b36b00" : "#0a6ed1"}
                      strokeWidth="2"
                    />
                    <circle
                      cx={geometry.endX}
                      cy={geometry.endY}
                      fill="#fff"
                      r="4"
                      stroke={isLeftJoin ? "#b36b00" : "#0a6ed1"}
                      strokeWidth="2"
                    />
                    <foreignObject
                      height="24"
                      width="140"
                      x={geometry.labelX}
                      y={geometry.labelY}
                    >
                      <div className="flex h-6 items-center justify-center">
                        <div
                          className={cn(
                            "max-w-[136px] truncate rounded border bg-white px-2 py-0.5 text-[10px] font-medium shadow-sm",
                            isLeftJoin
                              ? "border-amber-300 text-amber-800"
                              : "border-[#9ac7f0] text-primary",
                          )}
                        >
                          {getJoinLabel(join)} · {join.leftField} ={" "}
                          {join.rightField}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          ) : null}

          {nodes.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#b8d6ef] bg-white px-4 py-3 text-sm text-muted-foreground shadow-sm">
              Drop objects here
            </div>
          ) : null}

          {nodes.map((node) => {
            const nodeFields = sortFields(getNodeFields(node, fieldsByEntity));
            const selectedFields = new Set(
              parseFields(node.fields).map((field) =>
                normalizeFieldName(field),
              ),
            );
            const allFields = nodeFields;
            const normalizedAlias = node.alias.trim().toLowerCase();
            const aliasIsInvalid =
              !normalizedAlias ||
              nodes.some(
                (item) =>
                  item.id !== node.id &&
                  item.alias.trim().toLowerCase() === normalizedAlias,
              );

            return (
              <div
                key={node.id}
                className={cn(
                  "absolute z-10 rounded-md border border-[#b8d6ef] bg-white shadow-sm will-change-transform",
                  activeDragNodeId === node.id &&
                    "shadow-lg ring-2 ring-primary/20",
                )}
                style={{ left: node.x, top: node.y, width: nodeWidth }}
                data-builder-node
              >
                <div className="flex items-center gap-2 rounded-t-md border-b border-border bg-[#f7fbff] px-2 py-1.5">
                  <span
                    className="cursor-grab rounded p-0.5 text-muted-foreground active:cursor-grabbing"
                    onPointerCancel={handleNodeDragEnd}
                    onPointerDown={(event) => handleNodeDragStart(event, node)}
                    onPointerMove={handleNodeDragMove}
                    onPointerUp={handleNodeDragEnd}
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <Table2 className="size-4 text-primary" />
                  <div className="min-w-0 flex-1 truncate font-medium">
                    {node.entityName}
                  </div>
                  {loadingFields[node.entityName] ? (
                    <LoaderCircle className="size-3.5 animate-spin text-primary" />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeNode(node.id)}
                    aria-label={`Remove ${node.entityName}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="space-y-2 p-2">
                  <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                    <span className="text-xs text-muted-foreground">Alias</span>
                    <Input
                      value={node.alias}
                      onChange={(event) =>
                        updateNode(node.id, {
                          alias: event.target.value.trim().toLowerCase(),
                        })
                      }
                      className={cn(
                        "h-7",
                        aliasIsInvalid &&
                          "border-destructive focus-visible:ring-destructive/25",
                      )}
                    />
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">
                      Fields
                    </span>
                    <Input
                      value={node.fields}
                      onChange={(event) =>
                        updateNode(node.id, { fields: event.target.value })
                      }
                      placeholder={nodes.length === 1 ? "*" : "CARRID, CONNID"}
                      className="h-7"
                    />
                    {allFields.length > 0 ? (
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {allFields.length} fields
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateNode(node.id, {
                                fields: allFields
                                  .map((f) => getFieldName(f))
                                  .join(", "),
                              })
                            }
                            className="text-[10px] text-primary hover:underline"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => updateNode(node.id, { fields: "" })}
                            className="text-[10px] text-muted-foreground hover:underline"
                          >
                            Clear
                          </button>
                        </span>
                      </div>
                    ) : null}
                    {allFields.length > 0 ? (
                      <div className="flex max-h-28 flex-wrap content-start gap-1 overflow-auto">
                        {allFields.map((field) => {
                          const fieldName = getFieldName(field);
                          const selected = selectedFields.has(fieldName);

                          return (
                            <button
                              key={fieldName}
                              type="button"
                              onClick={() =>
                                toggleNodeField(node.id, fieldName)
                              }
                              className={cn(
                                "h-5 rounded border px-1.5 text-[10px] leading-none",
                                selected
                                  ? "border-primary bg-[#e5f2ff] text-primary"
                                  : "border-border bg-white text-muted-foreground hover:border-primary/60 hover:text-primary",
                              )}
                            >
                              {fieldName}
                              {isKeyField(field) ? (
                                <span className="ml-1 text-[9px] uppercase">
                                  Key
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {allFields.length > 0 ? (
                      <div className="border-t border-border pt-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            Order By
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateNode(node.id, {
                                orderBy: [
                                  ...node.orderBy,
                                  { field: "", direction: "ASC" },
                                ],
                              })
                            }
                            className="text-[10px] text-primary hover:underline"
                          >
                            + Add
                          </button>
                        </div>
                        {node.orderBy.map((order, oi) => (
                          <div
                            key={oi}
                            className="mb-1 flex items-center gap-1"
                          >
                            <Select
                              value={order.field}
                              onValueChange={(v) => {
                                const next = [...node.orderBy];
                                next[oi] = { ...next[oi], field: v };
                                updateNode(node.id, { orderBy: next });
                              }}
                            >
                              <SelectTrigger className="h-6 flex-1 text-[10px]">
                                <SelectValue placeholder="Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {allFields.map((f) => (
                                  <SelectItem
                                    key={getFieldName(f)}
                                    value={getFieldName(f)}
                                  >
                                    {getFieldName(f)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={order.direction}
                              onValueChange={(v) => {
                                const next = [...node.orderBy];
                                next[oi] = {
                                  ...next[oi],
                                  direction: v as "ASC" | "DESC",
                                };
                                updateNode(node.id, { orderBy: next });
                              }}
                            >
                              <SelectTrigger className="h-6 w-16 text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ASC">ASC</SelectItem>
                                <SelectItem value="DESC">DESC</SelectItem>
                              </SelectContent>
                            </Select>
                            <button
                              type="button"
                              onClick={() => {
                                const next = node.orderBy.filter(
                                  (_, i) => i !== oi,
                                );
                                updateNode(node.id, { orderBy: next });
                              }}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {getEntityLabel(node.entityName, entities)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="flex min-h-0 flex-col border-t border-border bg-[#fbfdff] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="text-sm font-semibold">Joins</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                addSuggestedJoin();
              }}
              disabled={nodes.length < 2}
            >
              <Plus />
              Join
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 p-3">
              {joins.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-white p-3 text-xs text-muted-foreground">
                  No joins
                </div>
              ) : null}

              {joins.map((join) => {
                const effectiveJoin = applySuggestionToJoin(
                  join,
                  nodes,
                  fieldsByEntity,
                );

                return (
                  <div
                    key={join.id}
                    className="space-y-2 rounded-md border border-border bg-white p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Select
                        value={join.joinType}
                        onValueChange={(value) =>
                          updateJoin(join.id, {
                            joinType: value as BuilderJoin["joinType"],
                          })
                        }
                      >
                        <SelectTrigger className="h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INNER JOIN">Inner join</SelectItem>
                          <SelectItem value="LEFT OUTER JOIN">
                            Left outer join
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyJoinSuggestion(join.id)}
                      >
                        <Sparkles />
                        Suggest
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setJoins((currentJoins) =>
                            currentJoins.filter((item) => item.id !== join.id),
                          )
                        }
                        aria-label="Remove join"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={join.leftNodeId}
                        onValueChange={(value) =>
                          updateJoin(join.id, { leftNodeId: value })
                        }
                      >
                        <SelectTrigger className="h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {nodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>
                              {node.alias}: {node.entityName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={join.rightNodeId}
                        onValueChange={(value) =>
                          updateJoin(join.id, { rightNodeId: value })
                        }
                      >
                        <SelectTrigger className="h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {nodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>
                              {node.alias}: {node.entityName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {renderFieldSelect({
                        nodeId: join.leftNodeId,
                        value: effectiveJoin.leftField,
                        onValueChange: (leftField) =>
                          updateJoin(join.id, { leftField }),
                        placeholder: "Left field",
                      })}
                      {renderFieldSelect({
                        nodeId: join.rightNodeId,
                        value: effectiveJoin.rightField,
                        onValueChange: (rightField) =>
                          updateJoin(join.id, { rightField }),
                        placeholder: "Right field",
                      })}
                    </div>
                    {!isJoinValid(effectiveJoin, nodes, fieldsByEntity) ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Choose valid metadata fields before applying SQL.
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <Separator />

              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Filters</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFilter}
                  disabled={nodes.length === 0}
                >
                  <Plus />
                  Where
                </Button>
              </div>

              {filters.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-white p-3 text-xs text-muted-foreground">
                  No filters
                </div>
              ) : null}

              {filters.map((filter, index) => {
                const validFilter = isFilterValid(
                  filter,
                  nodes,
                  fieldsByEntity,
                );

                return (
                  <div
                    key={filter.id}
                    className="space-y-2 rounded-md border border-border bg-white p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {index > 0 ? (
                        <Select
                          value={filter.conjunction}
                          onValueChange={(value) =>
                            updateFilter(filter.id, {
                              conjunction:
                                value as BuilderFilter["conjunction"],
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="h-7 rounded">
                          WHERE
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setFilters((currentFilters) =>
                            currentFilters.filter(
                              (item) => item.id !== filter.id,
                            ),
                          )
                        }
                        aria-label="Remove filter"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={filter.nodeId}
                        onValueChange={(nodeId) =>
                          updateFilter(filter.id, { nodeId, field: "" })
                        }
                      >
                        <SelectTrigger className="h-7">
                          <SelectValue placeholder="Object" />
                        </SelectTrigger>
                        <SelectContent>
                          {nodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>
                              {nodes.length > 1
                                ? `${node.alias}: ${node.entityName}`
                                : node.entityName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {renderFilterFieldSelect(filter)}
                      <Select
                        value={filter.operator}
                        onValueChange={(operator) =>
                          updateFilter(filter.id, {
                            operator: operator as BuilderFilter["operator"],
                          })
                        }
                      >
                        <SelectTrigger className="h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="=">=</SelectItem>
                          <SelectItem value="<>">&lt;&gt;</SelectItem>
                          <SelectItem value=">">&gt;</SelectItem>
                          <SelectItem value=">=">&gt;=</SelectItem>
                          <SelectItem value="<">&lt;</SelectItem>
                          <SelectItem value="<=">&lt;=</SelectItem>
                          <SelectItem value="LIKE">LIKE</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={filter.value}
                        onChange={(event) =>
                          updateFilter(filter.id, {
                            value: event.target.value,
                          })
                        }
                        placeholder="Value"
                        className="h-7"
                      />
                    </div>
                    {!validFilter ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Choose a field and value for this condition.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <Separator />
          <div className="space-y-2 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              Generated SQL
            </div>
            <pre className="max-h-36 overflow-auto rounded-md border border-border bg-white p-2 font-mono text-xs leading-5 text-foreground">
              {generatedSql || "SELECT ..."}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
