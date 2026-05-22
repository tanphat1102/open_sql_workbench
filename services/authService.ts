import type { SapCredentials, SapLoginResponse } from "@/types/sap";

export const authService = {
  login: async ({ username, password }: SapCredentials) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = (await response.json()) as SapLoginResponse;

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

    return data;
  },
};
