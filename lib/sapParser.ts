import { jsonrepair } from "jsonrepair";

type ODataCollection<T> = {
  d?: {
    results?: T[];
    [key: string]: unknown;
  };
};

export function formatODataResults<T>(
  payload: ODataCollection<T> | { d?: T } | T,
) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if ("d" in payload) {
    const data = payload.d;

    if (data && typeof data === "object") {
      if ("results" in data && Array.isArray(data.results)) {
        return data.results as T[];
      }

      // Detect and repair truncated RowsJson payloads when possible.
      if ("RowsJson" in data && typeof data.RowsJson === "string") {
        const fixedJson = data.RowsJson;
        const trimmedJson = fixedJson.trim();

        if (!trimmedJson) {
          return data as T;
        }

        try {
          // Try standard parsing first.
          JSON.parse(trimmedJson);
        } catch {
          try {
            // Use jsonrepair to recover incomplete JSON structures.
            const repaired = jsonrepair(trimmedJson);
            const parsed = JSON.parse(repaired);
            data.RowsJson = JSON.stringify(parsed);
            console.warn("Recovered partial RowsJson using jsonrepair");
          } catch {
            console.warn("SapParser: RowsJson is not recoverable");
          }
        }
      }
    }

    return data as T;
  }

  return payload as T;
}

export function parseSapDate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = /\/Date\((-?\d+)([+-]\d{4})?\)\//.exec(value);

  if (!match?.[1]) {
    return null;
  }

  const timestamp = Number(match[1]);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}
