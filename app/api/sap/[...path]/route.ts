import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

function normalizeSapBaseUrl(value: string) {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed;
}

function buildTargetUrl(
  sapBaseUrl: string,
  targetPath: string,
  queryString: string,
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

function getSapCookieHeader(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .map((cookie) => {
      const separatorIndex = cookie.indexOf("=");
      const name = separatorIndex > 0 ? cookie.slice(0, separatorIndex) : cookie;
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

function appendSapCookie(response: NextResponse, cookieStr: string) {
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

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const targetPath = path.join("/");
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const sapBaseUrl = process.env.SAP_BASE_URL || "";
    const fullTargetUrl = buildTargetUrl(sapBaseUrl, targetPath, queryString);
    const sapClient = getSapClient(req);

    const method = req.method;

    // 1. Read the SAP cookies sent by the developer's browser.
    const clientCookies = req.headers.get("cookie") || "";
    const sapCookies =
      getStoredSapCookieHeader(req) || getSapCookieHeader(clientCookies);

    // Reject unauthenticated requests before proxying to SAP.
    if (!sapCookies) {
      return NextResponse.json(
        { error: "SAP session is missing" },
        { status: 401 },
      );
    }

    const extraHeaders: Record<string, string> = {
      Cookie: sapCookies,
      Accept: req.headers.get("accept") || "application/json",
    };

    // 2. For write requests, fetch a fresh CSRF token with the user's SAP cookies.
    if (["POST", "PUT", "DELETE"].includes(method)) {
      // Use the service metadata endpoint as the stable token source.
      const metadataPath = targetPath.includes("ZSQLWB_ODATA_SRV")
        ? "opu/odata/sap/ZSQLWB_ODATA_SRV/$metadata"
        : targetPath;

      const csrfRes = await axios.get(
        buildTargetUrl(sapBaseUrl, metadataPath, ""),
        {
          headers: {
            Cookie: sapCookies,
            Accept: req.headers.get("accept") || "application/json",
            "X-CSRF-Token": "Fetch",
          },
          params: sapClient ? { "sap-client": sapClient } : undefined,
          validateStatus: () => true,
        },
      );
      extraHeaders["X-CSRF-Token"] = csrfRes.headers["x-csrf-token"] || "";

      console.log(
        "Fetched CSRF Token for POST/PUT:",
        extraHeaders["X-CSRF-Token"] ? "SUCCESS" : "FAILED",
        `Status: ${csrfRes.status}`,
      );
    }

    // 3. Read the request body when present. RunQuery is usually a bodyless POST.
    const body = ["POST", "PUT", "PATCH"].includes(method)
      ? await req.text()
      : undefined;

    if (body && req.headers.get("content-type")) {
      extraHeaders["Content-Type"] = req.headers.get("content-type") || "";
    }

    // 4. Forward the request to SAP with the developer's session cookies.
    // Use arraybuffer so we can forward raw bytes (JSON, XML, etc.) unchanged
    const sapResponse = await axios({
      method,
      url: fullTargetUrl,
      data: body && body.length > 0 ? body : undefined,
      headers: extraHeaders,
      params: sapClient ? { "sap-client": sapClient } : undefined,
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    // Build headers to forward back to client. Copy content-type and other relevant headers.
    const forwardedHeaders: Record<string, string> = {};
    if (sapResponse.headers) {
      Object.entries(sapResponse.headers).forEach(([k, v]) => {
        if (!v) return;
        // Skip hop-by-hop headers that shouldn't be forwarded
        const key = k.toLowerCase();
        if (
          [
            "transfer-encoding",
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "upgrade",
          ].includes(key)
        )
          return;
        // For set-cookie we handle separately
        if (key === "set-cookie") return;
        forwardedHeaders[k] = Array.isArray(v) ? v.join(", ") : String(v);
      });
    }

    const bodyBuffer = Buffer.from(sapResponse.data || "");
    const bodyUint8 = new Uint8Array(bodyBuffer);

    const response = new NextResponse(bodyUint8, {
      status: sapResponse.status,
      headers: forwardedHeaders,
    });

    // If SAP set cookies, forward them individually
    const sapNewCookies = (sapResponse.headers["set-cookie"] as string[]) || [];
    sapNewCookies.forEach((cookieStr: string) => {
      appendSapCookie(response, cookieStr);
    });

    return response;
  } catch (error: unknown) {
    const axiosError = error as {
      response?: {
        status?: number;
        data?: unknown;
        headers?: Record<string, unknown>;
      };
    };

    if (axiosError.response) {
      // Forward the upstream error response body and headers unchanged when possible
      try {
        const errBody = axiosError.response.data as unknown;
        const errBuffer = Buffer.isBuffer(errBody)
          ? errBody
          : Buffer.from(
              typeof errBody === "string"
                ? (errBody as string)
                : JSON.stringify(errBody),
            );

        const errHeaders: Record<string, string> = {};
        Object.entries(axiosError.response.headers || {}).forEach(([k, v]) => {
          if (!v) return;
          const key = k.toLowerCase();
          if (
            [
              "transfer-encoding",
              "connection",
              "keep-alive",
              "proxy-authenticate",
              "proxy-authorization",
              "te",
              "trailer",
              "upgrade",
            ].includes(key)
          )
            return;
          if (key === "set-cookie") return;
          errHeaders[k] = Array.isArray(v) ? v.join(", ") : String(v);
        });

        const errUint8 = new Uint8Array(errBuffer);

        const resp = new NextResponse(errUint8, {
          status: axiosError.response.status || 502,
          headers: errHeaders,
        });

        const setCookies =
          (axiosError.response.headers?.["set-cookie"] as string[]) || [];
        setCookies.forEach((cookieStr: string) => {
          appendSapCookie(resp, cookieStr);
        });

        return resp;
      } catch {
        // fall through to generic error response
      }
    }

    return NextResponse.json({ error: "SAP query failed" }, { status: 500 });
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PUT,
  handleProxy as PATCH,
  handleProxy as DELETE,
};
