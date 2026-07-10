"use client";

import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import {
  validateOpenSql,
  type SqlValidationError,
} from "@/lib/openSqlValidation";
import { sqlAssistService } from "@/services/sqlAssistService";
import type { SapSqlwbField } from "@/types/sap";
import type { WorkbenchEntity } from "@/types/workbench";

type MonacoEnvironment = {
  getWorker?: (workerId: string, label: string) => Worker;
};

declare global {
  interface Window {
    MonacoEnvironment?: MonacoEnvironment;
    __openSqlWorkbenchEditor?: {
      setValue: (value: string) => void;
      getValue: () => string;
      getSelection: () => string;
    };
  }
}

type SqlEditorProps = {
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  onValidationChange?: (errors: SqlValidationError[]) => void;
  height?: string;
  entities?: WorkbenchEntity[];
  selectedEntityName?: string;
};

type EditorContext = {
  entities: WorkbenchEntity[];
  selectedEntityName: string;
};

type CompletionAssistState = {
  fieldCache: Map<string, SapSqlwbField[]>;
};

type DynamicCompletionResult = {
  suggestions: monaco.languages.CompletionItem[];
  exclusive: boolean;
};

type SemanticValidationError = {
  message: string;
  startIndex: number;
  length: number;
};

type QueryTableReference = {
  tableName: string;
  alias: string;
};

type FieldCompletionContext = {
  range: monaco.IRange;
  token: string;
};

const sqlKeywords = [
  "SELECT",
  "TOP",
  "FROM",
  "AS",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "ORDER BY",
  "GROUP BY",
  "HAVING",
  "UP TO",
  "ROWS",
  "DISTINCT",
  "ASC",
  "DESC",
  "LIKE",
  "BETWEEN",
  "IN",
  "IS NULL",
  "IS NOT NULL",
  "INNER JOIN",
  "LEFT OUTER JOIN",
  "LEFT JOIN",
  "ON",
  "LIMIT",
  "CLIENT SPECIFIED",
  "BYPASSING BUFFER",
  "INTO TABLE",
  "FOR ALL ENTRIES IN",
  "DESCRIBE",
  "KEYS",
  "FOR",
  "SHOW",
  "LAST SYNC",
];

const sqlFunctions = [
  "COUNT(*)",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "UPPER",
  "LOWER",
  "CONCAT",
  "SUBSTRING",
  "COALESCE",
  "CAST",
];

const sqlOperators = [
  "=",
  "<>",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
];

let isSqlLanguageConfigured = false;
const defaultEditorFontSize = 13;
const minEditorFontSize = 10;
const maxEditorFontSize = 28;

