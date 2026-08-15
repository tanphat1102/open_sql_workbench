import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

import {
  buildTargetUrl,
  clearSapSessionCookies,
  getSapClient,
  getSapCookieHeader,
  getStoredSapCookieHeader,
} from "@/lib/sapSessionUtils";

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const sapCookieHeader =
    getStoredSapCookieHeader(req) || getSapCookieHeader(cookieHeader);
  const sapClient = getSapClient(req);

  if (sapCookieHeader) {
    await axios.get(
      buildTargetUrl(
        process.env.SAP_BASE_URL || "",
        "sap/public/bc/icf/logoff",
      ),
      {
        headers: {
          Cookie: sapCookieHeader,
          Accept: "text/html, */*",
        },
        params: sapClient ? { "sap-client": sapClient } : undefined,
        validateStatus: () => true,
      },
    );
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  clearSapSessionCookies(response, cookieHeader, sapCookieHeader);

  return response;
}
