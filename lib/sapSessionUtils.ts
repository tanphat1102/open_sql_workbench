import { NextRequest, NextResponse } from "next/server";

export function normalizeSapBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildTargetUrl(
  sapBaseUrl: string,
  targetPath: string,
  queryString = "",
) {
  const normalizedBase = normalizeSapBaseUrl(sapBaseUrl);
  const normalizedPath = targetPath.replace(/^\/+/, "");
  const servicePrefix = "opu/odata/sap/";

  const finalPath = normalizedBase.toLowerCase().endsWith("/sap/opu/odata/sap")
    ? normalizedPath.startsWith(servicePrefix)
      ? normalizedPath.slice(servicePrefix.length)
      : normalizedPath
    : normalizedPath;

  return `${normalizedBase}/${finalPath}${queryString ? "?" + queryString : ""}`;
}

export function getSapCookieHeader(cookieHeader: string) {
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

export function getStoredSapCookieHeader(req: NextRequest) {
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

export function getSapClient(req: NextRequest) {
  return req.cookies.get("OSWB_SAP_CLIENT")?.value || process.env.SAP_CLIENT;
}

export function getCookieNames(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter(Boolean);
}

export function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    path: "/",
    maxAge: 0,
  });
}

export function clearSapSessionCookies(
  response: NextResponse,
  clientCookieHeader: string,
  storedSapCookieHeader: string,
) {
  const cookieNames = new Set([
    "OSWB_SAP_CLIENT",
    "OSWB_SAP_COOKIE",
    "OSWB_SAP_USER",
    ...getCookieNames(clientCookieHeader).filter(
      (name) =>
        name.startsWith("SAP_") ||
        name.startsWith("sap-") ||
        name.startsWith("MYSAPSSO2") ||
        name.startsWith("SAPSSO2"),
    ),
    ...getCookieNames(storedSapCookieHeader),
  ]);

  cookieNames.forEach((name) => clearCookie(response, name));
}

export function appendSapCookie(response: NextResponse, cookieStr: string) {
  const [nameValue, ...attributes] = cookieStr.split(";");
  const separatorIndex = nameValue.indexOf("=");

  if (separatorIndex <= 0) {
    return;
  }

  const name = nameValue.slice(0, separatorIndex).trim();
  const value = nameValue.slice(separatorIndex + 1).trim();
  const preservedAttributes = attributes
    .map((attribute) => attribute.trim())
    .filter((attribute) => {
      const lowerAttribute = attribute.toLowerCase();
      return (
        attribute &&
        !lowerAttribute.startsWith("domain=") &&
        !lowerAttribute.startsWith("path=") &&
        lowerAttribute !== "secure" &&
        !lowerAttribute.startsWith("samesite=")
      );
    });

  response.headers.append(
    "Set-Cookie",
    [`${name}=${value}`, "Path=/", "SameSite=Lax", ...preservedAttributes].join(
      "; ",
    ),
  );
}

export function toUtf8String(data: unknown) {
  if (typeof data === "string") {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
      "utf8",
    );
  }

  return undefined;
}

export function toSnippet(data: unknown) {
  const utf8 = toUtf8String(data);
  return utf8 ? utf8.slice(0, 500) : undefined;
}