function configureSqlLanguage() {
  if (isSqlLanguageConfigured) {
    return;
  }

  monaco.languages.setMonarchTokensProvider("sql", {
    ignoreCase: true,
    tokenizer: {
      root: [
        [
          /\b(SELECT|TOP|FROM|AS|WHERE|AND|OR|NOT|ORDER|BY|GROUP|HAVING|UP|TO|ROWS|COUNT|SUM|AVG|MIN|MAX|DISTINCT|ASC|DESC|LIKE|BETWEEN|IN|IS|NULL|INNER|LEFT|OUTER|JOIN|ON|LIMIT|CLIENT|SPECIFIED|BYPASSING|BUFFER|INTO|TABLE|ALL|ENTRIES|DESCRIBE|KEYS|FOR|SHOW|LAST|SYNC)\b/,
          "keyword",
        ],
        [/'(?:[^']|'')*'/, "string"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/--.*$/, "comment"],
        [/[=<>!]+/, "operator"],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration("sql", {
    comments: {
      lineComment: "--",
    },
    brackets: [
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "'", close: "'" },
      { open: "(", close: ")" },
    ],
    surroundingPairs: [
      { open: "'", close: "'" },
      { open: "(", close: ")" },
    ],
  });

  isSqlLanguageConfigured = true;
}

function markerRangeForIndex(
  model: monaco.editor.ITextModel,
  startIndex: number,
  length: number,
) {
  const start = model.getPositionAt(Math.max(0, startIndex));
  const end = model.getPositionAt(Math.max(0, startIndex + Math.max(1, length)));

  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

function buildCompletionItems(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  context: EditorContext,
  dynamicSuggestions: monaco.languages.CompletionItem[] = [],
): monaco.languages.CompletionItem[] {
  const word = model.getWordUntilPosition(position);
  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
  const selectedEntity = context.entities.find(
    (entity) => entity.name === context.selectedEntityName,
  );
  const selectedEntityName =
    context.selectedEntityName || context.entities[0]?.name || "EntitySet";
  const firstKeyField = selectedEntity?.keyFields[0] ?? "Field";
  const keywordSuggestions = sqlKeywords.map((keyword) => ({
    label: keyword,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: keyword,
    range,
  }));
  const functionSuggestions = sqlFunctions.map((sqlFunction) => ({
    label: sqlFunction,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: sqlFunction.includes("(")
      ? sqlFunction
      : `${sqlFunction}(\${1:${firstKeyField}})`,
    insertTextRules:
      monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range,
  }));
  const operatorSuggestions = sqlOperators.map((operator) => ({
    label: operator,
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: operator,
    range,
  }));
  const snippetSuggestions: monaco.languages.CompletionItem[] = [
    {
      label: "SELECT TOP",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `SELECT TOP \${1:25} * FROM \${2:${selectedEntityName}}`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Preview rows from an entity set",
      range,
    },
    {
      label: "COUNT records",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `SELECT COUNT(*) FROM \${1:${selectedEntityName}}`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Count rows from an entity set",
      range,
    },
    {
      label: "SELECT fields",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `SELECT \${1:${firstKeyField}} FROM \${2:${selectedEntityName}}`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Select specific fields",
      range,
    },
    {
      label: "INNER JOIN query",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        "SELECT ${1:a~field}, ${2:b~field}\nFROM ${3:table_a} AS a\nINNER JOIN ${4:table_b} AS b ON a~${5:key} = b~${5:key}\nORDER BY ${1:a~field}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Contract-supported INNER JOIN query with aliases",
      range,
    },
    {
      label: "LEFT OUTER JOIN query",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        "SELECT ${1:a~field}, ${2:b~field}\nFROM ${3:table_a} AS a\nLEFT OUTER JOIN ${4:table_b} AS b ON a~${5:key} = b~${5:key}\nORDER BY ${1:a~field}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Contract-supported LEFT OUTER JOIN query with aliases",
      range,
    },
    {
      label: "LEFT JOIN query",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        "SELECT ${1:a~field}, ${2:b~field}\nFROM ${3:table_a} AS a\nLEFT JOIN ${4:table_b} AS b ON a~${5:key} = b~${5:key}\nORDER BY ${1:a~field}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "LEFT JOIN alias form accepted by backend",
      range,
    },
    {
      label: "GROUP BY aggregate",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `SELECT \${1:${firstKeyField}}, COUNT(*) AS \${2:row_count}\nFROM \${3:${selectedEntityName}}\nGROUP BY \${1:${firstKeyField}}\nORDER BY \${2:row_count} DESC`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "GROUP BY with aggregate alias",
      range,
    },
    {
      label: "WHERE filter",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `WHERE \${1:${firstKeyField}} = '\${2:Value}'`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Add a filter condition",
      range,
    },
    {
      label: "ORDER BY",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `ORDER BY \${1:${firstKeyField}} \${2|ASC,DESC|}`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Sort query results",
      range,
    },
    {
      label: "GROUP BY",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `GROUP BY \${1:${firstKeyField}}`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Group rows by fields",
      range,
    },
    {
      label: "HAVING",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "HAVING COUNT(*) > ${1:0}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Filter grouped rows",
      range,
    },
    {
      label: "LIMIT",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "LIMIT ${1:100}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Limit returned rows",
      range,
    },
    {
      label: "UP TO rows",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "UP TO ${1:100} ROWS",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "ABAP Open SQL row limit",
      range,
    },
    {
      label: "SELECT UP TO rows",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `SELECT * FROM \${1:${selectedEntityName}} UP TO \${2:100} ROWS`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Select rows with ABAP Open SQL row limit",
      range,
    },
    {
      label: "CLIENT SPECIFIED",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "CLIENT SPECIFIED",
      detail: "ABAP Open SQL client handling modifier",
      range,
    },
    {
      label: "BYPASSING BUFFER",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "BYPASSING BUFFER",
      detail: "ABAP Open SQL buffering modifier",
      range,
    },
    {
      label: "INTO TABLE",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "INTO TABLE ${1:lt_result}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "ABAP Open SQL target table",
      range,
    },
    {
      label: "FOR ALL ENTRIES",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: "FOR ALL ENTRIES IN ${1:lt_source} WHERE ${2:Field} = ${1:lt_source}-${2:Field}",
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "ABAP Open SQL FOR ALL ENTRIES pattern",
      range,
    },
    {
      label: "DESCRIBE KEYS",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `DESCRIBE KEYS FOR \${1:${selectedEntityName}}`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Inspect entity key fields",
      range,
    },
    {
      label: "SHOW LAST SYNC",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `SHOW LAST SYNC FOR \${1:${selectedEntityName}}`,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: "Show synchronization metadata",
      range,
    },
  ];

  return [
    ...dynamicSuggestions,
    ...snippetSuggestions,
    ...keywordSuggestions,
    ...functionSuggestions,
    ...operatorSuggestions,
  ];
}

function getWordRange(model: monaco.editor.ITextModel, position: monaco.Position) {
  const word = model.getWordUntilPosition(position);

  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

function getTableCompletionContext(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
) {
  const offset = model.getOffsetAt(position);
  const beforeCursor = model.getValue().slice(0, offset);
  const match =
    /\b(?:FROM|INNER\s+JOIN|LEFT(?:\s+OUTER)?\s+JOIN)\s+([A-Z0-9_./-]*)$/i.exec(beforeCursor);

  if (!match) {
    return null;
  }

  const token = match[1] ?? "";

  return {
    token,
    range: getWordRange(model, position),
  };
}

function getJoinFieldCompletionContext(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): FieldCompletionContext | null {
  const offset = model.getOffsetAt(position);
  const beforeCursor = model.getValue().slice(0, offset);
  const onMatches = [...beforeCursor.matchAll(/\bON\b/gi)];
  const lastOnMatch = onMatches.at(-1);

  if (lastOnMatch?.index === undefined) {
    return null;
  }

  const textAfterOn = beforeCursor.slice(lastOnMatch.index + lastOnMatch[0].length);
  const tokenMatch =
    /(?:^|[\s(=<>!,])([A-Z_][A-Z0-9_]*(?:~[A-Z0-9_]*)?)$/i.exec(textAfterOn);
  const token = tokenMatch?.[1] ?? "";

  if (!token) {
    return null;
  }

  const tokenStartOffset = offset - token.length;
  const tokenStart = model.getPositionAt(tokenStartOffset);
  const tokenEnd = model.getPositionAt(offset);

  return {
    token,
    range: {
      startLineNumber: tokenStart.lineNumber,
      endLineNumber: tokenEnd.lineNumber,
      startColumn: tokenStart.column,
      endColumn: tokenEnd.column,
    },
  };
}

function getPrimaryTableName(query: string) {
  return /\bFROM\s+([A-Z0-9_./-]+)/i.exec(query)?.[1]?.toUpperCase() ?? "";
}

function getJoinTableReferences(query: string): QueryTableReference[] {
  const references: QueryTableReference[] = [];
  const fromAliasMatch =
    /\bFROM\s+([A-Z0-9_./-]+)\s+AS\s+([A-Z_][A-Z0-9_]*)/i.exec(query);

  if (fromAliasMatch?.[1] && fromAliasMatch[2]) {
    references.push({
      tableName: fromAliasMatch[1].toUpperCase(),
      alias: fromAliasMatch[2],
    });
  }

  for (const joinMatch of query.matchAll(
    /\b(?:INNER\s+JOIN|LEFT(?:\s+OUTER)?\s+JOIN)\s+([A-Z0-9_./-]+)\s+AS\s+([A-Z_][A-Z0-9_]*)/gi,
  )) {
    if (joinMatch[1] && joinMatch[2]) {
      references.push({
        tableName: joinMatch[1].toUpperCase(),
        alias: joinMatch[2],
      });
    }
  }

  return references;
}

function hasJoin(query: string) {
  return /\bJOIN\b/i.test(query);
}

function shouldAutoTriggerJoinFieldSuggest(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  context: EditorContext,
) {
  const fieldContext = getJoinFieldCompletionContext(model, position);

  if (!fieldContext || fieldContext.token.includes("~")) {
    return false;
  }

  const normalizedToken = fieldContext.token.toLowerCase();
  const tableReferences = getJoinTableReferences(model.getValue());

  return tableReferences.some(
    (tableReference) =>
      tableReference.alias.toLowerCase() === normalizedToken &&
      isKnownTableName(tableReference.tableName, context),
  );
}

function shouldAutoTriggerClauseFieldSuggest(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  context: EditorContext,
) {
  const offset = model.getOffsetAt(position);
  const beforeCursor = model.getValue().slice(0, offset);

  if (!/\b(?:ORDER\s+BY|GROUP\s+BY)\s*$/i.test(beforeCursor)) {
    return false;
  }

  const tableReferences = getJoinTableReferences(model.getValue());

  if (tableReferences.length > 1) {
    return tableReferences.every((tableReference) =>
      isKnownTableName(tableReference.tableName, context),
    );
  }

  const tableName = getPrimaryTableName(model.getValue());

  return Boolean(tableName && isKnownTableName(tableName, context));
}

function getKnownEntityNames(context: EditorContext, assistState: CompletionAssistState) {
  const names = new Set<string>();

  context.entities.forEach((entity) => {
    if (entity.name) {
      names.add(entity.name);
    }
  });

  assistState.fieldCache.forEach((fields, tableName) => {
    if (fields.length > 0) {
      names.add(tableName);
    }
  });

  return [...names];
}

function isKnownTableName(
  tableName: string,
  context: EditorContext,
) {
  const normalizedTableName = tableName.toLowerCase();

  if (
    context.entities.some(
      (entity) => entity.name.toLowerCase() === normalizedTableName,
    )
  ) {
    return true;
  }
  return false;
}

function getFieldCompletionContext(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): FieldCompletionContext | null {
  const query = model.getValue();
  const offset = model.getOffsetAt(position);
  const fromMatch = /\bFROM\s+([A-Z0-9_./-]+)/i.exec(query);

  if (!fromMatch?.[1]) {
    return null;
  }

  const beforeCursor = query.slice(0, offset);

  if (offset < fromMatch.index) {
    return {
      range: getWordRange(model, position),
      token: model.getWordUntilPosition(position).word,
    };
  }

  const fieldContextMatch =
    /\b(?:WHERE|ORDER\s+BY|GROUP\s+BY|HAVING|ON|AND|OR|BY)\s+([A-Z0-9_./~]*)$/i.exec(
      beforeCursor,
    );

  if (!fieldContextMatch) {
    return null;
  }

  const token = fieldContextMatch[1] ?? "";
  const tokenStartOffset = offset - token.length;
  const tokenStart = model.getPositionAt(tokenStartOffset);
  const tokenEnd = model.getPositionAt(offset);

  return {
    token,
    range: token
      ? {
          startLineNumber: tokenStart.lineNumber,
          endLineNumber: tokenEnd.lineNumber,
          startColumn: tokenStart.column,
          endColumn: tokenEnd.column,
        }
      : {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column,
        },
  };
}

function tableCompletionItems(
  entities: WorkbenchEntity[],
  token: string,
  range: monaco.IRange,
): monaco.languages.CompletionItem[] {
  const normalizedToken = token.toLowerCase();

  return entities
    .filter((entity) => {
      return entity.name.toLowerCase().startsWith(normalizedToken);
    })
    .map((entity) => ({
      label: entity.name,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: entity.name,
      detail: entity.description,
      range,
    }));
}

function fieldCompletionItems(
  fields: SapSqlwbField[],
  range: monaco.IRange,
): monaco.languages.CompletionItem[] {
  return fields
    .filter((field) => field.FieldName)
    .sort((a, b) => Number(a.Position ?? 0) - Number(b.Position ?? 0))
    .map((field) => ({
      label: field.FieldName ?? "",
      kind: monaco.languages.CompletionItemKind.Field,
      insertText: field.FieldName ?? "",
      detail: [field.AbapType, field.Element, field.Label]
        .filter(Boolean)
        .join(" | "),
      range,
    }));
}

function joinedFieldCompletionItems(
  tableReferences: QueryTableReference[],
  fieldCache: Map<string, SapSqlwbField[]>,
  range: monaco.IRange,
  token: string,
): monaco.languages.CompletionItem[] {
  const normalizedToken = token.toLowerCase();

  return tableReferences.flatMap((tableReference) => {
    const fields = fieldCache.get(tableReference.tableName) ?? [];

    return fields
      .filter((field) => field.FieldName)
      .sort((a, b) => Number(a.Position ?? 0) - Number(b.Position ?? 0))
      .map((field) => {
        const fieldName = field.FieldName ?? "";
        const insertText = `${tableReference.alias}~${fieldName}`;

        return {
          label: insertText,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText,
          detail: [
            tableReference.tableName,
            field.AbapType,
            field.Element,
            field.Label,
          ]
            .filter(Boolean)
            .join(" | "),
          range,
        };
      })
      .filter((item) => {
        if (!normalizedToken) {
          return true;
        }

        return item.insertText.toLowerCase().startsWith(normalizedToken);
      });
  });
}

function stripTableQualifier(fieldName: string) {
  return fieldName.split(/[.~]/).pop()?.toUpperCase() ?? fieldName.toUpperCase();
}

function addFieldError(
  errors: SemanticValidationError[],
  fieldName: string,
  startIndex: number,
  validFieldNames: Set<string>,
  tableName: string,
) {
  const normalizedField = stripTableQualifier(fieldName);

  if (validFieldNames.has(normalizedField)) {
    return;
  }

  errors.push({
    message: `Unknown field "${fieldName}" for table ${tableName}.`,
    startIndex,
    length: fieldName.length,
  });
}

function addDelimitedFieldErrors({
  errors,
  clause,
  clauseStartIndex,
  validFieldNames,
  tableName,
}: {
  errors: SemanticValidationError[];
  clause: string;
  clauseStartIndex: number;
  validFieldNames: Set<string>;
  tableName: string;
}) {
  clause.split(",").reduce((offset, part) => {
    const trimmedPart = part.trim();
    const leadingWhitespace = part.length - part.trimStart().length;
    const fieldMatch = /^([A-Z_][A-Z0-9_./~]*)/i.exec(trimmedPart);

    if (fieldMatch?.[1] && fieldMatch[1] !== "*") {
      addFieldError(
        errors,
        fieldMatch[1],
        clauseStartIndex + offset + leadingWhitespace,
        validFieldNames,
        tableName,
      );
    }

    return offset + part.length + 1;
  }, 0);
}

function getProjectionAliases(projection: string) {
  return projection
    .split(",")
    .map((part) => /\s+AS\s+([A-Z_][A-Z0-9_]*)\s*$/i.exec(part.trim())?.[1])
    .filter((alias): alias is string => Boolean(alias))
    .map((alias) => alias.toUpperCase());
}

function getClauseSlice(query: string, clausePattern: RegExp, stopPattern: RegExp) {
  const clauseMatch = clausePattern.exec(query);

  if (!clauseMatch) {
    return null;
  }

  const startIndex = clauseMatch.index + clauseMatch[0].length;
  const remaining = query.slice(startIndex);
  const stopMatch = stopPattern.exec(remaining);
  const endIndex = stopMatch ? startIndex + stopMatch.index : query.length;

  return {
    text: query.slice(startIndex, endIndex),
    startIndex,
  };
}

function getFieldValidationErrors(
  query: string,
  assistState: CompletionAssistState,
) {
  if (hasJoin(query)) {
    return [] as SemanticValidationError[];
  }

  const tableName = getPrimaryTableName(query);
  const fields = tableName ? assistState.fieldCache.get(tableName) : undefined;

  if (!tableName || !fields || fields.length === 0) {
    return [] as SemanticValidationError[];
  }

  const validFieldNames = new Set(
    fields
      .map((field) => field.FieldName?.toUpperCase())
      .filter((fieldName): fieldName is string => Boolean(fieldName)),
  );
  const errors: SemanticValidationError[] = [];
  const fromMatch = /\bFROM\b/i.exec(query);
  const projectionAliases = new Set<string>();

  if (fromMatch) {
    const projectionStart = "SELECT".length;
    const projection = query.slice(projectionStart, fromMatch.index).trim();
    const projectionLeadingWhitespace =
      query.slice(projectionStart, fromMatch.index).length -
      query.slice(projectionStart, fromMatch.index).trimStart().length;
    getProjectionAliases(projection).forEach((alias) => {
      projectionAliases.add(alias);
    });

    if (
      projection &&
      projection !== "*" &&
      !/\bCOUNT\s*\(\s*\*\s*\)/i.test(projection)
    ) {
      const normalizedProjection = projection.replace(/^\bTOP\s+\d+\s+/i, "");
      const topOffset = projection.length - normalizedProjection.length;
      addDelimitedFieldErrors({
        errors,
        clause: normalizedProjection,
        clauseStartIndex:
          projectionStart + projectionLeadingWhitespace + topOffset,
        validFieldNames,
        tableName,
      });
    }
  }

  const orderByClause = getClauseSlice(
    query,
    /\bORDER\s+BY\b/i,
    /\b(UP\s+TO|LIMIT)\b/i,
  );
  if (orderByClause) {
    const validOrderByNames = new Set([
      ...validFieldNames,
      ...projectionAliases,
    ]);

    addDelimitedFieldErrors({
      errors,
      clause: orderByClause.text,
      clauseStartIndex: orderByClause.startIndex,
      validFieldNames: validOrderByNames,
      tableName,
    });
  }

  const groupByClause = getClauseSlice(
    query,
    /\bGROUP\s+BY\b/i,
    /\b(HAVING|ORDER\s+BY|UP\s+TO|LIMIT)\b/i,
  );
  if (groupByClause) {
    addDelimitedFieldErrors({
      errors,
      clause: groupByClause.text,
      clauseStartIndex: groupByClause.startIndex,
      validFieldNames,
      tableName,
    });
  }

  const conditionalClauses = [
    getClauseSlice(query, /\bWHERE\b/i, /\b(GROUP\s+BY|HAVING|ORDER\s+BY|UP\s+TO|LIMIT)\b/i),
    getClauseSlice(query, /\bHAVING\b/i, /\b(ORDER\s+BY|UP\s+TO|LIMIT)\b/i),
    getClauseSlice(query, /\bON\b/i, /\b(WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|UP\s+TO|LIMIT)\b/i),
  ].filter((clause): clause is { text: string; startIndex: number } =>
    Boolean(clause),
  );

  conditionalClauses.forEach((clause) => {
    for (const match of clause.text.matchAll(
      /\b([A-Z_][A-Z0-9_./~]*)\s*(?:=|<>|!=|>=|<=|>|<|LIKE|IN|BETWEEN|IS)\b/gi,
    )) {
      if (match.index !== undefined && match[1]) {
        addFieldError(
          errors,
          match[1],
          clause.startIndex + match.index,
          validFieldNames,
          tableName,
        );
      }
    }
  });

  return errors;
}

async function ensureFieldsForCurrentTable(
  model: monaco.editor.ITextModel,
  assistState: CompletionAssistState,
  context: EditorContext,
) {
  const tableName = getPrimaryTableName(model.getValue());

  if (!tableName || assistState.fieldCache.has(tableName)) {
    return;
  }

  if (!isKnownTableName(tableName, context)) {
    return;
  }

  assistState.fieldCache.set(tableName, await sqlAssistService.getFields(tableName));
}

async function ensureFieldsForJoinTables(
  tableReferences: QueryTableReference[],
  assistState: CompletionAssistState,
  context: EditorContext,
) {
  await Promise.all(
    tableReferences.map(async (tableReference) => {
      if (
        assistState.fieldCache.has(tableReference.tableName) ||
        !isKnownTableName(tableReference.tableName, context)
      ) {
        return;
      }

      assistState.fieldCache.set(
        tableReference.tableName,
        await sqlAssistService.getFields(tableReference.tableName),
      );
    }),
  );
}

async function buildDynamicCompletionItems(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  assistState: CompletionAssistState,
  context: EditorContext,
): Promise<DynamicCompletionResult> {
  const tableContext = getTableCompletionContext(model, position);

  if (tableContext) {
    const token = tableContext.token;

    if (!token) {
      return {
        suggestions: [],
        exclusive: true,
      };
    }

    return {
      suggestions: tableCompletionItems(
        context.entities,
        token,
        tableContext.range,
      ),
      exclusive: true,
    };
  }

  const tableName = getPrimaryTableName(model.getValue());
  const query = model.getValue();

  if (!tableName) {
    return {
      suggestions: [],
      exclusive: false,
    };
  }

  const joinTableReferences = getJoinTableReferences(query);

  if (joinTableReferences.length > 1) {
    const fieldContext =
      getJoinFieldCompletionContext(model, position) ??
      getFieldCompletionContext(model, position);

    if (!fieldContext) {
      return {
        suggestions: [],
        exclusive: false,
      };
    }

    if (
      joinTableReferences.some(
        (tableReference) => !isKnownTableName(tableReference.tableName, context),
      )
    ) {
      return {
        suggestions: [],
        exclusive: true,
      };
    }

    await ensureFieldsForJoinTables(joinTableReferences, assistState, context);

    return {
      suggestions: joinedFieldCompletionItems(
        joinTableReferences,
        assistState.fieldCache,
        fieldContext.range,
        fieldContext.token,
      ),
      exclusive: true,
    };
  }

  const fieldContext = getFieldCompletionContext(model, position);

  if (!fieldContext) {
    return {
      suggestions: [],
      exclusive: false,
    };
  }

  if (!isKnownTableName(tableName, context)) {
    return {
      suggestions: [],
      exclusive: true,
    };
  }

  if (!assistState.fieldCache.has(tableName)) {
    assistState.fieldCache.set(tableName, await sqlAssistService.getFields(tableName));
  }

  return {
    suggestions: fieldCompletionItems(
      assistState.fieldCache.get(tableName) ?? [],
      fieldContext.range,
    ),
    exclusive: true,
  };
}

export function SqlEditor({
  value,
  language = "sql",
  onChange,
  onValidationChange,
  height = "360px",
  entities = [],
  selectedEntityName = "",
}: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const completionProviderRef =
    useRef<monaco.IDisposable | null>(null);
  const assistStateRef = useRef<CompletionAssistState>({
    fieldCache: new Map(),
  });
  const contextRef = useRef<EditorContext>({
    entities,
    selectedEntityName,
  });
  const onValidationChangeRef = useRef(onValidationChange);
  const dynamicValidationSeqRef = useRef(0);
  const editorFontSizeRef = useRef(defaultEditorFontSize);

  useEffect(() => {
    contextRef.current = {
      entities,
      selectedEntityName,
    };
  }, [entities, selectedEntityName]);

  useEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    window.MonacoEnvironment = {
      getWorker: () =>
        new Worker(
          new URL(
            "monaco-editor/esm/vs/editor/editor.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        ),
    };

    configureSqlLanguage();

    completionProviderRef.current =
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: [" ", ".", "_", "'", "~"],
        provideCompletionItems: async (model, position) => {
          const dynamicResult = await buildDynamicCompletionItems(
            model,
            position,
            assistStateRef.current,
            contextRef.current,
          );

          if (dynamicResult.exclusive) {
            return {
              suggestions: dynamicResult.suggestions,
            };
          }

          return {
            suggestions: buildCompletionItems(
              model,
              position,
              contextRef.current,
              dynamicResult.suggestions,
            ),
          };
        },
      });

    function updateMarkers(model: monaco.editor.ITextModel) {
      const validationErrors = validateOpenSql(model.getValue(), {
        availableEntityNames: getKnownEntityNames(
          contextRef.current,
          assistStateRef.current,
        ),
      });
      const fieldValidationErrors = getFieldValidationErrors(
        model.getValue(),
        assistStateRef.current,
      );
      const markers = validationErrors.map((error) => ({
        ...markerRangeForIndex(
          model,
          model.getOffsetAt({
            lineNumber: error.lineNumber ?? 1,
            column: error.startColumn,
          }),
          error.endColumn - error.startColumn,
        ),
        severity: monaco.MarkerSeverity.Error,
        message: error.message,
      })).concat(
        fieldValidationErrors.map((error) => ({
          ...markerRangeForIndex(model, error.startIndex, error.length),
          severity: monaco.MarkerSeverity.Error,
          message: error.message,
        })),
      );

      monaco.editor.setModelMarkers(model, "open-sql-workbench", markers);
      onValidationChangeRef.current?.([
        ...validationErrors,
        ...fieldValidationErrors.map((error) => {
          const start = model.getPositionAt(error.startIndex);
          const end = model.getPositionAt(error.startIndex + error.length);

          return {
            message: error.message,
            startColumn: start.column,
            endColumn: end.column,
            lineNumber: start.lineNumber,
          };
        }),
      ]);
    }

    async function updateDynamicMarkers(model: monaco.editor.ITextModel) {
      const sequence = dynamicValidationSeqRef.current + 1;
      dynamicValidationSeqRef.current = sequence;

      try {
        await ensureFieldsForCurrentTable(
          model,
          assistStateRef.current,
          contextRef.current,
        );
      } catch {
        // Field suggestions are best-effort; backend RunQuery remains authoritative.
      }

      if (dynamicValidationSeqRef.current === sequence && !model.isDisposed()) {
        updateMarkers(model);
      }
    }

    // Create the editor once on mount. containerRef is stable; avoid
    // including containerRef.current in deps to satisfy react-hooks rules.
    editorRef.current = monaco.editor.create(containerRef.current, {
      value: value ?? "",
      language,
      theme: "vs",
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      fontSize: editorFontSizeRef.current,
      lineHeight: Math.round(editorFontSizeRef.current * 1.5),
      suggestOnTriggerCharacters: true,
      quickSuggestions: {
        comments: false,
        other: true,
        strings: false,
      },
      scrollbar: {
        alwaysConsumeMouseWheel: false,
      },
    });

    const model = editorRef.current.getModel();
    const editorDomNode = editorRef.current.getDomNode();

    function handleEditorWheel(event: WheelEvent) {
      if (!event.shiftKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const direction = event.deltaY < 0 ? 1 : -1;
      const nextFontSize = Math.min(
        maxEditorFontSize,
        Math.max(
          minEditorFontSize,
          editorFontSizeRef.current + direction,
        ),
      );

      if (nextFontSize === editorFontSizeRef.current) {
        return;
      }

      editorFontSizeRef.current = nextFontSize;
      editorRef.current?.updateOptions({
        fontSize: nextFontSize,
        lineHeight: Math.round(nextFontSize * 1.5),
      });
      editorRef.current?.layout();
    }

    editorDomNode?.addEventListener("wheel", handleEditorWheel, {
      passive: false,
    });

    const disposable = editorRef.current.onDidChangeModelContent(() => {
      const val = editorRef.current?.getValue() ?? "";
      onChange?.(val);

      const activeModel = editorRef.current?.getModel();
      if (activeModel) {
        updateMarkers(activeModel);
        void updateDynamicMarkers(activeModel);

        const activePosition = editorRef.current?.getPosition();
        if (
          activePosition &&
          (shouldAutoTriggerJoinFieldSuggest(
            activeModel,
            activePosition,
            contextRef.current,
          ) ||
            shouldAutoTriggerClauseFieldSuggest(
              activeModel,
              activePosition,
              contextRef.current,
            ))
        ) {
          editorRef.current?.trigger(
            "open-sql-workbench",
            "editor.action.triggerSuggest",
            {},
          );
        }
      }
    });

    if (model) {
      updateMarkers(model);
      void updateDynamicMarkers(model);
    }

    window.__openSqlWorkbenchEditor = {
      setValue: (nextValue: string) => {
        editorRef.current?.setValue(nextValue);
      },
      getValue: () => editorRef.current?.getValue() ?? "",
      getSelection: () => {
        const ed = editorRef.current;
        if (!ed) return "";
        const selection = ed.getSelection();
        if (!selection || selection.isEmpty()) return "";
        return ed.getModel()?.getValueInRange(selection) ?? "";
      },
    };

    return () => {
      editorDomNode?.removeEventListener("wheel", handleEditorWheel);
      disposable.dispose();
      completionProviderRef.current?.dispose();
      if (window.__openSqlWorkbenchEditor) {
        delete window.__openSqlWorkbenchEditor;
      }
      if (editorRef.current) {
        editorRef.current.dispose();
      }
      if (model) model.dispose();
    };
    // We intentionally run this effect once on mount to create the Monaco
    // editor. The ref and initial props are handled explicitly; skip the
    // exhaustive-deps rule for this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value ?? "");
      const model = editorRef.current.getModel();
      if (model) {
        const applyMarkers = () => {
          const validationErrors = validateOpenSql(model.getValue(), {
            availableEntityNames: getKnownEntityNames(
              contextRef.current,
              assistStateRef.current,
            ),
          });
          const fieldValidationErrors = getFieldValidationErrors(
            model.getValue(),
            assistStateRef.current,
          );
          const markers = validationErrors.map((error) => ({
            ...markerRangeForIndex(
              model,
              model.getOffsetAt({
                lineNumber: error.lineNumber ?? 1,
                column: error.startColumn,
              }),
              error.endColumn - error.startColumn,
            ),
            severity: monaco.MarkerSeverity.Error,
            message: error.message,
          })).concat(
            fieldValidationErrors.map((error) => ({
              ...markerRangeForIndex(model, error.startIndex, error.length),
              severity: monaco.MarkerSeverity.Error,
              message: error.message,
            })),
          );

          monaco.editor.setModelMarkers(model, "open-sql-workbench", markers);
          onValidationChangeRef.current?.([
            ...validationErrors,
            ...fieldValidationErrors.map((error) => {
              const start = model.getPositionAt(error.startIndex);
              const end = model.getPositionAt(error.startIndex + error.length);

              return {
                message: error.message,
                startColumn: start.column,
                endColumn: end.column,
                lineNumber: start.lineNumber,
              };
            }),
          ]);
        };

        applyMarkers();

        const sequence = dynamicValidationSeqRef.current + 1;
        dynamicValidationSeqRef.current = sequence;

        void ensureFieldsForCurrentTable(
          model,
          assistStateRef.current,
          contextRef.current,
        )
          .catch(() => {
            // Field validation is best-effort; RunQuery still returns SAP truth.
          })
          .then(() => {
            if (
              dynamicValidationSeqRef.current === sequence &&
              !model.isDisposed()
            ) {
              applyMarkers();
            }
          });
      }
    }
  }, [value]);

  return (
    <div
      style={{ height }}
      className="w-full rounded-lg border border-border"
    >
      <div ref={containerRef} style={{ height }} />
    </div>
  );
}
