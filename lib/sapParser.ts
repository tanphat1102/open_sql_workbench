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

    if (
      data &&
      typeof data === "object" &&
      "results" in data &&
      Array.isArray(data.results)
    ) {
      return data.results as T[];
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
