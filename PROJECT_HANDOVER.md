# Project Handover - Open SQL Workbench

Last updated: 2026-06-24

## 1. Overview

Open SQL Workbench is a Next.js App Router application for querying SAP NetWeaver data through the custom OData V2 service `ZSQLWB_ODATA_SRV`.

The application is designed for developers who need a lightweight SQL workbench experience similar to database workbench tools:

- SAP login using SAP session cookies.
- Open SQL editor with Monaco, autocomplete, validation, and formatting.
- Object Explorer for allowed SAP objects and fields.
- Query execution through SAP OData proxy routes.
- Paginated result grid with search, fullscreen preview, CSV/Excel export.
- Messages panel for success/error/debug feedback.
- Visual Query Builder for drag/drop object selection, explicit join fields, and `WHERE` filters.
- Playwright E2E tests for mocked UI flow and optional live SAP UI/backend checks.

The frontend never calls SAP directly from browser code. All SAP traffic goes through Next.js API routes under `/api`.

## 2. Technology Stack

Runtime:

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript `5`
- Tailwind CSS `4`

Main libraries:

- `axios`: server-side SAP auth/session calls.
- `monaco-editor`: SQL editor.
- `radix-ui` + local shadcn-style UI components.
- `lucide-react`: icons.
- `sql-formatter`: SQL formatting helper.
- `jsonrepair`: recovery for partial/truncated JSON payloads.
- `xlsx`: Excel export.
- `@playwright/test`: E2E tests.

Scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test:e2e
```

## 3. Repository Structure

```text
app/
  api/
    auth/login/route.ts          SAP Basic Auth login and SAP cookie capture
    auth/check-session/route.ts  SAP session verification
    auth/logout/route.ts         SAP Gateway logout and local cookie cleanup
    sap/[...path]/route.ts       Catch-all SAP OData proxy
  login/page.tsx                 Login UI
  workbench/page.tsx             Main workbench page
  page.tsx                       Minimal production home page

components/
  ui/                            Local shadcn/radix-style primitives
  workbench/
    workbench-dashboard.tsx      Main layout and panel orchestration
    query-workbench.tsx          SQL editor + Builder tabs
    sql-editor.tsx               Monaco setup, suggestions, validation
    visual-query-builder.tsx     Drag/drop builder, joins, WHERE filters
    entity-browser.tsx           Object Explorer and draggable objects
    results-table.tsx            Result grid, paging, export, fullscreen
    activity-feed.tsx            Messages/activity panel

hooks/
  use-workbench.ts               Client-side state, query execution, result cache

services/
  authService.ts                 Client auth calls
  sapClient.ts                   Browser client for `/api/sap`
  sqlAssistService.ts            SearchTables/GetFields access
  workbenchService.ts            RunQuery/PreviewTable/result chunks

lib/
  sapParser.ts                   OData V2 parsing and SAP date parsing
  openSqlValidation.ts           Client-side SQL diagnostics
  openSqlFormatter.ts            SQL formatter glue
  toast.ts                       Toast helper
  utils.ts                       UI utilities

types/
  sap.ts                         SAP OData DTO types
  workbench.ts                   UI/workbench domain types

tests/
  e2e/workbench.spec.ts          Mocked Playwright UI flow
  sql-workbench-all.spec.ts      Optional live SAP UI/backend test suite

odata-current-endpoint-contract.md
  Current backend OData contract notes.
```

## 4. Environment Variables

Required for local/dev/prod runtime:

```bash
SAP_BASE_URL=https://<sap-host>:<port>/sap
SAP_CLIENT=324
NEXT_PUBLIC_SQLWB_PROFILE_ID=DEV
```

Notes:

- `SAP_BASE_URL` is read only by server-side route handlers.
- `SAP_CLIENT` is a fallback. The login page accepts client input and stores it in `OSWB_SAP_CLIENT`.
- `NEXT_PUBLIC_SQLWB_PROFILE_ID` is used by frontend services when calling `SearchTables`, `GetFields`, `RunQuery`, and `PreviewTable`. Default is `DEV`.

Optional for live E2E:

```bash
E2E_BASE_URL=http://127.0.0.1:3000
E2E_SAP_CLIENT=324
E2E_SAP_USERNAME=<sap-user>
E2E_SAP_PASSWORD=<sap-password>
PLAYWRIGHT_PORT=3000
```

Fallbacks for live E2E:

- `E2E_SAP_CLIENT` falls back to `SAP_CLIENT`.
- `E2E_SAP_USERNAME` falls back to `SAP_USERNAME`.
- `E2E_SAP_PASSWORD` falls back to `SAP_PASSWORD`.

Security rule:

- Do not commit real SAP usernames/passwords.
- Credentials must not be hardcoded or stored in `.env.local`.

## 5. Authentication And Session Flow

The current auth design is intentionally cookie-based and stateless from the application database perspective. There is no app-side session table. The browser holds SAP-issued cookies and a small set of `OSWB_*` helper cookies. Every SAP request is authenticated by forwarding those cookies back to SAP through the Next.js proxy.

High-level flow:

```text
Browser
  -> /api/auth/login
      -> SAP $metadata with Basic Auth
      <- SAP Set-Cookie
  <- Browser receives SAP cookies + OSWB helper cookies

Browser
  -> /api/sap/...
      -> Next.js proxy reads OSWB_SAP_COOKIE / SAP cookies
      -> SAP OData with Cookie + sap-client
      <- SAP raw OData response
  <- Browser receives raw proxied response
