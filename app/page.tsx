import Link from "next/link";

export default function Home() {
  return (
    <main className="fiori-page min-h-screen px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center justify-center">
        <section className="fiori-surface w-full rounded-lg p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Open SQL Workbench
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-foreground">
                SAP Query Workbench
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Login to access the workbench.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                href="/login"
              >
                Login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
