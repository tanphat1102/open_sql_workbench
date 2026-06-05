"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const servicePath = "/api/sap/opu/odata/sap/ZSQLWB_ODATA_SRV";

type TestKind = "columns" | "chunks";

type TestResult = {
  id: string;
  label: string;
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  contentLengthHeader: string;
  receivedBytes: number;
  receivedChars: number;
  lengthVerdict: string;
  parseVerdict: string;
  detail: string;
  body: string;
};

function escapeODataStringLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function buildDebugUrl({
  resultId,
  pageNo,
  kind,
  debugDownload,
}: {
  resultId: string;
  pageNo: string;
  kind: TestKind;
  debugDownload: boolean;
}) {
  const filter =
    kind === "columns"
      ? `ResultId eq '${escapeODataStringLiteral(resultId)}'`
      : `ResultId eq '${escapeODataStringLiteral(resultId)}' and PageNo eq '${escapeODataStringLiteral(pageNo)}'`;

  const searchParams = new URLSearchParams({
    $format: "json",
    $filter: filter,
  });

  if (debugDownload) {
    searchParams.set("sap-ds-debug", "download");
  }

  const entitySet = kind === "columns" ? "SqlwbColumnSet" : "SqlwbPageChunkSet";

  return `${servicePath}/${entitySet}?${searchParams.toString()}`;
}

function buildLengthVerdict(contentLengthHeader: string, receivedBytes: number) {
  if (!contentLengthHeader) {
    return "No content-length header was exposed by the response.";
  }

  const expectedBytes = Number(contentLengthHeader);

  if (!Number.isFinite(expectedBytes)) {
    return "Content-length header is not numeric.";
  }

  if (expectedBytes === receivedBytes) {
    return "Header length matches the body received by the browser/proxy.";
  }

  if (expectedBytes > receivedBytes) {
    return `Header length is ${expectedBytes - receivedBytes} bytes larger than the received body. The FE/proxy/browser likely received a partial body.`;
  }

  return `Received body is ${receivedBytes - expectedBytes} bytes larger than content-length. The response may have been transformed by the proxy/browser.`;
}

function getODataResults(parsed: unknown) {
  if (
    parsed &&
    typeof parsed === "object" &&
    "d" in parsed &&
    parsed.d &&
    typeof parsed.d === "object" &&
    "results" in parsed.d &&
    Array.isArray(parsed.d.results)
  ) {
    return parsed.d.results as Record<string, unknown>[];
  }

  return [];
}

function analyzeBody(kind: TestKind, body: string) {
  try {
    const parsed = JSON.parse(body) as unknown;
    const results = getODataResults(parsed);

    if (kind === "columns") {
      return {
        parseVerdict: "JSON parse succeeded.",
        detail: `Column rows: ${results.length}`,
      };
    }

    const chunks = results
      .slice()
      .sort((a, b) => Number(a.ChunkNo ?? 0) - Number(b.ChunkNo ?? 0));
    const rowsJson = chunks.map((chunk) => String(chunk.PayloadPart ?? "")).join("");
    const lastChunk = chunks[chunks.length - 1];
    const hasLastChunk =
      lastChunk?.IsLastChunk === true ||
      String(lastChunk?.IsLastChunk ?? "").toUpperCase() === "TRUE" ||
      String(lastChunk?.IsLastChunk ?? "").toUpperCase() === "X";

    try {
      const rows = rowsJson ? JSON.parse(rowsJson) : [];
      const rowCount = Array.isArray(rows) ? rows.length : 0;

      return {
        parseVerdict: "JSON parse succeeded. Joined PayloadPart also parsed.",
        detail: `Chunks: ${chunks.length}. Last chunk flag: ${hasLastChunk ? "yes" : "no"}. Joined RowsJson bytes: ${new TextEncoder().encode(rowsJson).length}. Parsed rows: ${rowCount}.`,
      };
    } catch (error) {
      return {
        parseVerdict: "Outer OData JSON parsed, but joined PayloadPart did not parse.",
        detail: `Chunks: ${chunks.length}. Last chunk flag: ${hasLastChunk ? "yes" : "no"}. Joined RowsJson bytes: ${new TextEncoder().encode(rowsJson).length}. Error: ${
          error instanceof Error ? error.message : "Unknown parse error"
        }`,
      };
    }
  } catch (error) {
    return {
      parseVerdict: "Response body did not parse as JSON.",
      detail: error instanceof Error ? error.message : "Unknown parse error",
    };
  }
}

