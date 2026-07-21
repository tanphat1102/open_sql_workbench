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
    .map((cookie) => {
      const separatorIndex = cookie.indexOf("=");
      const name =
        separatorIndex > 0 ? cookie.slice(0, separatorIndex) : cookie;
      const value = separatorIndex > 0 ? cookie.slice(separatorIndex + 1) : "";

      if (
        name.startsWith("SAP_SESSIONID") ||
        name.startsWith("MYSAPSSO2") ||
        name.startsWith("SAPSSO2")
      ) {
        return `${name}=${value.replace(/%25/g, "%")}`;
      }

      return cookie;
    })
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

function getSapUser(req: NextRequest) {
  return req.cookies.get("OSWB_SAP_USER")?.value;
}

function toSnippet(data: unknown) {
  if (typeof data === "string") {
    return data.slice(0, 500);
  }

  if (Buffer.isBuffer(data)) {
    return data.toString("utf8").slice(0, 500);
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8").slice(0, 500);
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      .toString("utf8")
      .slice(0, 500);
  }

  return undefined;
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
