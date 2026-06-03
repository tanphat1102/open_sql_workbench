"use client";

import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import {
  validateOpenSql,
  type SqlValidationError,
} from "@/lib/openSqlValidation";
import type { WorkbenchEntity } from "@/types/workbench";

type MonacoEnvironment = {
  getWorker?: (workerId: string, label: string) => Worker;
};

declare global {
  interface Window {
    MonacoEnvironment?: MonacoEnvironment;
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
  "RIGHT OUTER JOIN",
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

function configureSqlLanguage() {
  if (isSqlLanguageConfigured) {
    return;
  }

  monaco.languages.setMonarchTokensProvider("sql", {
    ignoreCase: true,
    tokenizer: {
      root: [
        [
          /\b(SELECT|TOP|FROM|AS|WHERE|AND|OR|NOT|ORDER|BY|GROUP|HAVING|UP|TO|ROWS|COUNT|SUM|AVG|MIN|MAX|DISTINCT|ASC|DESC|LIKE|BETWEEN|IN|IS|NULL|INNER|LEFT|RIGHT|OUTER|JOIN|ON|LIMIT|CLIENT|SPECIFIED|BYPASSING|BUFFER|INTO|TABLE|ALL|ENTRIES|DESCRIBE|KEYS|FOR|SHOW|LAST|SYNC)\b/,
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
  const entitySuggestions = context.entities.map((entity) => ({
    label: entity.name,
    kind: monaco.languages.CompletionItemKind.Class,
    insertText: entity.name,
    detail: entity.description,
    range,
  }));
  const fieldSuggestions = (selectedEntity?.keyFields ?? []).map((field) => ({
    label: field,
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: field,
    detail: `${selectedEntity?.name ?? "Entity"} key field`,
    range,
  }));
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
    ...snippetSuggestions,
    ...keywordSuggestions,
    ...functionSuggestions,
    ...entitySuggestions,
    ...fieldSuggestions,
    ...operatorSuggestions,
  ];
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
  const contextRef = useRef<EditorContext>({
    entities,
    selectedEntityName,
  });
  const onValidationChangeRef = useRef(onValidationChange);

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
        triggerCharacters: [" ", ".", "_", "'"],
        provideCompletionItems: (model, position) => ({
          suggestions: buildCompletionItems(
            model,
            position,
            contextRef.current,
          ),
        }),
      });

    function updateMarkers(model: monaco.editor.ITextModel) {
      const validationErrors = validateOpenSql(model.getValue(), {
        availableEntityNames: contextRef.current.entities.map(
          (entity) => entity.name,
        ),
      });
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
      }));

      monaco.editor.setModelMarkers(model, "open-sql-workbench", markers);
      onValidationChangeRef.current?.(validationErrors);
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
      fontSize: 13,
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

    const disposable = editorRef.current.onDidChangeModelContent(() => {
      const val = editorRef.current?.getValue() ?? "";
      onChange?.(val);

      const activeModel = editorRef.current?.getModel();
      if (activeModel) {
        updateMarkers(activeModel);
      }
    });

    if (model) {
      updateMarkers(model);
    }

    return () => {
      disposable.dispose();
      completionProviderRef.current?.dispose();
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
        const validationErrors = validateOpenSql(model.getValue(), {
          availableEntityNames: contextRef.current.entities.map(
            (entity) => entity.name,
          ),
        });
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
        }));

        monaco.editor.setModelMarkers(model, "open-sql-workbench", markers);
        onValidationChangeRef.current?.(validationErrors);
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