```

Why this exists:

- SAP Gateway is not designed to be called directly from the browser in this app because of CORS, cookie domain, and security constraints.
- SAP session cookies are the real auth mechanism after login.
- Credentials are used only once during login and are not stored.
- The frontend can stay stateless; session validity is delegated to SAP.

### 5.1 Login

File: `app/api/auth/login/route.ts`

Flow:

1. Client posts `{ username, password, client }` to `/api/auth/login`.
2. Route validates `client` as a three-digit SAP client.
3. Route builds Basic Auth from the submitted username/password.
4. Route calls `$metadata` on `ZSQLWB_ODATA_SRV` with Basic Auth and `sap-client`.
5. SAP returns session cookies such as `SAP_SESSIONID_*`, `MYSAPSSO2`, or `SAPSSO2`.
6. Route builds a plain cookie header from SAP `Set-Cookie` values.
7. Route verifies that the received cookies can call `$metadata` again without Basic Auth.
8. On success, route writes:
   - SAP cookies with `Path=/`, `SameSite=Lax`
   - `OSWB_SAP_COOKIE` as httpOnly base64url encoded SAP cookie header
   - `OSWB_SAP_CLIENT`
   - `OSWB_SAP_USER`

Reason for `OSWB_SAP_COOKIE`:

- Deployed platforms and browser cookie encoding can make raw SAP session cookies unreliable.
- The app stores a reusable SAP cookie header server-side-readable via an httpOnly cookie.

Important implementation details:

- The route strips SAP cookie `Domain`, `Path`, `Secure`, and `SameSite` attributes before writing browser cookies, then rewrites them for the app domain.
- `OSWB_SAP_COOKIE` is httpOnly so client-side JavaScript cannot read it.
- `OSWB_SAP_CLIENT` and `OSWB_SAP_USER` are not httpOnly because the UI uses them to display client/user context.
- `secure` is enabled when the request is HTTPS or behind an HTTPS proxy.
- A login is considered successful only when:
  - first `$metadata` request succeeds,
  - at least one SAP session/SSO cookie exists,
  - metadata body looks like SAP metadata,
  - second `$metadata` request with cookie-only auth succeeds.

Failure behavior:

- Invalid client returns 400.
- Bad credentials or invalid reusable session returns a JSON error.
- The app should show this in dialog/toast, not a browser-native auth prompt.

### 5.2 Check Session

File: `app/api/auth/check-session/route.ts`

Flow:

1. Reads `OSWB_SAP_COOKIE`; falls back to raw SAP cookies from the browser request.
2. Reads client from `OSWB_SAP_CLIENT`, fallback `SAP_CLIENT`.
3. Calls `$metadata`.
4. Returns `{ success: true, client, user }` if SAP responds 2xx/3xx.
5. Returns 401 if cookie is missing or SAP rejects it.

Why it calls `$metadata`:

- `$metadata` is cheap and stable compared with a query.
- It proves that the session cookie is still accepted by SAP Gateway.
- It also confirms that `sap-client` is being forwarded correctly.

Known historical issue:

- Earlier behavior accepted the presence of a cookie as enough. That made UI state look logged in even when SAP later rejected queries.
- Current behavior validates against SAP to avoid a false-positive session.

Cookie decoding detail:

- Some SAP session values may contain encoded `%25`.
- `getSapCookieHeader` normalizes this for `SAP_SESSIONID`, `MYSAPSSO2`, and `SAPSSO2`.

### 5.3 Logout

File: `app/api/auth/logout/route.ts`

Flow:

1. Reads stored SAP cookie header.
2. Calls SAP Gateway logoff endpoint:

```text
sap/public/bc/icf/logoff
```

3. Clears:
   - `OSWB_SAP_CLIENT`
   - `OSWB_SAP_COOKIE`
   - `OSWB_SAP_USER`
   - SAP session cookies visible in request

Logout is best-effort:

- If SAP logoff endpoint does not respond cleanly, local cookies should still be cleared.
- The UI should treat successful local cleanup as logged out.

## 6. SAP Proxy

File: `app/api/sap/[...path]/route.ts`

All frontend SAP calls must go through:

```text
/api/sap/<relative-sap-path>
```

Responsibilities:

- Rebuild target URL from `SAP_BASE_URL`.
- Forward SAP cookies from `OSWB_SAP_COOKIE` or raw SAP cookies.
- Add `sap-client` query param if missing.
- Fetch CSRF token for `POST`, `PUT`, `DELETE`.
- Forward raw SAP response bytes without reshaping payloads.
- Strip unsafe hop-by-hop headers.
- Forward SAP `Set-Cookie` headers back to browser.
- Clear local SAP cookies on 401.

### 6.1 Why The Proxy Is Mandatory

The proxy exists for four reasons:

1. CORS: browser-to-SAP direct requests are blocked or unreliable.
2. Cookie domain: SAP cookies belong to the SAP host, while the app runs on localhost/Vercel/custom host.
3. Security: credentials and SAP session handling must stay server-side as much as possible.
4. CSRF: write-style OData calls need a token fetched with the same SAP session.

The browser should only know:

```text
/api/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/...
```

It should never know or call:

```text
https://<sap-host>:<port>/sap/opu/odata/sap/...
```

### 6.2 URL Rebuild Logic

Input from frontend:

```text
/api/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/SearchTables?...
```

Catch-all route receives:

```text
path = ["opu", "odata", "sap", "ZSQLWB_ODATA_SRV", "SearchTables"]
```

Proxy builds:

```text
<SAP_BASE_URL>/opu/odata/sap/ZSQLWB_ODATA_SRV/SearchTables?...
```

There is a guard for `SAP_BASE_URL` values that already end with `/sap/opu/odata/sap`. If the base already contains that prefix, the proxy does not duplicate `opu/odata/sap`.

### 6.3 Cookie Forwarding Logic

Cookie source priority:

1. `OSWB_SAP_COOKIE`
2. raw request cookie header filtered to SAP cookies

Forwarded cookie names include:

- `SAP_*`
- `sap-*`
- `MYSAPSSO2`
- `SAPSSO2`

Reason for priority:

- `OSWB_SAP_COOKIE` is the most reliable representation of the SAP cookie header captured at login.
- Raw browser SAP cookies are fallback for local cases where they are still visible.

### 6.4 Client Forwarding Logic

Proxy reads client from:

1. `OSWB_SAP_CLIENT`
2. `SAP_CLIENT` env fallback

If the upstream URL does not already contain `sap-client`, proxy appends it.

This matters because SAP session names often include the client, for example:

```text
SAP_SESSIONID_S40_324
```

A cookie from client `324` can fail when the request is sent with a different or missing `sap-client`.

### 6.5 CSRF Token Flow

For these methods:

```text
POST
PUT
DELETE
```

Proxy first fetches a CSRF token:

```text
GET /sap/opu/odata/sap/ZSQLWB_ODATA_SRV/
X-CSRF-Token: Fetch
Cookie: <SAP session>
Accept: application/json
```

Then forwards the original request with:

```text
X-CSRF-Token: <token>
Cookie: <same SAP session>
```

For SQL Workbench function imports:

- `RunQuery` is POST.
- `PreviewTable` is POST.

Even if the request body is empty, CSRF still matters because SAP Gateway treats POST as state-changing from a protocol perspective.

### 6.6 Raw Response Forwarding

Proxy reads SAP response as bytes:

```ts
const upstreamArrayBuffer = await sapResponse.arrayBuffer();
const bodyUint8 = new Uint8Array(upstreamArrayBuffer);
```

Then returns those bytes directly.

Why:

- OData responses can be large.
- SAP may return JSON, XML, or error payloads.
- Parsing/stringifying in the proxy can corrupt payload length or truncate diagnostics.
- The client services need raw debug metadata for the SAP responses viewer.

The proxy adds debug headers:

```text
x-oswb-upstream-content-length
x-oswb-upstream-content-type
x-oswb-proxy-bytes
```

These help diagnose:

- truncated OData responses,
- decompression/content-length mismatch,
- proxy byte count vs upstream byte count.

### 6.7 Header Filtering

The proxy strips hop-by-hop or dangerous headers:

- `transfer-encoding`
- `connection`
- `keep-alive`
- `www-authenticate`
- `proxy-authenticate`
- `proxy-authorization`
- `te`
- `trailer`
- `upgrade`
- `set-cookie`
- `content-length`
- `content-encoding`

Why strip `www-authenticate`:

- If SAP returns `401` with `WWW-Authenticate`, the browser opens a native username/password modal.
- That modal is not usable for this app because login requires SAP client and app-side cookie handling.
- The app should surface auth errors in the UI, not browser chrome.

Why strip `content-length` and `content-encoding`:

- The runtime may already decompress upstream responses.
- Reusing upstream length/encoding after reading bytes can make browser network diagnostics misleading.

### 6.8 SAP Set-Cookie Forwarding

The proxy forwards SAP `Set-Cookie` headers individually after sanitizing attributes:

- removes upstream `Domain`
- removes upstream `Path`
- removes upstream `Secure`
- removes upstream `SameSite`
- writes app-domain cookie with `Path=/`, `SameSite=Lax`

This lets SAP refresh session cookies while the user uses the app.

### 6.9 401 Handling

When SAP returns `401`:

1. Proxy creates the same response status/body.
2. Proxy clears local helper cookies:
   - `OSWB_SAP_CLIENT`
   - `OSWB_SAP_COOKIE`
   - `OSWB_SAP_USER`
3. Proxy clears visible SAP cookies.

Expected UI behavior:

- Mark session as expired.
- Ask user to sign in again through app login.
- Do not keep retrying failed SAP requests in a loop.

Do not:

- Call SAP directly from client components.
- Parse or mutate OData payloads in the proxy.
- Forward `www-authenticate`; it causes browser native auth popups.

## 7. OData Backend Contract

Service:

```text
ZSQLWB_ODATA_SRV
```

Base path:

```text
/sap/opu/odata/sap/ZSQLWB_ODATA_SRV/
```

Current important endpoints:

- `$metadata`
- `SearchTables`
- `GetFields`
- `RunQuery`
- `PreviewTable`
- `SqlwbColumnSet`
- `SqlwbPageChunkSet`

Profile:

```text
ProfileId='DEV'
```

or `NEXT_PUBLIC_SQLWB_PROFILE_ID`.

### 7.1 Object Discovery

Used by Object Explorer and editor suggestions:

```text
GET SearchTables?ProfileId='DEV'&SearchText=''&MaxRows=10000
GET GetFields?ProfileId='DEV'&ObjectName='<object>'
```

Only backend-whitelisted objects should be shown.

### 7.2 Query Execution

The app uses `RunQuery`:

```text
POST RunQuery?ProfileId='DEV'&SqlText='<encoded SQL>'&Page=1
```

Expected response contains:

- `ResultId`
- `Status`
- `ObjectName`
- `Page`
- `PageSize`
- `TotalRows`
- `ReturnedRows`
- `TotalPages`
- optional error fields

Then the app loads:

```text
GET SqlwbColumnSet?$filter=ResultId eq '<ResultId>'&$select=...
GET SqlwbPageChunkSet?$filter=ResultId eq '<ResultId>' and PageNo eq '1'&$select=...
```

The frontend joins `PayloadPart` by `ChunkNo`, parses JSON rows, and renders the page.

### 7.3 Preview

Preview uses:

```text
POST PreviewTable?ProfileId='DEV'&ObjectName='<object>'&MaxRows=100&Page=1
```

Then loads columns/chunks by `ResultId`, same as `RunQuery`.

### 7.4 Backend SQL Limitations Captured In Tests

Current backend does not support:

- `SELECT TOP n ...`
- `UP TO n ROWS`
- `SELECT *` in join queries

Join queries must explicitly select fields:

```sql
SELECT a~carrid, a~carrname, b~connid
FROM scarr AS a
INNER JOIN spfli AS b
ON a~carrid = b~carrid
```

Do not use `MANDT` in `ON`; SAP client handling is done by compiler/backend:

```sql
ON a~mandt = b~mandt
```

is invalid.

## 8. Workbench UI Features

### 8.1 Login

Route:

```text
/login
```

Fields:

- Client
- Username
- Password

Uses shadcn dialog/toast patterns instead of browser auth alerts.

### 8.2 Main Workbench

Route:

```text
/workbench
```

Primary areas:

- Header: app name, active entity/page summary, panel toggles, user profile menu.
- Object Explorer: entity list, preview actions, selected entity metadata.
- Query panel: SQL editor and visual Builder tabs.
- Results panel: table, paging, search, fullscreen, download.
- Messages panel: execution log and error details.

### 8.3 SQL Editor

File:

```text
components/workbench/sql-editor.tsx
```

Features:

- Monaco editor.
- Keyword suggestions.
- Table/field suggestions from backend metadata.
- Syntax diagnostics via `lib/openSqlValidation.ts`.
- Formatter via `lib/openSqlFormatter.ts`.
- Non-production test bridge:

```ts
window.__openSqlWorkbenchEditor
```

This bridge is only created when `NODE_ENV !== "production"`.

### 8.4 Visual Query Builder

File:

```text
components/workbench/visual-query-builder.tsx
```

Features:

- Drag objects from Object Explorer into Builder canvas.
- GPU-friendly drag implementation using `requestAnimationFrame` and `translate3d`.
- Smart join suggestions based on matching fields, key fields, and common SAP fields.
- `MANDT` is blocked for joins.
- Join lines rendered with SVG:
  - blue solid for `INNER JOIN`
  - amber dashed for `LEFT OUTER JOIN`
- Join is valid only when both fields exist in metadata.
- Joined queries require explicit projection fields.
- `WHERE` filters with:
  - object/alias
  - metadata field
  - operator
  - value
  - `AND`/`OR`

Generated join example:

```sql
SELECT a~carrid, a~carrname, b~connid, b~cityfrom
FROM scarr AS a
INNER JOIN spfli AS b
ON a~carrid = b~carrid
WHERE a~carrid = 'LH'
```

Known UI rule:

- Drag is started only from the grip icon, not the full object header, so delete/select controls remain clickable.

### 8.5 Results

File:

```text
components/workbench/results-table.tsx
```

Features:

- Paginated rows.
- Page navigation.
- Result page caching and prefetching in `hooks/use-workbench.ts`.
- Search within loaded page.
- Fullscreen preview.
- Download CSV/Excel via `xlsx`.
- SAP raw response debug panel.

## 9. UI Design System And Color Handoff

The current UI direction is SAP Fiori-inspired: clean white surfaces, SAP blue actions, pale blue shell background, compact enterprise density, and clear status colors. It should feel like a production database workbench, not a marketing page.

Primary design goals:

- Prioritize editor, result table, Object Explorer, and Messages.
- Keep layouts dense but readable.
- Prefer toolbar actions and utility panels over decorative hero/card layouts.
- Keep colors functional: blue for primary/action/navigation, green for success, amber for warning/attention, red for destructive/error.
- Avoid large gradients, decorative orbs, illustration-heavy screens, and oversized landing content.

### 9.1 Global Theme Tokens

Theme source:

```text
app/globals.css
```

Important CSS variables:

```css
--background: oklch(0.981 0.006 242);
--foreground: oklch(0.245 0.035 247);
--card: oklch(1 0 0);
--primary: oklch(0.56 0.18 251);
--primary-foreground: oklch(0.99 0.004 242);
--secondary: oklch(0.953 0.018 242);
--muted: oklch(0.964 0.01 242);
--muted-foreground: oklch(0.47 0.035 247);
--accent: oklch(0.932 0.032 239);
--destructive: oklch(0.64 0.2 25);
--border: oklch(0.895 0.018 242);
--input: oklch(0.895 0.018 242);
--ring: oklch(0.56 0.18 251);
--radius: 0.5rem;
```

Use semantic tokens first:

- `bg-background`
- `text-foreground`
- `bg-card`
- `border-border`
- `bg-primary`
- `text-primary`
- `bg-accent`
- `text-muted-foreground`
- `text-destructive`

Use hard-coded colors only when matching an SAP/Fiori detail already established in the app.

### 9.2 Fiori Utility Classes

Defined in `app/globals.css`:

```css
.fiori-page
.fiori-shell-bar
.fiori-surface
.fiori-subtle
```

Meaning:

- `.fiori-page`: full-page workbench background. It uses a pale blue vertical gradient:

```text
#f7fbff -> #edf4fa
```

- `.fiori-shell-bar`: top shell/header surface. White, subtle bottom border, small shadow.
- `.fiori-surface`: primary panel/card surface. White with `#d9e6f2` border and a small shadow.
- `.fiori-subtle`: low-emphasis surface, usually for panel interiors or secondary UI.

