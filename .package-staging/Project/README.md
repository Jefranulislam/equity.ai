# Equity.AI — AI-powered ERP & Accounting for SMBs

Equity.AI is an AI-assisted cloud ERP and accounting platform for small and medium businesses.
It unifies the full commercial cycle — **quotes → invoices → payments → credit notes**, **purchase orders → bills → vendor payments**, **multi-location inventory**, **expenses**, **real double-entry accounting**, **financial reporting**, and a **tax compliance workbench** — in one live, multi-workspace ledger.

The differentiator is **Freya**, a built-in AI finance analyst grounded in your live data: it answers questions like *"What's my net profit YTD?"* or *"Which products are running low?"* by calling real data tools against your own ledger — with every step visible and auditable.

**Who it's for:** owners, accountants, bookkeepers, and small finance teams at trading, services, retail/wholesale, and light-manufacturing businesses — including multi-entity owners who run several companies from one login.

---

## Feature list

| Area | Capabilities |
|---|---|
| **Sell & get paid (AR)** | Quotes (line items + tax) with one-click convert → invoice; invoices with automatic numbering and branded printable PDF; payments in 6 methods with auto-apply across invoices; credit notes |
| **Buy & pay vendors (AP)** | Purchase orders with convert → bill; vendor bills; vendor payments; vendor directory |
| **Inventory** | Products (SKU, unit, cost/sale price, tax, track toggle); stock by location; movement audit trail (receipt, issue, adjustment, transfers in/out) |
| **Accounting** | True double-entry ledger: chart of accounts, journal entries, trial balance; invoices auto-post (DR AR / CR Revenue / CR Tax Payable) via DB triggers |
| **Financial reporting** | Profit & Loss, Balance Sheet, Cash Flow; period selector (month/QTD/YTD/last year); CSV export; sales analytics (top customers, top items, trends) |
| **Expenses** | Categorized expenses with vendor, payment method, and tax |
| **Tax compliance** | Output vs. input tax, net liability, missing-tax-ID warnings, filing-ready sales/purchase registers with CSV export; per-workspace tax regime (IN-GST, AE-VAT, US-GAAP, …) |
| **Freya AI analyst (beta)** | Natural-language chat grounded in live data via inspectable tool calls (`financial_summary`, `recent_invoices`, `recent_bills`, `inventory_snapshot`, `tax_summary`) |
| **Teams & multi-workspace** | Roles owner/admin/accountant/sales/inventory/viewer enforced by database RLS; workspace switcher; every signup gets its own isolated workspace |
| **Productivity** | ⌘K command palette with live search across invoices/customers/vendors/products; dashboard KPIs; multi-currency (13 currencies) with FX rates |
| **Free document tools** | 10 no-login invoice/document generators (GST & VAT ready, 8 templates, PDF download) — lead-generation suite |

## Screenshots

Add PNG files to `docs/screenshots/` (see names below). Also live: use the working demo URL.

| File | Shows |
|---|---|
| `docs/screenshots/dashboard.png` | Dashboard KPIs + 12-month invoice chart |
| `docs/screenshots/invoice.png` | Invoice editor + printable PDF view |
| `docs/screenshots/reporting.png` | P&L / Balance Sheet / Cash Flow |
| `docs/screenshots/ai-agent.png` | Freya AI chat with visible tool-call traces |
| `docs/screenshots/tools.png` | Free document tools (invoice generator) |

## Tech stack

- **Frontend:** React 19 + TypeScript, TanStack Start (SSR), TanStack Router + Query, Tailwind CSS v4, shadcn/Radix UI
- **Backend:** TanStack Start server functions + server routes, deployed to Cloudflare Workers (edge)
- **Database:** Supabase (PostgreSQL) with row-level security, triggers, and generated document numbering
- **Auth:** Supabase Auth (email/password) with automatic workspace provisioning on signup
- **AI:** Vercel AI SDK with an OpenAI-compatible gateway (default: Lovable AI Gateway / Google Gemini 2.5 Flash)

## Security model

- Every table is multi-tenant scoped by `organization_id` and protected by **Postgres row-level security** (`is_org_member()` / `has_org_role()` helpers — SECURITY DEFINER, revoked from `anon`).
- All app reads/writes use the signed-in user's JWT, so the database — not the UI — is what enforces roles and cross-tenant isolation.
- The only elevated (service-role) operations run server-side: email lookup for team invitations, workspace provisioning on signup, and the AI chat route (which validates the JWT *and* workspace membership before querying, and only touches rows explicitly scoped to the member's workspace).
- See `docs/API.md` for the full endpoint inventory and authorization notes.

## Repository layout

```
├── src/                  Application source (routes, components, lib, integrations)
├── supabase/migrations/  Ordered SQL migrations (source of truth for the schema)
├── database/             schema.sql (install from scratch) + seed.sql (demo data)
├── docs/                 API reference, screenshots
├── HowToSetup.md         Step-by-step install (Supabase + VPS/Docker/Cloudflare)
├── docker-compose.yml    Container install path (with Dockerfile + .dockerignore)
├── CLAUDE.md             Guide for AI coding tools
├── CHANGELOG.md          Version history
├── LICENSE-NOTE.md       Licensing terms
└── .env.example          Configuration template (placeholders only)
```

## Licence note

See `LICENSE-NOTE.md` (single-buyer commercial licence; ownership of rights is stated there).
