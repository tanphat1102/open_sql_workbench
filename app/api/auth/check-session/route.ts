import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

function normalizeSapBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function buildTargetUrl(sapBaseUrl: string, targetPath: string) {
  const normalizedBase = normalizeSapBaseUrl(sapBaseUrl);
  const normalizedPath = targetPath.replace(/^\/+/, "");
  const servicePrefix = "opu/odata/sap/";

  const finalPath = normalizedBase.toLowerCase().endsWith("/sap/opu/odata/sap")
    ? normalizedPath.startsWith(servicePrefix)
      ? normalizedPath.slice(servicePrefix.length)
      : normalizedPath
    : normalizedPath;

  return `${normalizedBase}/${finalPath}`;
}

function getSapCookieHeader(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(
      (cookie) =>
        cookie.startsWith("SAP_") ||
        cookie.startsWith("sap-") ||
        cookie.startsWith("MYSAPSSO2") ||
        cookie.startsWith("SAPSSO2"),
    )
    .join("; ");
}

function getSapClient(req: NextRequest) {
  return req.cookies.get("OSWB_SAP_CLIENT")?.value || process.env.SAP_CLIENT;
}

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const sapCookies = getSapCookieHeader(cookieHeader);
    const sapClient = getSapClient(req);

    if (!sapCookies) {
      return NextResponse.json(
        { success: false, message: "Missing SAP session cookie" },
        { status: 401 },
      );
    }

    const response = await axios.get(
      buildTargetUrl(
        process.env.SAP_BASE_URL || "",
        "opu/odata/sap/ZSQLWB_ODATA_SRV/$metadata",
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
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json(
      {
        success: false,
        message: "SAP session is not valid",
        status: response.status,
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