These classes should be reused before adding new shell/surface styles.

### 9.3 Color Palette Usage

Core colors currently used in UI:

```text
Primary SAP blue:       token --primary, plus #0a6ed1 for builder edges
Primary foreground:     near-white via --primary-foreground
Page background:        #f7fbff / #edf4fa gradient
Panel border:           #d9e6f2
Secondary blue border:  #b8d6ef
Subtle panel fill:      #f5f9fd or bg-accent
Canvas grid line:       #eef5fb
Left join amber:        #b36b00
Success:                emerald-50 / emerald-950 / emerald-200
Warning:                amber-50 / amber-800 / amber-200
Error:                  destructive token / red-tinted panels
```

Usage rules:

- Primary blue is for main calls to action, selected navigation, active badges, icons, links, and inner join lines.
- Pale blue backgrounds are for shell/panel separation, not for large visual decoration.
- White is the default panel and data-table background.
- Error states must be visible in both Messages and toast/dialog surfaces.
- Warning states use amber and should not be confused with destructive failures.
- Success states use green only for completed operations and successful auth/query execution.

Avoid:

- Introducing purple, beige, dark navy, or large one-hue gradients.
- Adding unrelated brand colors.
- Using red for non-error emphasis.
- Using blue backgrounds for every panel; keep enough white space for scanning.

