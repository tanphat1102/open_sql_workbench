import type { SapCredentials, SapLoginResponse } from "@/types/sap";

export const authService = {
  login: async ({ username, password, client }: SapCredentials) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, client }),
    });

    let data: SapLoginResponse;

    try {
      data = (await response.json()) as SapLoginResponse;
    } catch {
      data = { success: false, message: "SAP login failed" };
    }

    if (!response.ok) {
      if (typeof data.error === "string") {
        throw new Error(data.error);
      }

      if (data.error && typeof data.error === "object") {
        throw new Error(
          data.error.message || data.message || "SAP login failed",
        );
      }

      throw new Error(data.message || "SAP login failed");
    }

    const sessionCheck = await fetch("/api/auth/check-session", {
      method: "GET",
      credentials: "same-origin",
    });

    if (sessionCheck.ok) {
      return data.success ? data : { success: true, message: data.message };
    }

    throw new Error(data.message || "SAP login failed");
  },
};
