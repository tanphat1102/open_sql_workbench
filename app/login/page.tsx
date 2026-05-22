"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Server, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/authService";

export default function LoginPage() {
  const router = useRouter();
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
      await authService.login({ username, password });
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
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] px-6 py-8 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.16),transparent_22%),linear-gradient(180deg,#06101d_0%,#091425_52%,#050b14_100%)]" />
      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-size-[44px_44px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-200/80 backdrop-blur">
              <Sparkles className="size-3.5" />
              Open SQL Workbench
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Sign in to the SAP workbench with a clean, controlled session.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                This login screen sends credentials to the Next.js auth route,
                which exchanges them for SAP cookies and keeps the browser
                session stateless.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <Server className="size-5 text-cyan-300" />
                <p className="mt-3 text-sm font-medium text-white">Proxy first</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  All SAP traffic stays behind `/api/sap/...`.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <ShieldCheck className="size-5 text-cyan-300" />
                <p className="mt-3 text-sm font-medium text-white">Cookie session</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  SAP session cookies are written back to the browser.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <LockKeyhole className="size-5 text-cyan-300" />
                <p className="mt-3 text-sm font-medium text-white">No token storage</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  The app does not rely on local auth token storage.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-cyan-400/10 blur-3xl" />
            <form
              onSubmit={handleSubmit}
              className="relative rounded-[2rem] border border-white/12 bg-slate-950/75 p-6 shadow-[0_30px_100px_rgba(2,8,23,0.65)] backdrop-blur-xl sm:p-8"
            >
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
                    Secure access
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Login to SAP
                  </h2>
                </div>
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                  Fiori-ready
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-slate-200"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-12 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-cyan-300 focus-visible:ring-cyan-300/25"
                    placeholder="Enter SAP username"
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-slate-200"
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
                      className="h-12 border-white/10 bg-white/5 pr-24 text-white placeholder:text-slate-500 focus-visible:border-cyan-300 focus-visible:ring-cyan-300/25"
                      placeholder="Enter SAP password"
                      autoComplete="current-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-2 my-auto rounded-full px-3 text-xs font-medium text-cyan-100 transition hover:bg-white/10"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                  >
                    {error}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-3 text-sm leading-6 text-cyan-50/85">
                    Use your TUM SAP credentials. The browser will receive the
                    SAP session cookies after a successful sign-in.
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-2xl bg-cyan-500 text-base font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  <span className="inline-flex items-center gap-2">
                    {loading ? "Signing in..." : "Sign in"}
                    <ArrowRight className="size-4" />
                  </span>
                </Button>

                <p className="text-center text-xs leading-5 text-slate-400">
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