### 9.4 Layout Philosophy

The workbench layout is intentionally similar to database tools:

```text
Header / shell bar
Object Explorer | Query editor / Builder
                | Results
                | Messages
```

Files:

- `components/workbench/workbench-dashboard.tsx`
- `components/workbench/query-workbench.tsx`
- `components/workbench/results-table.tsx`
- `components/workbench/activity-feed.tsx`
- `components/workbench/entity-browser.tsx`

Layout rules:

- Header stays compact and functional.
- Object Explorer is a left sidebar for entity discovery and preview actions.
- Query panel is the primary work area.
- Results and Messages are lower work areas, not secondary pages.
- Panels are resizable where useful.
- Page sections should be unframed or single framed surfaces; do not nest cards inside cards.
- Keep button bars close to the panel they control.
- Avoid explanatory text blocks inside the workbench; the UI should be self-explanatory through labels, icons, tooltips, and state.

### 9.5 Component Density And Spacing

This app uses compact enterprise spacing.

Common sizing:

- Toolbar buttons: `h-8` default, `h-7` for dense panel actions.
- Icon buttons: `size-8`, `size-7`, or `size-6` for compact table/action rows.
- Inputs/selects: usually `h-8`; builder join/filter controls use `h-7`.
- Main panel radius: around `0.5rem` / `rounded-md` to `rounded-lg`.
- Borders: use `border-border` or Fiori border `#d9e6f2`.

