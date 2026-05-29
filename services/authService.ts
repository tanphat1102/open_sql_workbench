import type {
  SapCredentials,
  SapLoginResponse,
  SapSessionInfo,
} from "@/types/sap";

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function verifySessionWithRetry() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const sessionCheck = await fetch("/api/auth/check-session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    if (sessionCheck.ok) {
      return true;
    }

    if (attempt < maxAttempts) {
      await wait(250);
    }
  }

  return false;
}

export const authService = {
  login: async ({ username, password, client }: SapCredentials) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
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

    const verified = await verifySessionWithRetry();

    if (!verified) {
      throw new Error(
        "SAP login succeeded, but the session could not be verified. Please try again.",
      );
    }

    return data.success ? data : { success: true, message: data.message };
  },

  logout: async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("SAP logout failed");
    }

    return response.json() as Promise<{ success: boolean }>;
  },

  getSession: async () => {
    const response = await fetch("/api/auth/check-session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<SapSessionInfo>;
  },
};
