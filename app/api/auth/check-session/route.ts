import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const metadataPath = "/api/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/$metadata";

    if (!cookieHeader) {
      return NextResponse.json(
        { success: false, message: "Missing SAP session cookie" },
        { status: 401 },
      );
    }

    const response = await fetch(`${req.nextUrl.origin}${metadataPath}`, {
      headers: {
        Cookie: cookieHeader,
        Accept: "application/xml, text/xml, */*",
      },
      cache: "no-store",
    });

    if (response.ok) {
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