Rules:

- Use `Button`, `Input`, `Select`, `Badge`, `Card`, `Tooltip`, `Dialog`, `Toast` from `components/ui`.
- Use lucide icons inside buttons when an icon exists.
- Prefer icon buttons for common tool actions:
  - close
  - expand/fullscreen
  - download
  - page navigation
  - delete
  - refresh/reset
- Use text buttons for commands where the label prevents ambiguity:
  - Execute
  - Apply SQL
  - Format
  - Download
  - Sign in
- Keep cards at small radius. Do not use large pill/card marketing styles in the workbench.

### 9.6 Typography

Fonts:

- Sans: Geist Sans via `app/layout.tsx` and `app/globals.css`.
- Mono: Geist Mono/Monaco-style rendering for SQL, raw payloads, debug text.

Typography hierarchy:

- Workbench shell: small, dense, usually `text-sm`.
- Panel titles: `text-base` or `text-sm font-semibold`.
- Table headers: `text-xs font-semibold`.
- Muted metadata: `text-xs text-muted-foreground`.
- SQL/debug payloads: `font-mono text-xs` or Monaco editor.

Avoid:

- Hero-scale headings in app panels.
- Negative letter spacing.
- Viewport-scaled font sizes.
- Long explanatory paragraphs inside operational UI.

### 9.7 Login And Home UI

Files:

- `app/page.tsx`
- `app/login/page.tsx`

Design intent:

- Production entry screens should be minimal and direct.
- Home page should route user toward login/workbench, not sell features.
- Login should focus on Client, Username, Password.
- Use shadcn dialog/toast feedback rather than browser alerts.

Color/style:

- White login card/surface.
- Thin primary top accent line.
- Primary button for Sign in.
- Muted text for supporting labels.

Do not reintroduce:

- Big marketing hero copy.
- Feature advertisement blocks.
- Stock imagery or decorative graphics.

### 9.8 Workbench Header And Navigation

Header uses the Fiori shell concept:

- White/near-white surface.
- Subtle blue-gray border.
- App badge in primary blue.
- Current entity/page summary as small text.
- Panel toggle buttons with primary blue icons/text.
- User profile menu on the right.

Selected panel toggle:

- `border-primary/35`
- `bg-accent`
- `text-primary`

Inactive panel toggle:

- white background
- `#b8d6ef` border
- `text-primary`
- hover `bg-accent`

### 9.9 Object Explorer

File:

```text
components/workbench/entity-browser.tsx
```

Purpose:

- Show backend-allowed objects from `SearchTables`.
- Support preview.
- Support drag into Visual Builder.

Visual rules:

- Entity rows are compact and clickable.
- Selected row uses `bg-accent`.
- Row border is transparent until hover/selected.
- Technical object name is primary text.
- Object type and Preview button are secondary controls.
- Drag cursor appears only where drag is supported.

Do not:

- Add heavy cards for each entity.
- Add large descriptions into the main list; keep details in selected entity footer.

### 9.10 Query Panel And SQL Editor

Files:

- `components/workbench/query-workbench.tsx`
- `components/workbench/sql-editor.tsx`

Design:

- Query toolbar at top.
- `SQL` and `Builder` tabs use line variant.
- Editor must fill available space and not be wrapped in decorative cards.
- Format/Execute actions stay in the same toolbar as query controls.

Color:

- Toolbar background: `#f7fbff`.
- Primary badge for current query.
- Execute button: primary.
- Format button: outline with primary icon/text.

