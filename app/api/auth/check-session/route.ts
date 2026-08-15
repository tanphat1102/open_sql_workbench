import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

import {
  buildTargetUrl,
  getSapClient,
  getSapCookieHeader,
  getStoredSapCookieHeader,
  toSnippet,
} from "@/lib/sapSessionUtils";

function getSapUser(req: NextRequest) {
  return req.cookies.get("OSWB_SAP_USER")?.value;
}

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const sapCookies =
      getStoredSapCookieHeader(req) || getSapCookieHeader(cookieHeader);
    const sapClient = getSapClient(req);
    const sapUser = getSapUser(req);

    if (!sapCookies) {
      return NextResponse.json(
        { success: false, message: "Missing SAP session cookie" },
        { status: 401 },
      );
    }

    const response = await axios.get(
      buildTargetUrl(
        process.env.SAP_BASE_URL || "",
        `opu/odata/sap/${process.env.SAP_PACKAGE!}/$metadata`,
      ),
      {
        headers: {
          Cookie: sapCookies,
          Accept: "application/xml, text/xml, */*",
        },
        params: sapClient ? { "sap-client": sapClient } : undefined,
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 400) {
      return NextResponse.json(
        {
          success: true,
          client: sapClient,
          user: sapUser,
          profile: process.env.SAP_PROFILE ?? process.env.NEXT_PUBLIC_SQLWB_PROFILE_ID,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "SAP session is not valid",
        status: response.status,
        client: sapClient,
        detail: toSnippet(response.data),
      },
      { status: 401 },
    );
  } catch (error) {
    console.error("check-session failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to verify SAP session" },
      { status: 500 },
    );
  }
}
