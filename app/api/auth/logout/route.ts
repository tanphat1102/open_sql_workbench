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

function getStoredSapCookieHeader(req: NextRequest) {
  const encodedCookieHeader = req.cookies.get("OSWB_SAP_COOKIE")?.value;

  if (!encodedCookieHeader) {
    return "";
  }

  try {
    return Buffer.from(encodedCookieHeader, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function getSapClient(req: NextRequest) {
  return req.cookies.get("OSWB_SAP_CLIENT")?.value || process.env.SAP_CLIENT;
}

function getCookieNames(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter(Boolean);
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    path: "/",
    maxAge: 0,
  });
}

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
  const cookieNames = new Set([
    "OSWB_SAP_CLIENT",
    "OSWB_SAP_COOKIE",
    "OSWB_SAP_USER",
    ...getCookieNames(cookieHeader).filter(
      (name) =>
        name.startsWith("SAP_") ||
        name.startsWith("sap-") ||
        name.startsWith("MYSAPSSO2") ||
        name.startsWith("SAPSSO2"),
    ),
    ...getCookieNames(sapCookieHeader),
  ]);

  cookieNames.forEach((name) => clearCookie(response, name));

  return response;
}