Editor notes:

- Monaco handles its own code colors.
- Keep surrounding chrome light and minimal so code remains the focus.
- Validation should show inside editor markers and Messages, not with blocking browser alerts.

### 9.11 Visual Query Builder UI

File:

```text
components/workbench/visual-query-builder.tsx
```

Canvas:

- White/pale background with grid lines:

```text
#eef5fb
```

- Empty state: dashed border with `#b8d6ef`.
- Table nodes: white cards, border `#b8d6ef`, light shadow.
- Node header: `#f7fbff`.
- Drag handle: grip icon only.

Join lines:

- `INNER JOIN`: blue solid line `#0a6ed1`.
- `LEFT OUTER JOIN`: amber dashed line `#b36b00`.
- Line label: small white badge over edge.
- Only draw line when join fields are metadata-valid.

Field chips:

- Selected field chip:
  - `border-primary`
  - `bg-[#e5f2ff]`
  - `text-primary`
- Unselected chip:
  - white
  - border token
  - muted text
  - hover primary border/text

Validation:

- Invalid alias input: destructive border/ring.
- Invalid join/filter: amber hint box.
- Apply SQL blocked by toast when model is incomplete.

Important behavior:

- Joined queries must select explicit fields.
- `MANDT` is hidden/blocked for join and filter conditions.
- Builder generates SQL only; it does not execute automatically.

### 9.12 Results Table

File:

```text
components/workbench/results-table.tsx
```

Design:

- Table is dense and scan-friendly.
- Header row uses `bg-accent` and primary text.
- Row number column is sticky left.
- Cells truncate long values.
- Hover row background uses `bg-accent/40`.
- Empty state uses dashed blue border and subtle accent fill.

Actions:

- SAP responses button: outline/primary, disabled when no debug responses.
- Search input: compact, right-side toolbar.
- Fullscreen icon button.
- Download dropdown with Excel and CSV.
- Close/hide button muted until hover.

Fullscreen:

- Modal overlay is `bg-black/40`.
- Content is white with border and shadow.
- Keeps debug/stat panels compact.

### 9.13 Messages And Status Colors

Files:

- `components/workbench/activity-feed.tsx`
- `components/ui/toast.tsx`

Tone mapping:

```text
success -> green / emerald
info    -> blue / neutral
warning -> amber
error   -> red / destructive
```

Rules:

- Error messages should include backend/SAP text when available.
- Messages panel is the source of truth for query errors.
- Toasts are for short action feedback only.
- Do not show repeated native alerts.
- Do not show credential prompts after SAP session expires; redirect/re-auth through app flow.

### 9.14 Accessibility And Interaction

Maintain:

- Visible focus rings through `focus-visible:ring`.
- Buttons with `aria-label` when icon-only.
- Dialog overlays for modal interactions.
- Tooltips for unfamiliar icon-only actions.
- Keyboard-operable form controls.
- No text overlap in compact panels.

Important examples:

- Object delete button must remain clickable; drag starts only from grip.
- Fullscreen and close buttons need clear `aria-label`.
- Inputs/selects should use labels or accessible names where practical.

### 9.15 Responsive Behavior

Current target is desktop-first because this is a developer workbench.

Still maintain:

- Panels should not overflow horizontally in a way that hides primary controls.
- Header wraps controls when needed.
- Builder side panel moves under/next to canvas based on width.
- Results table can scroll horizontally.
- Text inside buttons should not clip.

Avoid:

- Mobile landing-page style layouts for the workbench.
- Large vertical spacing that reduces visible rows/editor space.

### 9.16 How To Safely Change UI Later

Recommended flow:

1. Change semantic tokens in `app/globals.css` first when changing theme.
2. Reuse `.fiori-*` utility classes for page/shell/surfaces.
3. Prefer editing local UI primitives before repeating class strings everywhere.
4. Keep panel-level changes local to the specific workbench component.
5. Run:

```bash
npm run lint
./node_modules/.bin/tsc --noEmit
```

6. Visually verify:
   - `/login`
   - `/workbench`
   - SQL tab
   - Builder tab
   - Results with data
   - Messages with error and success states

## 10. Client State And Data Flow

Main hook:

```text
hooks/use-workbench.ts
```

Responsibilities:

- Load initial snapshot using `SearchTables`.
- Manage selected entity, current SQL text, panel states.
- Execute query and preview calls.
- Maintain result columns/rows/page info.
- Cache result pages by query/source/page.
- Prefetch next page when possible.
- Push messages to activity panel.
- Track login/session-required state.

Result caching:

- Cache key for preview:

```text
preview:<entity>
```

- Cache key for query:

```text
query:<trimmed SQL>
```

- Page key:

```text
<cacheKey>:<page>
```

Cache is cleared when:

- selected entity changes
- query text changes
- template changes
- new result context replaces old context

## 11. Existing And Legacy Mechanisms

This project evolved from a simpler OData table-preview workbench into the current SQL result-cache model. Some mechanisms remain for compatibility, fallback, or diagnostics. These are important during handover because removing them casually can break local development or older backend responses.

### 11.1 Demo Snapshot Fallback

File:

```text
services/workbenchService.ts
```

There are hardcoded demo entities, templates, rows, and activity entries near the top of the file.

Purpose:

- Allow the UI to render a usable fallback when live SAP metadata cannot be loaded.
- Support early development and some mocked test paths.
- Keep the app from showing a blank workbench if `SearchTables` fails.

Current behavior:

- The preferred path is live `SearchTables`.
- Demo data should not be treated as production source of truth.

Handover warning:

- Do not delete demo fallback until tests and UX explicitly handle live metadata failure.
- If removing it, replace it with a clear empty/error state and update E2E mocks.

