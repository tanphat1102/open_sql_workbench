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

function translateSapError(message: string): string {
  if (
    // Test GitHub Actions CI/CD pipeline
    /Ressource gefunden/i.test(message) ||
    /Resource not found/i.test(message)
  ) {
    return "SAP không tìm thấy resource tương ứng với URI yêu cầu. Kiểm tra `SAP_LOGIN_URL` hoặc `SAP_BASE_URL`.";
  }

  if (/authentication|invalid user|logon/i.test(message)) {
    return "Tên đăng nhập hoặc mật khẩu SAP không đúng.";
  }

  if (/csrf|X-CSRF-Token/i.test(message)) {
    return "Lỗi token CSRF khi gọi SAP.";
  }

  return "Lỗi khi kết nối đến SAP.";
}

function hasSapSessionCookie(setCookie: string[] | undefined): boolean {
  if (!setCookie || setCookie.length === 0) {
    return false;
  }

  return setCookie.some((cookie) =>
    /SAP_SESSIONID|MYSAPSSO2|SAP_LOGIN/i.test(cookie),
  );
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const sapBase = (process.env.SAP_BASE_URL || "").replace(/\/+$/, "");
    const sapLoginUrl = (process.env.SAP_LOGIN_URL || sapBase).replace(
      /\/+$/,
      "",
    );
    const sapClient = process.env.SAP_CLIENT;
    const isWebGui = /\/sap\/bc\/gui\/sap\/its\/webgui$/i.test(sapLoginUrl);

    // Tạo mã Basic Auth từ tài khoản dev nhập vào
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    console.log(
      "Attempting SAP login to:",
      sapLoginUrl,
      "sap-client=",
      sapClient,
      "mode=",
      isWebGui ? "webgui" : "basic-auth",
    );

    if (isWebGui) {
      const loginPageResponse = await axios.get(sapLoginUrl, {
        params: sapClient ? { "sap-client": sapClient } : undefined,
        validateStatus: () => true,
      });

      const loginPageHtml =
        typeof loginPageResponse.data === "string"
          ? loginPageResponse.data
          : "";
      const xsrfToken =
        extractXsrfToken(loginPageHtml) ||
        loginPageResponse.headers["sap-login-xsrf"] ||
        loginPageResponse.headers["x-csrf-token"];
      const cookieHeader = extractCookieHeader(
        loginPageResponse.headers["set-cookie"],
      );

      const form = new URLSearchParams();
      form.set("sap-system-login-oninputprocessing", "onLogin");
      form.set("sap-urlscheme", "");
      form.set("sap-system-login", "onLogin");
      form.set("sap-system-login-basic_auth", "");
      form.set("sap-accessibility", "");
      if (typeof xsrfToken === "string" && xsrfToken.length > 0) {
        form.set("sap-login-XSRF", xsrfToken);
      }
      form.set("sap-system-login-cookie_disabled", "");
      if (sapClient) {
        form.set("sap-client", sapClient);
      }
      form.set("sap-user", username);
      form.set("sap-password", password);
      form.set("sap-language", "EN");
      form.set("sap-language-dropdown", "English");
      form.set("sysid", "S40");

      const sapResponse = await axios.post(sapLoginUrl, form.toString(), {
        params: sapClient ? { "sap-client": sapClient } : undefined,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          ...(typeof xsrfToken === "string" && xsrfToken.length > 0
            ? { "sap-login-XSRF": xsrfToken }
            : {}),
          Referer: sapLoginUrl,
        },
        maxRedirects: 0,
        validateStatus: () => true,
      });

      const sapCookies = (sapResponse.headers["set-cookie"] || []) as string[];
      const hasSessionCookie = hasSapSessionCookie(sapCookies);

      if (
        (sapResponse.status >= 400 && !hasSessionCookie) ||
        (!hasSessionCookie &&
          sapResponse.status !== 302 &&
          sapResponse.status !== 200)
      ) {
        console.error("SAP WebGUI login failed", {
          status: sapResponse.status,
          headers: sapResponse.headers,
          data: sapResponse.data,
        });

        const rawMessage = extractSapErrorMessage(sapResponse.data);
        return NextResponse.json(
          {
            success: false,
            status: sapResponse.status,
            error: {
              raw: rawMessage,
              message: translateSapError(rawMessage),
            },
          },
          { status: sapResponse.status >= 400 ? sapResponse.status : 401 },
        );
      }

      if (sapResponse.status === 404 && hasSessionCookie) {
        console.warn(
          "SAP WebGUI returned 404 but session cookies were issued; treating as success.",
        );
      }

      const response = NextResponse.json({
        success: true,
        message:
          sapResponse.status === 302
            ? "Đăng nhập SAP GUI thành công (302 là trạng thái chuyển hướng hợp lệ)"
            : "Đăng nhập SAP GUI thành công",
      });

      sapCookies.forEach((cookieStr) => {
        const cleanCookie = cookieStr.replace(/path=\/[^;]*/i, "path=/");
        response.headers.append("Set-Cookie", cleanCookie);
      });

      return response;
    }

    // Gọi thử lên SAP Gateway để kiểm tra tài khoản và lấy Session Cookie
    const sapResponse = await axios.get(`${sapLoginUrl}/`, {
      headers: {
        Authorization: authHeader,
        "X-CSRF-Token": "Fetch",
      },
      params: sapClient ? { "sap-client": sapClient } : undefined,
      validateStatus: () => true,
    });

    const sapCookies = (sapResponse.headers["set-cookie"] || []) as string[];
    const hasSessionCookie = hasSapSessionCookie(sapCookies);

    if (sapResponse.status >= 400 && !hasSessionCookie) {
      console.error("SAP login request failed", {
        status: sapResponse.status,
        data: sapResponse.data,
        headers: sapResponse.headers,
      });

      const rawMsg = extractSapErrorMessage(sapResponse.data);

      return NextResponse.json(
        {
          success: false,
          status: sapResponse.status,
          error: {
            raw: rawMsg,
            message: translateSapError(rawMsg),
          },
        },
        { status: sapResponse.status },
      );
    }

    if (sapResponse.status === 404 && hasSessionCookie) {
      console.warn(
        "SAP basic-auth returned 404 but session cookies were issued; treating as success.",
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Đăng nhập SAP thành công",
    });

    // Ghi đè Cookie của SAP vào Trình duyệt của Client, sửa path thành root (/)
    sapCookies.forEach((cookieStr: string) => {
      const cleanCookie = cookieStr.replace(/path=\/[^;]*/i, "path=/");
      response.headers.append("Set-Cookie", cleanCookie);
    });

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
            "Đăng nhập thất bại. Kiểm tra `SAP_LOGIN_URL`/`SAP_BASE_URL`, `SAP_CLIENT` và thông tin đăng nhập.",
        },
      },
      { status: 500 },
    );
  }
}