function downloadRawBody(result: TestResult) {
  const blob = new Blob([result.body], {
    type: result.contentType || "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${result.id}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function BodyPreview({ body }: { body: string }) {
  const preview = useMemo(() => {
    if (body.length <= 2400) {
      return body;
    }

    return `${body.slice(0, 1200)}\n\n--- middle omitted in preview ---\n\n${body.slice(-1200)}`;
  }, [body]);

  return (
    <Textarea
      readOnly
      value={preview}
      className="min-h-72 resize-y font-mono text-xs"
    />
  );
}

function ResultCard({ result }: { result: TestResult }) {
  return (
    <Card className="border-border bg-white">
      <CardHeader className="gap-1 border-b border-border px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base">{result.label}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {result.url}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadRawBody(result)}
            >
              <Download />
              Raw body
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={result.url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-2 text-sm md:grid-cols-4">
          <div className="rounded-md border border-border bg-accent p-3">
            <div className="text-xs text-muted-foreground">HTTP</div>
            <div className="font-medium">
              {result.status} {result.ok ? "OK" : "Error"}
            </div>
          </div>
          <div className="rounded-md border border-border bg-accent p-3">
            <div className="text-xs text-muted-foreground">Content-Length</div>
            <div className="font-medium">{result.contentLengthHeader || "-"}</div>
          </div>
          <div className="rounded-md border border-border bg-accent p-3">
            <div className="text-xs text-muted-foreground">Received</div>
            <div className="font-medium">
              {result.receivedBytes} bytes / {result.receivedChars} chars
            </div>
          </div>
          <div className="rounded-md border border-border bg-accent p-3">
            <div className="text-xs text-muted-foreground">Content-Type</div>
            <div className="truncate font-medium">{result.contentType || "-"}</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-white p-3 text-sm">
          <div className="font-medium text-foreground">Length verdict</div>
          <div className="mt-1 text-muted-foreground">{result.lengthVerdict}</div>
        </div>

        <div className="rounded-md border border-border bg-white p-3 text-sm">
          <div className="font-medium text-foreground">Parse verdict</div>
          <div className="mt-1 text-muted-foreground">{result.parseVerdict}</div>
          <div className="mt-1 text-muted-foreground">{result.detail}</div>
        </div>

        <BodyPreview body={result.body} />
      </CardContent>
    </Card>
  );
}

export default function ODataDebugPage() {
  const [resultId, setResultId] = useState("");
  const [pageNo, setPageNo] = useState("1");
  const [debugDownload, setDebugDownload] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runTest(kind: TestKind) {
    const trimmedResultId = resultId.trim();
    const trimmedPageNo = pageNo.trim() || "1";

    if (!trimmedResultId) {
      setError("Enter a ResultId first.");
      return;
    }

    setError(null);
    setIsRunning(true);

    try {
      const url = buildDebugUrl({
        resultId: trimmedResultId,
        pageNo: trimmedPageNo,
        kind,
        debugDownload,
      });
      const response = await fetch(url, {
        headers: {
          Accept: "application/json, text/plain, */*",
        },
        cache: "no-store",
      });
      const body = await response.text();
      const receivedBytes = new TextEncoder().encode(body).length;
      const contentLengthHeader = response.headers.get("content-length") ?? "";
      const analysis = analyzeBody(kind, body);
      const result: TestResult = {
        id: `${kind}-${Date.now()}`,
        label: kind === "columns" ? "SqlwbColumnSet" : "SqlwbPageChunkSet",
        url,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type") ?? "",
        contentLengthHeader,
        receivedBytes,
        receivedChars: body.length,
        lengthVerdict: buildLengthVerdict(contentLengthHeader, receivedBytes),
        parseVerdict: analysis.parseVerdict,
        detail: analysis.detail,
        body,
      };

      setResults((current) => [result, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run debug test.");
    } finally {
      setIsRunning(false);
    }
  }

  async function runBoth() {
    await runTest("columns");
    await runTest("chunks");
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-4">
        <Card className="border-border bg-white">
          <CardHeader className="border-b border-border">
            <CardTitle>OData Body Truncation Debug</CardTitle>
            <CardDescription>
              Test whether SAP sends a truncated body or only the UI/copy layer
              hides part of the response.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-end">
              <label className="space-y-1 text-sm">
                <span className="font-medium">ResultId</span>
                <Input
                  value={resultId}
                  onChange={(event) => setResultId(event.target.value)}
                  placeholder="8B95F36A4F271FD197EBE525555E738E"
                  className="font-mono"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">PageNo</span>
                <Input
                  value={pageNo}
                  onChange={(event) => setPageNo(event.target.value)}
                  className="font-mono"
                />
              </label>
              <label className="flex h-8 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={debugDownload}
                  onChange={(event) => setDebugDownload(event.target.checked)}
                />
                sap-ds-debug=download
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void runBoth()}
                disabled={isRunning}
              >
                <Play />
                Run both
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runTest("columns")}
                disabled={isRunning}
              >
                Test columns
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runTest("chunks")}
                disabled={isRunning}
              >
                Test chunks
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResults([])}
              >
                <RotateCcw />
                Clear
              </Button>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-accent p-3 text-sm text-muted-foreground">
              Use this page after running <span className="font-mono">RunQuery</span>.
              It calls the SAP endpoints through <span className="font-mono">/api/sap</span>,
              so an SAP login session is still required.
            </div>
          </CardContent>
        </Card>

        {results.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </section>
    </main>
  );
}
