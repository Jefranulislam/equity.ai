# Changelog

All notable changes to Equity.AI. Format: [Keep a Changelog](https://keepachangelog.com); versions: [SemVer](https://semver.org).

Dates are approximate build dates reconstructed from the migration log; adjust on release.

## [1.0.6] — 2026-11-20 · Submission V1.0.6 (review fixes)

Package: `Equity.AI.Submission.V1.0.6.zip`. From this release on, the version in `package.json` matches the submission package name. The 1.1.x headings below were internal build labels used before submissions were versioned.

### Security
- **Closed a workspace self-join hole:** the `organization_members` INSERT policy allowed any signed-in user to add themselves to any workspace. Self-insert is now limited to workspaces the user created (onboarding). Migration `20261120000000_harden_member_self_insert.sql`.
- Client deletes, updates and by-id lookups now also filter by `organization_id` (customers, vendors, bills, expenses, products, payments, invoices, quotes, purchase orders, journal entries, members), on top of RLS.
- Invoice detail loads invoice, lines and payment links scoped to the current workspace.
- `POST /api/demo` is fail-closed in every environment: 404 unless `DEMO_ENABLED=true` and a `DEMO_SETUP_TOKEN` of at least 16 characters are set; the token is compared in constant time. The demo password has no fallback value.
- Settings → Workspace is read-only for roles other than owner/admin (matching the `org_update_admins` RLS policy). New `useOrgRole()` hook for UI gating.
- The role matrix enforced by RLS is now documented in `HowToSetup.md` under "Security model".

### Fixed
- **Quotes failed to load:** `quotes`, `credit_notes`, `purchase_orders` and `bill_payments` had no foreign keys, so PostgREST embeds (`customer:customers(...)`) returned PGRST200. Lists now join lookups in the client (`src/lib/relations.ts`), and migration `20261105000000_add_missing_sales_document_fks.sql` adds the constraints.
- **Team members list:** `organization_members` has no FK to `profiles`, and profiles were readable only by their owner, so Members and Settings → Team failed to show teammates. Profiles are now joined in the client and readable by users who share a workspace (migration `20261120000002_profiles_visible_to_teammates.sql`).
- **Create Invoice button** in the top bar appears only on the Invoices screens.
- **Responsive top bar search:** full field on tablet/desktop, icon on mobile, both open the command palette.
- **Deep links on Vercel** (`/login`, `/dashboard`, …) returned 404; `vercel.json` adds the SPA rewrite.
- Onboarding read the `create_workspace` RPC result as an object although it returns a table (array).
- `types.ts` now declares the `create_workspace` and `invite_member` RPCs and the `account_balances` view (typecheck is clean).
- Demo email in docs and `.env.example` corrected to `demo@equity.ai`.

### Changed
- Sidebar becomes a slide-out drawer below desktop width; closes on navigation, backdrop tap or Esc. Page padding scales with screen size; wide tables scroll inside their card.
- **Accounting:** trial balance and P&L come from the new `account_balances` view (`security_invoker`, RLS still applies; migration `20261120000001_account_balances_view.sql`). The journal list loads the latest 200 entries instead of the whole ledger.
- **Shared helpers instead of per-route copies:** `lib/status-styles.ts` (status badge colours), `lib/relations.ts` (lookup join), `lib/kpis.ts` (dashboard KPI aggregation as a pure function), `todayISO`/`firstOfMonthISO` in `lib/format.ts`.
- `database/schema.sql` is generated from the migrations by `bun run db:schema`; `bun run db:schema:check` fails when it is stale, and `pack-zip.ps1` runs it before packaging.

### Build & tooling
- Bun is the only supported package manager: `packageManager: bun@1.3.14`, `engines`, `bun install --frozen-lockfile` everywhere (Docker, Vercel, docs). Docker base image pinned to `oven/bun:1.3.14`.
- Unit tests added (`tests/lib.test.ts`, 5 tests): run with `bun test`.
- **Dependency audit:** `bun audit` (Bun 1.3.14, 2026-11-20) reports **No vulnerabilities found**. Re-run with `bun run audit`.
- `HowToSetup.md`: runtime version table, primary deployment target, full environment-variable table (incl. `DEMO_SETUP_TOKEN`), one database path per situation, upgrade steps, and the demo setup marked optional after DB and server start.
- The submission archive no longer contains `.claude/settings.local.json` or the `screenshots/` scratch folder; curated screenshots ship in `docs/screenshots/`.

## [1.1.1] — 2026-10 · Static-deployment compatibility

### Fixed
- **Static hosting (Hostinger / Vercel static):** onboarding creates the workspace through a new security-definer RPC `create_workspace` (falling back to direct RLS inserts on older databases), so buyers can sign up and provision a workspace without server functions. Team invites use the same RPC pattern (`invite_member`) as a static-host fallback.
- Freya now reports clearly when AI chat is unavailable on a static host instead of failing silently.
- Resolved merge-conflict markers in `package.json` that broke `npm install` on CI (Hostinger build logs).

### Changed
- Default `npm run build` produces a static SPA distribution (`dist/` with `index.html` + `.htaccess` deep-link rewriting); the SSR/Cloudflare Workers bundle moved to `npm run build:worker`.

## [1.1.0] — 2026-06 · Finance & intelligence

### Added
- **Freya, AI finance analyst (beta):** streaming chat grounded in live workspace data via tool calling (`financial_summary`, `recent_invoices`, `recent_bills`, `inventory_snapshot`, `tax_summary`) with fully inspectable tool-call traces.
- **Compliance module:** output vs. input tax, net liability, missing-tax-ID warnings; filing-ready sales & purchase registers with CSV export.
- **Financial statements:** Profit & Loss, Balance Sheet, Cash Flow with period selector (this/last month, QTD, YTD, last year) and CSV export.
- **Sales analytics:** collected vs. outstanding revenue, active customers, average invoice value, monthly revenue trend, top customers, top line items.
- **Configurable AI provider:** Freya supports any OpenAI-compatible endpoint (`AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL`) plus per-user OpenRouter keys (Settings → AI).

## [1.0.0] — 2026-05 · Full commercial cycle

### Added
- Quotes with line items and taxes; one-click **quote → invoice** conversion; annual auto-numbering sequences for Q-2026-####, PO-, CN- documents.
- **Invoicing:** line items + per-line tax, statuses (draft/sent/partial/paid/void), branded printable PDF view, void & delete; totals and paid balance recomputed by database triggers.
- **Payments:** six methods (cash, bank transfer, card, UPI, cheque, other); auto-apply to open invoices, including across multiple invoices; invoice status updates automatically on payment.
- **Credit notes:** linked to an invoice or standalone, numbering and statuses (draft/issued/applied/void).
- **Purchase orders** with PO → bill conversion on receipt; **vendor bills** (with "their invoice #" reference) and **vendor payments** applied to open bills.
- **Multi-location inventory:** products (SKU, unit, cost/sale price, tax, track-inventory toggle), stock by location, and a full movement ledger (receipt, issue, adjustment, transfer in/out) enforced by trigger.
- **Double-entry accounting:** chart of accounts (asset/liability/equity/income/expense), journal entries with balance enforcement, trial balance; **invoices auto-post AR/Revenue/Tax-Payable entries via trigger**.
- **Expenses** with seeded categories, vendors, payment methods, and tax.
- **Multi-workspace (organizations):** workspace switcher, per-workspace country, base currency and tax regime; automatic workspace + default location + chart of accounts + expense categories provisioning on signup.
- **Security & roles:** database RLS on every table with `is_org_member()`/`has_org_role()`; roles owner/admin/accountant/sales/inventory/viewer; JWT-authenticated server functions; attachments storage bucket with per-user folder policies.
- **Multi-currency** (13 currencies) with an FX-rate table.
- **Productivity:** ⌘K command palette with live search across invoices/customers/vendors/products; dashboard KPIs (revenue YTD, receivables + overdue, payables, expenses YTD, 12-month invoice chart).
- **Country onboarding presets:** US, UK, DE, FR, ES, IT, NL, India (IN-GST), UAE (AE-VAT), Singapore, Australia, Canada, Japan, Brazil.

## [Planned]

- Recurring invoices (schema-ready: `recurring_invoices` table with weekly/monthly/quarterly/yearly frequency).
- Team invitations by email with signed invite links.
- Freya graduating from beta (more data tools, scheduled insights).
- Additional tax-regime presets and interface localization.

[1.1.0]: #
[1.0.0]: #
