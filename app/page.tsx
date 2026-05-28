import Link from "next/link";

export default function Home() {
  return (
    <main className="fiori-page relative min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between px-6 py-10 lg:px-10">
        <div className="fiori-shell-bar flex items-center justify-between rounded-lg px-4 py-3 text-sm text-muted-foreground">
          <div>
            <p className="font-semibold uppercase tracking-[0.18em] text-primary">
              Open SQL Workbench
            </p>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Layered Next.js app for SAP OData v2 access through a stateless
              cookie proxy.
            </p>
          </div>
          <Link
            className="rounded-md border border-[#b8d6ef] bg-white px-4 py-2 text-primary transition hover:bg-accent"
            href="/login"
          >
            Open login
          </Link>
        </div>

        <div className="grid gap-10 py-16 lg:grid-cols-[1.4fr_0.9fr] lg:items-center lg:py-20">
          <div className="space-y-8">
            <div className="inline-flex rounded-md border border-[#b8d6ef] bg-accent px-4 py-2 text-sm text-primary">
              SAP NetWeaver through selectable client sessions
            </div>
            <div className="space-y-6">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                A clean workspace for SAP queries, sessions, and structured
                access.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                The app is organized into routing, presentation, client logic,
                services, utilities, and types so every SAP request flows
                through the proxy layer in a predictable way.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:bg-primary/90"
                href="/login"
              >
                Start session
              </Link>
              <Link
                className="rounded-md border border-[#b8d6ef] bg-white px-6 py-3 font-medium text-primary transition hover:bg-accent"
                href="/workbench"
              >
                Open workbench
              </Link>
            </div>
          </div>

          <div className="fiori-surface grid gap-4 rounded-lg p-6">
            <div className="fiori-subtle rounded-lg p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-primary">
                Architecture
              </p>
              <div className="mt-4 space-y-3 text-sm text-foreground">
                <div className="flex items-center justify-between rounded-md bg-white px-4 py-3">
                  <span>app</span>
                  <span className="text-primary">routes and APIs</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-white px-4 py-3">
                  <span>components</span>
                  <span className="text-primary">presentation</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-white px-4 py-3">
                  <span>hooks</span>
                  <span className="text-primary">client logic</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-white px-4 py-3">
                  <span>services</span>
                  <span className="text-primary">SAP requests</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-white px-4 py-3">
                  <span>lib</span>
                  <span className="text-primary">parsers and helpers</span>
                </div>
              </div>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              The first step in this restructure is replacing the generated
              starter screen with an actual product entry point.
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border py-8 text-sm text-muted-foreground md:grid-cols-3">
          <div>Proxy all SAP traffic through /api/sap/[...path].</div>
          <div>Keep OData parsing in lib/sapParser.ts.</div>
          <div>Use services for data access and hooks for UI state.</div>
        </div>
      </section>
    </main>
  );
}
