import { formatODataResults } from "@/lib/sapParser";
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
  } catch (e) {
    console.error("JSON Parse Error:", e); data = text;
  }

  if (!response.ok) {
    throw createSapClientError(
      typeof data === "string" ? data : "Lỗi khi gọi SAP service",
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
    console.log("sapClient fetch data type:", typeof data); return formatODataResults(data) as T;
  },
};
