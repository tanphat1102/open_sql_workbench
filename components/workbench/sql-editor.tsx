"use client";

import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

type SqlEditorProps = {
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  height?: string;
};

export function SqlEditor({
  value,
  language = "sql",
  onChange,
  height = "360px",
}: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
      scrollbar: {
        alwaysConsumeMouseWheel: false,
      },
    });

    const model = editorRef.current.getModel();

    const disposable = editorRef.current.onDidChangeModelContent(() => {
      const val = editorRef.current?.getValue() ?? "";
      onChange?.(val);
    });

    return () => {
      disposable.dispose();
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
