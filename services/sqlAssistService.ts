import { sapClient } from "@/services/sapClient";
import type { SapSqlwbField, SapSqlwbTable } from "@/types/sap";

const servicePath = "opu/odata/sap/ZSQLWB_ODATA_SRV";
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

export const sqlAssistService = {
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
};
