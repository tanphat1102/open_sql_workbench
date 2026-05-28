import { formatODataResults } from "@/lib/sapParser";
import { jsonrepair } from "jsonrepair";
import type { SapODataEnvelope, SapQueryParam } from "@/types/sap";

function buildSapUrl(path: string, query?: Record<string, SapQueryParam>) {
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`/api/sap/${normalizedPath}`, "http://localhost");

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return `${url.pathname}${url.search}`;
}

type SapClientError = Error & {
  status: number;
  body: unknown;
};

function getNestedValue(source: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
}

function getStringValue(source: unknown, path: string[]) {
  const value = getNestedValue(source, path);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getXmlTagValue(xml: string, tagName: string) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i").exec(
    xml,
  );

  return match?.[1]?.replace(/<[^>]+>/g, "").trim();
}

function extractSapErrorMessage(body: unknown, status: number) {
  if (typeof body === "string") {
    const code = getXmlTagValue(body, "code");
    const message = getXmlTagValue(body, "message");
    const transactionId = getXmlTagValue(body, "transactionid");
    const timestamp = getXmlTagValue(body, "timestamp");

    return [
      `HTTP ${status}`,
      code ? `Code: ${code}` : null,
      message ? `Message: ${message}` : null,
      transactionId ? `Transaction ID: ${transactionId}` : null,
      timestamp ? `Timestamp: ${timestamp}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const code = getStringValue(body, ["error", "code"]);
  const message =
    getStringValue(body, ["error", "message", "value"]) ??
    getStringValue(body, ["error", "message"]);
  const transactionId = getStringValue(body, [
    "error",
    "innererror",
    "transactionid",
  ]);
  const timestamp = getStringValue(body, ["error", "innererror", "timestamp"]);
  const sapTransaction = getStringValue(body, [
    "error",
    "innererror",
    "Error_Resolution",
    "SAP_Transaction",
  ]);
  const sapNote = getStringValue(body, [
    "error",
    "innererror",
    "Error_Resolution",
    "SAP_Note",
  ]);

  return [
    `HTTP ${status}`,
    code ? `Code: ${code}` : null,
    message ? `Message: ${message}` : null,
    transactionId ? `Transaction ID: ${transactionId}` : null,
    timestamp ? `Timestamp: ${timestamp}` : null,
    sapTransaction ? `SAP Transaction: ${sapTransaction}` : null,
    sapNote ? `SAP Note: ${sapNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function createSapClientError(message: string, status: number, body: unknown) {
  const error = new Error(message) as SapClientError;
  error.status = status;
  error.body = body;
  return error;
}

async function parseJsonResponse<T>(response: Response) {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    try {
      if (text) {
        const repaired = jsonrepair(text);
        data = JSON.parse(repaired);
        console.warn("Recovered truncated JSON payload using jsonrepair");
      }
    } catch (e2) {
      console.error("JSON Parse Error (fatal):", e2);
      data = text;
    }
  }

  if (!response.ok) {
    throw createSapClientError(
      extractSapErrorMessage(data, response.status) || "Lỗi khi gọi SAP service",
      response.status,
      data,
    );
  }

  return data as T;
}

export const sapClient = {
  request: async <T>(path: string, init?: RequestInit) => {
    const response = await fetch(buildSapUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    return parseJsonResponse<T>(response);
  },

  requestText: async (path: string, init?: RequestInit) => {
    const response = await fetch(buildSapUrl(path), {
      ...init,
      headers: {
        Accept: "application/xml, text/xml, */*",
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();

    if (!response.ok) {
      throw createSapClientError(
        text || "Lỗi khi gọi SAP service",
        response.status,
        text,
      );
    }

    return text;
  },

  fetchCollection: async <T>(path: string, init?: RequestInit) => {
    const data = await sapClient.request<SapODataEnvelope<T>>(path, init);
    return formatODataResults(data) as T[];
  },

  fetchEntity: async <T>(path: string, init?: RequestInit) => {
    const data = await sapClient.request<{ d?: T }>(path, init);
    console.log("sapClient fetch data type:", typeof data);
    return formatODataResults(data) as T;
  },
};
