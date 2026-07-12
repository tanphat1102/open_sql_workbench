import { sapClient } from "@/services/sapClient";
import type {
  SapSaveQueryEnvelope,
  SapSaveQueryResult,
  SapSqlwbField,
  SapSqlwbSavedQuery,
  SapSqlwbTable,
} from "@/types/sap";

const servicePath = `opu/odata/sap/${process.env.NEXT_PUBLIC_SAP_PACKAGE ?? "ZSQLWB_ODATA_SRV"}`;
const queryProfileId = process.env.NEXT_PUBLIC_SQLWB_PROFILE_ID ?? "DEV";

function quoteODataString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildFunctionPath(
  functionName: string,
  params: Record<string, string | number | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  return `${servicePath}/${functionName}?${searchParams.toString()}`;
}

function buildSavedQueryListPath(profileId: string, top = 100, skip = 0) {
  const filter = `ProfileId eq ${quoteODataString(profileId)}`;
  const params = new URLSearchParams({
    $format: "json",
    $filter: filter,
    $top: String(top),
    $skip: String(skip),
  });
  return `${servicePath}/SqlwbSavedQuerySet?${params.toString()}`;
}

export const sqlAssistService = {
  fetchAllTables: async (maxRows = 10000) => {
    return sapClient.fetchCollection<SapSqlwbTable>(
      buildFunctionPath("SearchTables", {
        ProfileId: quoteODataString(queryProfileId),
        SearchText: quoteODataString(""),
        MaxRows: maxRows,
      }),
    );
  },

  searchTables: async (searchText: string, maxRows = 50) => {
    return sapClient.fetchCollection<SapSqlwbTable>(
      buildFunctionPath("SearchTables", {
        ProfileId: quoteODataString(queryProfileId),
        SearchText: quoteODataString(searchText),
        MaxRows: maxRows,
      }),
    );
  },

  getFields: async (objectName: string) => {
    return sapClient.fetchCollection<SapSqlwbField>(
      buildFunctionPath("GetFields", {
        ProfileId: quoteODataString(queryProfileId),
        ObjectName: quoteODataString(objectName),
      }),
    );
  },

  listSavedQueries: async (profileId?: string, top = 100, skip = 0) => {
    const pid = profileId ?? queryProfileId;
    return sapClient.fetchCollection<SapSqlwbSavedQuery>(
      buildSavedQueryListPath(pid, top, skip),
    );
  },

  saveQuery: async (params: {
    profileId?: string;
    queryName: string;
    queryText: string;
    visibility?: string;
    tags?: string;
    description?: string;
  }): Promise<SapSaveQueryResult> => {
    const pid = params.profileId ?? queryProfileId;
    // Build URL manually — buildFunctionPath drops empty params, but Gateway
    // requires ALL declared function import parameters (even empty strings).
    const qs = new URLSearchParams({
      ProfileId: quoteODataString(pid),
      QueryName: quoteODataString(params.queryName),
      QueryText: quoteODataString(params.queryText),
      Visibility: quoteODataString(params.visibility ?? ""),
      Tags: quoteODataString(params.tags ?? ""),
      Description: quoteODataString(params.description ?? ""),
    });
    const response = await sapClient.request<SapSaveQueryEnvelope>(
      `${servicePath}/SaveQuery?${qs.toString()}`,
      { method: "POST" },
    );

    const data = response.d;
    if (!data) return {};
    if ("SaveQuery" in data && data.SaveQuery) return data.SaveQuery;
    return data as SapSaveQueryResult;
  },

  updateSavedQuery: async (params: {
    profileId?: string;
    queryId: string;
    queryName: string;
    queryText: string;
    visibility?: string;
    tags?: string;
    description?: string;
  }): Promise<SapSaveQueryResult> => {
    const pid = params.profileId ?? queryProfileId;
    const qs = new URLSearchParams({
      ProfileId: quoteODataString(pid),
      QueryId: quoteODataString(params.queryId),
      QueryName: quoteODataString(params.queryName),
      QueryText: quoteODataString(params.queryText),
      Visibility: quoteODataString(params.visibility ?? ""),
      Tags: quoteODataString(params.tags ?? ""),
      Description: quoteODataString(params.description ?? ""),
    });
    const response = await sapClient.request<SapSaveQueryEnvelope>(
      `${servicePath}/UpdateSavedQuery?${qs.toString()}`,
      { method: "POST" },
    );
    const data = response.d;
    if (!data) return {};
    if ("UpdateSavedQuery" in data && data.UpdateSavedQuery) return data.UpdateSavedQuery;
    if ("SaveQuery" in data && data.SaveQuery) return data.SaveQuery;
    return data as SapSaveQueryResult;
  },

  deleteSavedQuery: async (queryId: string, profileId?: string) => {
    const pid = profileId ?? queryProfileId;
    const qs = new URLSearchParams({
      ProfileId: quoteODataString(pid),
      QueryId: quoteODataString(queryId),
    });
    const response = await sapClient.request<SapSaveQueryEnvelope>(
      `${servicePath}/DeleteSavedQuery?${qs.toString()}`,
      { method: "POST" },
    );
    const data = response.d;
    if (!data) return {};
    if ("DeleteSavedQuery" in data && data.DeleteSavedQuery) return data.DeleteSavedQuery;
    return data as SapSaveQueryResult;
  },
};
