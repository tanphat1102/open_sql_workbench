"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { authService } from "@/services/authService";

export default function LoginPage() {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await authService.login({ username, password, client });
      toast({
        title: "Signed in to SAP",
        description: `Client ${client.trim()} is ready for queries.`,
        variant: "success",
      });
      router.push("/workbench");
    } catch (loginError) {
      toast({
        title: "Unable to sign in",
        description:
          loginError instanceof Error ? loginError.message : "Login failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fiori-page min-h-screen px-4 py-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="fiori-surface w-full rounded-lg p-6 sm:p-8"
        >
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Open SQL Workbench
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">
              Sign in
            </h1>
          </div>

          <div className="space-y-5">
            {/* Client field */}
            <div>
              <label
                className="mb-2 block text-sm font-medium text-foreground"
                htmlFor="client"
              >
                Client
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="client"
                value={client}
                onChange={(event) => setClient(event.target.value)}
                className="h-12"
                placeholder="Your client code"
                inputMode="numeric"
                maxLength={3}
                autoComplete="off"
                disabled={loading}
                required
              />
            </div>

            {/* Username field */}
            <div>
              <label
                className="mb-2 block text-sm font-medium text-foreground"
                htmlFor="username"
              >
                Username
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-12"
                placeholder="Your username"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>

            {/* Password field */}
            <div>
              <label
                className="mb-2 block text-sm font-medium text-foreground"
                htmlFor="password"
              >
                Password
                <span className="ml-1 text-destructive">*</span>{" "}
                {/* Thêm dấu * */}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 pr-24"
                  placeholder="Your password"
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
          </div>
        </form>
      </section>
    </main>
  );
}
