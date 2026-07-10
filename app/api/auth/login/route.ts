import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

type SapLoginErrorEnvelope = {
  error?: {
    message?:
      | {
          value?: unknown;
        }
      | string;
  };
};

function extractSapErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" ? payload : "Unknown SAP error";
  }

  const envelope = payload as SapLoginErrorEnvelope;
  const message = envelope.error?.message;

  if (typeof message === "string") {
    return message;
  }

  if (message && typeof message === "object" && "value" in message) {
    const value = message.value;
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  return JSON.stringify(payload);
}

function appendSapCookies(
  response: NextResponse,
  setCookie: string[] | undefined,
) {
  if (!setCookie || setCookie.length === 0) {
    return;
  }

  setCookie.forEach((cookieStr: string) => {
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
  });
}

function toUtf8String(data: unknown) {
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

function createLoginResponse({
  success,
  status,
  message,
  raw,
  setCookie,
}: {
  success: boolean;
  status: number;
  message: string;
  raw?: string;
  setCookie?: string[];
}) {
  const response = NextResponse.json(
    success
      ? {
          success: true,
          message,
          status,
        }
      : {
          success: false,
          message,
          status,
          error: {
            raw,
            message,
          },
        },
    {
      status: success ? 200 : status,
    },
  );

  appendSapCookies(response, setCookie);

  return response;
}

function normalizeSapBaseUrl(value: string) {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed;
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

function normalizeSapClient(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSapUsername(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildCookieHeaderFromSetCookie(setCookie: string[] | undefined) {
  if (!setCookie || setCookie.length === 0) {
    return "";
  }

  return setCookie
    .map((cookieStr) => cookieStr.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function encodeCookieHeader(cookieHeader: string) {
  return Buffer.from(cookieHeader, "utf8").toString("base64url");
}

function isSecureRequest(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:"
  );
}

function isMetadataResponse(data: unknown) {
  const raw = toUtf8String(data);

  return Boolean(
    raw &&
      (raw.includes("<edmx:Edmx") ||
        raw.includes("<edmx:DataServices") ||
        raw.includes("EntityContainer")),
  );
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, client } = await req.json();
    const sapClient = normalizeSapClient(client);
    const sapUsername = normalizeSapUsername(username);

    if (!sapClient || !/^\d{3}$/.test(sapClient)) {
      return NextResponse.json(
        {
          success: false,
          message: "SAP client is required",
          error: {
            message: "Enter a three-digit SAP client, for example 324.",
          },
        },
        { status: 400 },
      );
    }

    const sapBase = normalizeSapBaseUrl(process.env.SAP_BASE_URL || "");
    const testEndpoint = buildTargetUrl(
      sapBase,
      `opu/odata/sap/${process.env.SAP_PACKAGE ?? "ZSQLWB_ODATA_SRV"}/$metadata`,
    );

    // Build Basic Auth from the credentials entered by the developer.
    const authHeader = `Basic ${Buffer.from(`${sapUsername}:${password}`).toString("base64")}`;

    console.log(
      "Attempting SAP login via Basic Auth to:",
      testEndpoint,
      "sap-client=",
      sapClient,
    );

    // Call the required OData endpoint to verify Basic Auth and receive session cookies.
    const sapResponse = await axios.get(testEndpoint, {
      headers: {
        Authorization: authHeader,
      },
      params: { "sap-client": sapClient },
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    const setCookies = sapResponse.headers["set-cookie"] as
      | string[]
      | undefined;
    const hasSessionCookie = setCookies?.some(
      (c) =>
        c.toUpperCase().includes("SAP_SESSIONID") ||
        c.toUpperCase().includes("MYSAPSSO2") ||
        c.toUpperCase().includes("SAPSSO2"),
    );
    const cookieHeader = buildCookieHeaderFromSetCookie(setCookies);
    const sessionCheck =
      sapResponse.status >= 200 &&
      sapResponse.status < 400 &&
      hasSessionCookie &&
      cookieHeader
        ? await axios.get(testEndpoint, {
            headers: {
              Cookie: cookieHeader,
              Accept: "application/xml, text/xml, */*",
            },
            params: { "sap-client": sapClient },
            responseType: "arraybuffer",
            validateStatus: () => true,
          })
        : null;

    const success =
      sapResponse.status >= 200 &&
      sapResponse.status < 400 &&
      !!hasSessionCookie &&
      isMetadataResponse(sapResponse.data) &&
      !!sessionCheck &&
      sessionCheck.status >= 200 &&
      sessionCheck.status < 400;

    const response = createLoginResponse({
      success,
      status: success ? 200 : (sessionCheck?.status ?? sapResponse.status),
      message: success
        ? "SAP login successful"
        : "SAP login did not produce a valid reusable session",
      raw: toUtf8String(sessionCheck?.data ?? sapResponse.data),
      setCookie: setCookies,
    });

    if (success) {
      response.cookies.set("OSWB_SAP_COOKIE", encodeCookieHeader(cookieHeader), {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: isSecureRequest(req),
      });
      response.cookies.set("OSWB_SAP_CLIENT", sapClient, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: isSecureRequest(req),
      });
      response.cookies.set("OSWB_SAP_USER", sapUsername, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: isSecureRequest(req),
      });
    }

    return response;
  } catch (error: unknown) {
    const axiosError = error as {
      response?: { data?: unknown };
      message?: string;
    };

    console.error(
      "Login SAP exception:",
      axiosError.response?.data || axiosError.message || axiosError,
    );

    const rawMsg = extractSapErrorMessage(
      axiosError.response?.data ?? axiosError.message ?? "Unknown error",
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          raw: rawMsg,
          message:
            "Login failed. Check `SAP_LOGIN_URL`/`SAP_BASE_URL`, SAP client, and credentials.",
        },
      },
      { status: 500 },
    );
  }
}
