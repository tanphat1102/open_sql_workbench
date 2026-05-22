import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f8fc] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(60,130,246,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.1),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef5fb_100%)]" />
      <div className="absolute inset-0 opacity-55 bg-[linear-gradient(rgba(29,78,216,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(29,78,216,0.07)_1px,transparent_1px)] bg-size-[40px_40px]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between px-6 py-10 lg:px-10">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div>
            <p className="font-semibold uppercase tracking-[0.32em] text-sky-600">
              Open SQL Workbench
            </p>
            <p className="mt-2 max-w-2xl text-slate-600">
              Layered Next.js app for SAP OData v2 access through a stateless
              cookie proxy.
            </p>
          </div>
          <Link
            className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sky-700 transition hover:bg-sky-50"
            href="/login"
          >
            Open login
          </Link>
        </div>

        <div className="grid gap-10 py-16 lg:grid-cols-[1.4fr_0.9fr] lg:items-center lg:py-20">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700 backdrop-blur">
              SAP NetWeaver S40, client 324
            </div>
            <div className="space-y-6">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
                A clean workspace for SAP queries, sessions, and structured
                access.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                The app is organized into routing, presentation, client logic,
                services, utilities, and types so every SAP request flows
                through the proxy layer in a predictable way.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-sky-600 px-6 py-3 font-medium text-white transition hover:bg-sky-500"
                href="/login"
              >
                Start session
              </Link>
              <Link
                className="rounded-full border border-sky-200 bg-white px-6 py-3 font-medium text-sky-700 transition hover:bg-sky-50"
                href="/workbench"
              >
                Open workbench
              </Link>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,90,170,0.08)] backdrop-blur">
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-700/80">
                Architecture
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span>app</span>
                  <span className="text-sky-600">routes and APIs</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span>components</span>
                  <span className="text-sky-600">presentation</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span>hooks</span>
                  <span className="text-sky-600">client logic</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span>services</span>
                  <span className="text-sky-600">SAP requests</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span>lib</span>
                  <span className="text-sky-600">parsers and helpers</span>
                </div>
              </div>
            </div>
            <p className="text-sm leading-7 text-slate-600">
              The first step in this restructure is replacing the generated
              starter screen with an actual product entry point.
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-t border-sky-100 py-8 text-sm text-slate-600 md:grid-cols-3">
          <div>Proxy all SAP traffic through /api/sap/[...path].</div>
          <div>Keep OData parsing in lib/sapParser.ts.</div>
          <div>Use services for data access and hooks for UI state.</div>
        </div>
      </section>
    </main>
  );
}
