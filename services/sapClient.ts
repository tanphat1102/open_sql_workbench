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

async function parseJsonResponse<T>(response: Response) {
  const data = (await response.json()) as T;

  if (!response.ok) {
    throw new Error("Lỗi khi gọi SAP service");
  }

  return data;
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

  fetchCollection: async <T>(path: string, init?: RequestInit) => {
    const data = await sapClient.request<SapODataEnvelope<T>>(path, init);
    return formatODataResults(data) as T[];
  },

  fetchEntity: async <T>(path: string, init?: RequestInit) => {
    const data = await sapClient.request<{ d?: T }>(path, init);
    return formatODataResults(data) as T;
  },
};
