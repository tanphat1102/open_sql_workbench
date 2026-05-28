"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/authService";

export default function LoginPage() {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authService.login({ username, password, client });
      router.push("/workbench");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fiori-page relative min-h-screen overflow-hidden px-4 py-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Open SQL Workbench
            </div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Sign in to SAP
            </h1>
            <p className="max-w-lg text-base leading-7 text-muted-foreground">
              Enter your SAP client and credentials. The app stores only SAP
              session cookies and sends all traffic through the Next.js proxy.
            </p>
          </div>

          <div className="relative">
            <form
              onSubmit={handleSubmit}
              className="fiori-surface relative rounded-lg p-6 sm:p-8"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-primary">
                    Secure access
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">
                    Login to SAP
                  </h2>
                </div>
                <div className="rounded-md border border-[#b8d6ef] bg-accent px-3 py-1 text-xs text-primary">
                  Fiori-ready
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-foreground"
                    htmlFor="client"
                  >
                    Client
                  </label>
                  <Input
                    id="client"
                    value={client}
                    onChange={(event) => setClient(event.target.value)}
                    className="h-12"
                    placeholder="e.g. 324"
                    inputMode="numeric"
                    maxLength={3}
                    autoComplete="off"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-foreground"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-12"
                    placeholder="Enter SAP username"
                    autoComplete="username"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-foreground"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 pr-24"
                      placeholder="Enter SAP password"
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-2 my-auto rounded-md px-3 text-xs font-medium text-primary transition hover:bg-accent"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                ) : (
                  <div className="fiori-subtle rounded-lg px-4 py-3 text-sm leading-6 text-muted-foreground">
                    Client is sent as `sap-client` for login and later proxy
                    requests in this browser session.
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-md bg-primary text-base font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  <span className="inline-flex items-center gap-2">
                    {loading ? "Signing in..." : "Sign in"}
                    <ArrowRight className="size-4" />
                  </span>
                </Button>

                <p className="text-center text-xs leading-5 text-muted-foreground">
                  Login is handled by the Next.js API route, not by a direct
                  browser call to SAP.
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