### 11.2 Old Direct OData Collection Path

File:

```text
services/sapClient.ts
```

The client has helpers such as:

```ts
fetchCollection<T>()
formatODataResults()
```

These support regular OData V2 collection responses:

```json
{
  "d": {
    "results": []
  }
}
```

This is still used by:

- `SearchTables`
- `GetFields`
- possibly metadata-like list endpoints

It should not be used for `RunQuery` result rows anymore, because current result rows are loaded through:

```text
RunQuery -> SqlwbColumnSet -> SqlwbPageChunkSet
```

### 11.3 Old `RowsJson` / `Csv` Result Shape

Types still include:

```ts
RowsJson?: string | null;
Csv?: string | null;
```

File:

```text
types/sap.ts
```

Why still present:

- Earlier backend versions returned rows directly in `RunQuery`.
- Keeping the fields is harmless for compatibility and parsing diagnostics.

Current preferred shape:

- `RunQuery` returns metadata and `ResultId`.
- `SqlwbPageChunkSet` returns `PayloadPart` chunks.

Handover warning:

- Do not rewire frontend back to direct `RowsJson` unless backend contract changes.
- If backend returns `RowsJson` again, handle it as a compatibility layer, not as the primary path.

### 11.4 JSON Repair Path

Files:

```text
services/sapClient.ts
services/workbenchService.ts
lib/sapParser.ts
```

The app uses `jsonrepair` in a few places.

Why:

- SAP/proxy/dev-server interruptions previously produced partial JSON.
- Chunked payloads can be incomplete during progress handling.
- `jsonrepair` can recover some partial arrays for intermediate UI feedback.

Rules:

- `jsonrepair` is a diagnostic/fallback safety net.
- It should not hide real backend truncation bugs.
- If final payload requires repair often, investigate `SqlwbPageChunkSet`, proxy byte headers, and SAP response size.

### 11.5 Result Chunk Loading

Current result flow:

```text
RunQuery or PreviewTable
  -> ResultId
  -> SqlwbColumnSet pages
  -> SqlwbPageChunkSet pages/chunks
  -> join PayloadPart by ChunkNo
  -> JSON.parse rows
```

Why chunking exists:

- Large result pages can exceed comfortable OData response sizes.
- SAP Gateway V2 responses include verbose `__metadata`.
- Splitting rows into chunks avoids waiting for one huge `RowsJson` field.

Important functions:

- `loadResultColumns`
- `loadResultRows`
- `loadPageChunkBatch`
- `joinChunkPayloads`
- `parseRowsJson`
- `parsePartialRowsJson`

Behavior:

- Column batches use `$top`/`$skip`.
- Page chunk batches use `$top`/`$skip`.
- Chunks are sorted by `ChunkNo`.
- `PageNo` is filtered as a string:

```text
PageNo eq '1'
```

Do not change this to:

```text
PageNo eq 1
```

because current backend metadata has `PageNo` as string.

### 11.6 Client Result Cache

File:

```text
hooks/use-workbench.ts
```

The hook caches page results after execution.

Why:

- Moving from page 1 to page 2 and back should not always call SAP again.
- Columns can be reused after the first page to avoid reloading `SqlwbColumnSet`.

Cache stores:

- rows
- debug responses
- page info
- result context
- columns

Important limitation:

- Cache is in-memory only.
- Refreshing the browser clears it.
- Changing query text clears it.

### 11.7 Open SQL Parser/Validator Is Client-Side Advisory

Files:

```text
lib/openSqlValidation.ts
components/workbench/sql-editor.tsx
```

The editor validator is for user feedback only. The backend parser is the authority.

Known mismatch risk:

- The editor may know keywords such as `TOP` or `UP TO`.
- Current backend rejects both.

Handover action:

- Keep test cases aligned with backend behavior.
- When backend grammar changes, update:
  - `tests/sql-workbench-all.spec.ts`
  - `lib/openSqlValidation.ts`
  - Monaco suggestions in `sql-editor.tsx`
  - Visual Builder generation if relevant

### 11.8 Visual Builder Heuristics Are Not Real Relationships

File:

```text
components/workbench/visual-query-builder.tsx
```

The builder suggests joins by:

- exact same field name
- key fields
- preferred common field names such as `CARRID`, `CONNID`, `PLANETYPE`
- suffix matches

This is not equivalent to SAP DDIC foreign keys.

Blocked field:

```text
MANDT
```

Reason:

- Backend/Open SQL rejects explicit `MANDT` in `ON`.
- Client handling is performed by SAP.

Future better design:

- Add backend endpoint for relationships/foreign keys.
- Replace heuristics with relationship metadata.

### 11.9 Why Save Query Was Removed

The UI previously experimented with saved-query behavior, but it was removed because there is no real backend API yet.

Current state:

- No saved query API route.
- No persisted query list.
- No local file storage for saved queries.

Before adding it back:

- Define backend contract.
- Add auth ownership model.
- Decide user-private vs shared queries.
- Add tests.

## 12. Tests

### 12.1 Mocked E2E

File:

```text
tests/e2e/workbench.spec.ts
```

Purpose:

- Validate login UI.
- Validate workbench route loads.
- Mock `/api/auth/*` and `/api/sap/*`.
- Verify query execution renders rows and messages.

Run:

```bash
npm run test:e2e -- tests/e2e/workbench.spec.ts
```

### 12.2 Live SAP UI/Backend Test

File:

```text
tests/sql-workbench-all.spec.ts
```

Purpose:

- Uses real UI to login and execute real backend queries.
- Covers select, projections, filters, LIKE, ORDER BY, JOIN, blocked operations, syntax errors.
- Skips automatically if SAP credentials are missing.

Run headed:

