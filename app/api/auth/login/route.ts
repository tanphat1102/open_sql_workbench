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

function extractCookieHeader(
  setCookie: string[] | undefined,
): string | undefined {
  if (!setCookie || setCookie.length === 0) {
    return undefined;
  }

  return setCookie.map((cookie) => cookie.split(";")[0]).join("; ");
}

function extractXsrfToken(html: string): string | undefined {
  const match = html.match(/name="sap-login-XSRF"[^>]*value="([^"]+)"/i);
  return match?.[1];
}

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
    const cleanCookie = cookieStr.replace(/path=\/[^;]*/i, "path=/");
    response.headers.append("Set-Cookie", cleanCookie);
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

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const sapBase = normalizeSapBaseUrl(process.env.SAP_BASE_URL || "");
    const testEndpoint = `${sapBase}/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/$metadata`;
    const sapClient = process.env.SAP_CLIENT;

    // Tạo mã Basic Auth từ tài khoản dev nhập vào
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    console.log(
      "Attempting SAP login via Basic Auth to:",
      testEndpoint,
      "sap-client=",
      sapClient,
    );

    // Gọi thử lên OData Endpoint bắt buộc để kiểm tra Basic Auth và lấy Session Cookie
    const sapResponse = await axios.get(testEndpoint, {
      headers: {
        Authorization: authHeader,
      },
      params: sapClient ? { "sap-client": sapClient } : undefined,
      responseType: "arraybuffer",
      validateStatus: () => true, // Không quăng lỗi nếu status >= 400 để tự handle
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

    const success =
      (sapResponse.status >= 200 && sapResponse.status < 400) ||
      !!hasSessionCookie;

    return createLoginResponse({
      success,
      status: success ? 200 : sapResponse.status,
      message: success
        ? "SAP login successful"
        : "Tài khoản hoặc mật khẩu không đúng",
      raw: toUtf8String(sapResponse.data),
      setCookie: setCookies,
    });
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
            "Đăng nhập thất bại. Kiểm tra `SAP_LOGIN_URL`/`SAP_BASE_URL`, `SAP_CLIENT` và thông tin đăng nhập.",
        },
      },
      { status: 500 },
    );
  }
}
