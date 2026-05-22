import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const targetPath = path.join("/");
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const fullTargetUrl = `${process.env.SAP_BASE_URL}/${targetPath}${queryString ? "?" + queryString : ""}`;

    const method = req.method;

    // 1. Đọc toàn bộ Cookie mà trình duyệt của Dev gửi lên Next.js
    const clientCookies = req.headers.get("cookie") || "";

    // Nếu dev chưa đăng nhập (không có cookie), chặn lại luôn
    if (!clientCookies.includes("SAP_SESSIONID")) {
      return NextResponse.json(
        { error: "Chưa đăng nhập hệ thống SAP" },
        { status: 401 },
      );
    }

    const extraHeaders: Record<string, string> = {
      Cookie: clientCookies,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // 2. Nếu là lệnh ghi (POST/PUT/DELETE), dùng chính Cookie của Dev để xin CSRF Token mới
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const csrfRes = await axios.get(`${process.env.SAP_BASE_URL}/`, {
        headers: { Cookie: clientCookies, "X-CSRF-Token": "Fetch" },
        params: { "sap-client": process.env.SAP_CLIENT },
      });
      extraHeaders["X-CSRF-Token"] = csrfRes.headers["x-csrf-token"] || "";
    }

    // 3. Đọc dữ liệu body nếu có
    const body = ["POST", "PUT", "PATCH"].includes(method)
      ? await req.json()
      : undefined;

    // 4. Bắn request sang SAP với tư cách của Dev đang giữ Cookie đó
    const sapResponse = await axios({
      method,
      url: fullTargetUrl,
      data: body,
      headers: extraHeaders,
      params: { "sap-client": process.env.SAP_CLIENT },
    });

    const response = NextResponse.json(sapResponse.data);

    // Nếu SAP có cập nhật hay refresh Cookie, đẩy ngược lại cho trình duyệt luôn
    const sapNewCookies = sapResponse.headers["set-cookie"] || [];
    sapNewCookies.forEach((cookieStr) => {
      const cleanCookie = cookieStr.replace(/path=\/[^;]*/i, "path=/");
      response.headers.append("Set-Cookie", cleanCookie);
    });

    return response;
  } catch (error: unknown) {
    const axiosError = error as {
      response?: { status?: number; data?: unknown };
    };

    if (axiosError.response?.status === 401) {
      return NextResponse.json(
        { error: "Phiên làm việc SAP đã hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Lỗi truy vấn SAP", details: axiosError.response?.data },
      { status: axiosError.response?.status || 500 },
    );
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PUT,
  handleProxy as DELETE,
};