```bash
E2E_SAP_CLIENT=324 \
E2E_SAP_USERNAME=<user> \
E2E_SAP_PASSWORD=<password> \
npx playwright test tests/sql-workbench-all.spec.ts --headed
```

Run default:

```bash
npm run test:e2e -- tests/sql-workbench-all.spec.ts
```

Useful when port 3000 is busy:

```bash
PLAYWRIGHT_PORT=3100 npm run test:e2e -- tests/e2e/workbench.spec.ts
```

Ignored artifacts:

- `test-results/`
- `playwright-report/`

### 12.3 Static Checks

```bash
npm run lint
./node_modules/.bin/tsc --noEmit
```

## 13. Deployment Notes

Typical deployment target:

- Vercel or any Node-compatible Next.js host.

Required deployment env vars:

```bash
SAP_BASE_URL=https://<sap-host>:<port>/sap
SAP_CLIENT=324
NEXT_PUBLIC_SQLWB_PROFILE_ID=DEV
```

Important production notes:

- `OSWB_SAP_COOKIE` is httpOnly and `secure` is enabled when request is HTTPS.
- Ensure SAP host is reachable from deployment runtime, not only from local browser.
- If deployed app can login but cannot query, inspect:
  - `/api/auth/check-session`
  - `/api/sap/...` response status
  - whether `OSWB_SAP_COOKIE` exists
  - whether `sap-client` is forwarded

## 14. Operational Troubleshooting

### 14.1 Login succeeds but session check fails

Check:

- Browser cookies contain `OSWB_SAP_COOKIE`.
- Client is correct in `OSWB_SAP_CLIENT`.
- `SAP_BASE_URL` points to a valid SAP base path.
- `$metadata` can be called with stored cookie.

### 14.2 Browser native auth popup appears

Cause:

- SAP 401 with `www-authenticate` leaked to browser.

Fix/check:

- Proxy must strip `www-authenticate`.
- Login errors should be shown in app dialog/toast, not browser alert.

### 14.3 Query returns SAP XML/JSON error

Inspect:

- Messages panel.
- SAP responses debug button in Results.
- Network response from `/api/sap/...`.

Common backend constraints:

- No `TOP`.
- No `UP TO n ROWS`.
- No `SELECT *` in join.
- No `MANDT` in join `ON`.

### 14.4 Results page navigation feels slow

Check:

- `hooks/use-workbench.ts` cache is active.
- Existing result context is not reset by query text/entity changes.
- Columns are reused via `reuseColumns`.
- Next page prefetch is not failing silently.

### 14.5 JSON parse or truncated payload errors

Check:

- `SqlwbPageChunkSet` response chunks.
- `PayloadPart`, `ChunkNo`, `IsLastChunk`.
- Proxy byte headers:
  - `x-oswb-upstream-content-length`
  - `x-oswb-proxy-bytes`
- `jsonrepair` can recover some partial payloads but should not be the primary fix.

## 15. Current Known Limitations

- Query save/share UI was removed because no real backend API exists yet.
- Visual Builder is client-side SQL generation only; it does not persist models.
- `TOP` and `UP TO n ROWS` are not supported by current backend and are treated as syntax errors in live tests.
- Join builder validates metadata fields, but does not know all semantic foreign-key relationships beyond heuristic matching.
- Activity feed uses in-memory state; it is not a persistent audit log yet.
- Some demo fallback data remains in `workbenchService.ts` for non-live/fallback behavior.

## 16. Suggested Next Work

1. Backend saved-query API:
   - save query
   - list user queries
   - update/delete
   - share/broadcast

2. Backend relationship metadata:
   - expose foreign key/association hints
   - replace visual builder heuristic joins with backend relationship graph

3. Stronger SQL contract:
   - document allowed grammar
   - align editor validation with backend parser
   - remove unsupported snippets from suggestions if backend stays strict

4. Persistent audit logging:
   - user
   - client
   - SQL text
   - execution status
   - duration
   - ResultId

5. CI pipeline:
   - run lint/typecheck
   - run mocked Playwright tests
   - keep live SAP tests manual or protected by secrets

## 17. Quick Start For New Developer

1. Install dependencies:

```bash
npm install
```

2. Create local env:

```bash
SAP_BASE_URL=https://<sap-host>:<port>/sap
SAP_CLIENT=324
NEXT_PUBLIC_SQLWB_PROFILE_ID=DEV
```

3. Start app:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000/login
```

5. Login with SAP client/user/password.

6. Go to Workbench and run:

```sql
SELECT * FROM SCARR
```

7. For join testing, use explicit fields:

```sql
SELECT a~carrid, a~carrname, b~connid, b~cityfrom, b~cityto
FROM scarr AS a
INNER JOIN spfli AS b
ON a~carrid = b~carrid
```

8. Run local checks before handoff:

```bash
npm run lint
./node_modules/.bin/tsc --noEmit
npm run test:e2e -- tests/e2e/workbench.spec.ts
```

## 18. Important Files To Review First

For frontend UI:

- `components/workbench/workbench-dashboard.tsx`
- `components/workbench/query-workbench.tsx`
- `components/workbench/sql-editor.tsx`
- `components/workbench/results-table.tsx`
- `components/workbench/visual-query-builder.tsx`

For SAP integration:

- `app/api/sap/[...path]/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/check-session/route.ts`
- `app/api/auth/logout/route.ts`
- `services/sapClient.ts`
- `services/workbenchService.ts`
- `services/sqlAssistService.ts`

For parser/validation:

- `lib/sapParser.ts`
- `lib/openSqlValidation.ts`
- `lib/openSqlFormatter.ts`

For tests:

- `playwright.config.ts`
- `tests/e2e/workbench.spec.ts`
- `tests/sql-workbench-all.spec.ts`
