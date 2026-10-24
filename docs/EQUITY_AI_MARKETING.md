# Equity.AI — Marketing Materials (Master Document)

> **Product:** Equity.AI — AI-powered ERP & Accounting for small and medium businesses
> **Status:** Internal master reference. Sections marked ⚠️ contain placeholders (versions, dates) or claims that must be verified before publishing.
> **Last updated:** 2026-10-23

---

## 1. Positioning

### One-liner
> Equity.AI is the AI-powered operating system for your finance team — invoicing, accounting, inventory, expenses, and compliance, unified, real-time, and quietly intelligent.


Variant 1 — Full (generic fill-in style)
EQUITY is an AI-powered platform for finance teams to automate reporting, analysis, and tax compliance across invoicing, inventory, and double-entry accounting. Built with React 19 + TypeScript (TanStack Start, deployed to Cloudflare Workers), it includes a web app and a Supabase PostgreSQL database, integrating with Supabase Auth and the Lovable AI Gateway (Google Gemini 2.5 Flash) for its built-in finance analyst.
Variant 2 — Short (README / one-paragraph)
EQUITY is an AI-powered ERP & accounting platform for finance teams to automate reporting, analysis, and compliance. Built with React 19 + TypeScript, it includes a web app and a Supabase PostgreSQL database, integrating with Supabase Auth and a Gemini-powered AI analyst grounded in live business data.
Variant 3 — Marketing tone
EQUITY is an AI-powered platform for finance teams to automate reporting, run instant analysis, and stay compliant — turning quotes, invoices, and stock movements into live, filing-ready books. Built with a modern React + TypeScript stack, it includes a fast web app and a secure PostgreSQL database, integrating with AI so you can ask your own numbers questions in plain language.
Variant 4 — Technical / developer-oriented
EQUITY is an AI-powered platform for finance teams to automate financial reporting, live-data analysis, and multi-jurisdiction tax compliance (GST, VAT, and more). Built with TanStack Start + React 19 (SSR on Cloudflare Workers edge runtime), it includes a web app and a Supabase PostgreSQL database with row-level multi-tenant security, integrating with Supabase Auth, Vercel AI SDK tool-calling backed by the Lovable AI Gateway (Google Gemini 2.5 Flash), and an FX/multi-currency rate service.
Variant 5 — Product-hunt / launch blurb
EQUITY is an AI-powered platform for finance teams to automate reporting, analysis, and compliance — without spreadsheets or five disconnected tools. Built with React 19 + TypeScript, it includes a web app and a managed PostgreSQL database, integrating with Supabase and Google Gemini to power Freya, the AI finance analyst that answers "What's my profit?" from your real data.
Variant 6 — Investor / bank-facing (formal)
EQUITY is an AI-powered platform for finance teams to automate financial reporting, analytical insight, and statutory compliance. Built with a modern TypeScript web stack, it includes a production web application and a PostgreSQL-backed data layer, integrating with managed identity, storage, and AI inference services to deliver real-time accounting, multi-currency operations, and role-based governance for small and medium businesses.
Variant 7 — Ultra-short (App Store / directory listing, ~30 words)
EQUITY is an AI-powered platform for finance teams to automate reporting, analysis, and compliance. Built with React + TypeScript, it includes a web app and PostgreSQL database, integrating with Supabase and Gemini.



### Extended positioning statement
Small businesses run on 5–8 disconnected tools: one app for invoices, another for inventory, spreadsheets for books, another for tax, and a data analyst they can't afford. Equity.AI replaces all of them with one cloud workspace where every quote, invoice, bill, payment, stock movement, and journal entry lives in a single live ledger — with **Freya, an AI finance analyst grounded in your real data**, answering questions like *"What's my outstanding AR?"* or *"Which products are running low?"* in plain language.

### Tagline options (A/B test candidates)
1. "Run your whole business on one ledger." *(JTBD framing)*
2. "The AI-powered operating system for your finance team." *(current product tagline)*
3. "Your accountant. Your inventory. Your taxes. One place. One AI." *(rule of three framing)*
4. "Stop juggling tools. Start closing books." *(loss-aversion framing)*

---

## 2. What the application does (plain-language summary)

Equity.AI is a **multi-tenant cloud ERP + double-entry accounting platform**. Every signup gets its own secure workspace (organization) with its own currency, country, and tax regime.

The full commercial cycle, end to end:

- **Money in (AR):** Quotes → Invoices → Payments → Credit Notes, with auto-posted ledger entries.
- **Money out (AP):** Purchase Orders → Vendor Bills → Vendor Payments.
- **Stock:** Multi-location inventory with receipts, issues, adjustments, and transfers, linked to invoices and POs.
- **Books:** True double-entry accounting — chart of accounts, journal entries, trial balance.
- **Compliance:** Output vs. input tax, net liability, filing-ready registers and CSV exports, per tax regime (GST, VAT, and more).
- **Intelligence:** Freya, an AI finance analyst that queries your live data with transparent, inspectable tool calls.
- **Zero-friction acquisition:** A free, no-login suite of 10 business document tools (invoice & document generators) that funnels real business owners into the product.

---

## 3. The problem we solve — pain points by persona ✍️

*(Use these pain points as headline hooks, ad angles, and objection handlers.)*

| Persona / Role | Pain today | Equity.AI answer |
|---|---|---|
| **Owner / Founder** | "Is the business actually profitable?" — answers live in a spreadsheet an accountant updates monthly | Live dashboard: revenue YTD, receivables, payables, P&L — plus ask Freya anytime |
| **Accountant / Bookkeeper** | Reconciling invoices, bills, and tax registers across disconnected tools; re-keying data | One double-entry ledger; invoices auto-post to journal entries; trial balance & P&L derived from posted entries, never manual |
| **Sales / Ops** | Quotes get lost; converting quotes to invoices means re-typing | One-click quote → invoice conversion, consistent numbering (Q-2026-####, INV, PO, CN) |
| **Purchasing / Inventory** | Stock counts in spreadsheets; POs emailed as Word docs; bills keyed twice | PO → bill conversion on receipt; multi-location stock with full movement audit trail |
| **Tax / Compliance** | Filing panic: missing tax IDs, mismatched input/output tax, no clean register | Compliance workbench: output vs. input tax, net liability, missing-tax-ID warnings, filing-ready CSV registers |
| **Multi-entity owners** | Separate books per business entity, no shared visibility | Multi-workspace switcher — one login, several businesses, RLS-isolated data |

**Core emotional drivers to write against:** fear of tax penalties (loss aversion), fear of not knowing cash position (uncertainty), wasted hours on re-entry, and the embarrassment of presenting a messy spreadsheet to an investor or bank.

---

## 4. Target audience & industries

### Primary audience
- **SMBs with 1–50 employees** that issue professional documents and tax invoices: trading/distribution, professional services, retail & wholesale supply, freelancers & consultants, and light manufacturing/assembly.
- **Finance-first roles:** owners, accountants, bookkeepers, and small finance teams.
- **Multi-entity owners:** consultants or family groups running 2–5 companies needing one login for all books.

### Geographic / regulatory markets
- Broad international coverage with country onboarding presets: **US, UK, DE, FR, ES, IT, NL, India (IN-GST), UAE (AE-VAT), Singapore, Australia, Canada, Japan, Brazil.**
- **South Asia + Gulf emphasis:** GST/CGST/SGST/IGST invoicing with HSN/SAC support; 14+ currencies including **BDT, INR, AED, SAR, PKR, LKR, MYR**, plus USD, EUR, GBP, SGD, CAD, AUD.
- ⚠️ **Interface language is English-only today.** Do **not** market Arabic/Hindi/local-language support until shipped (14 *currencies* ≠ localized UI).

---

## 5. Feature catalog ("what we built")

### 5.1 Sell & Get Paid (Accounts Receivable)
- **Quotes:** create with line items and tax; one-click **convert to invoice**.
- **Invoices:** line items + tax, numbered automatically, statuses (draft, sent, partial, paid, void), printable branded PDF view.
- **Payments:** record customer payments by cash, bank transfer, card, UPI, cheque; apply to open invoices with **auto-apply**; supports applying across multiple invoices at once.
- **Credit Notes:** issue with numbering, optionally linked back to invoices (draft → issued → applied).
- **Customers:** directory with billing name, tax ID, address, email.

### 5.2 Buy & Pay Vendors (Accounts Payable)
- **Purchase Orders:** to vendors; convert to bill on receipt.
- **Bills:** vendor bills with "their invoice #" and vendor references.
- **Vendor Payments:** record and apply to open bills.
- **Vendors:** directory.

### 5.3 Inventory
- **Products:** SKU, unit, cost & sale price, tax rate, track-inventory toggle.
- **Stock by location:** multi-location (warehouse/shop) quantity tracking.
- **Movements:** receipts, issues, adjustments, transfers in/out — full audit trail.

### 5.4 Accounting (real double-entry, not a "tracker")
- **Chart of accounts:** asset / liability / equity / income / expense.
- **Journal entries & lines:** manual posting supported.
- **Auto-posting:** invoices automatically post ledger entries (DR Accounts Receivable, CR Revenue, CR Tax Payable) via database triggers — books stay current with zero effort.
- **Trial balance and P&L** derived from posted entries.

### 5.5 Financial Reporting
- **Profit & Loss, Balance Sheet, Cash Flow** statements.
- Period selector: this month, last month, QTD, YTD, last year.
- **CSV export** for every report.
- **Sales analytics:** collected revenue vs. outstanding, active customers, average invoice value, monthly revenue trend, top customers, top line items.

### 5.6 Expenses
- Categorized expenses with vendor, payment method, and tax — feeding the ledger and compliance module.

### 5.7 Tax Compliance
- Output tax vs. input tax, net liability calculation.
- **Missing-tax-ID warnings** before they become filing problems.
- Sales & purchase registers with **CSV export** for filing.
- Country/tax-regime stored per workspace (e.g., IN-GST, AE-VAT, US-GAAP).

### 5.8 Freya — AI Finance Analyst (Beta)
- Natural-language chat grounded in the company's **live ledger** — not generic AI: Freya calls real tools against your data (`financial_summary`, `recent_invoices`, `recent_bills`, `inventory_snapshot`, `tax_summary`).
- Example questions: *"What's my net profit YTD?" · "Who owes me money?" · "Which products are low on stock?" · "How much tax do I owe this quarter?"*
- **Transparent by design:** every tool call's input and output is visible and inspectable — you can audit what the AI looked at. *(Key differentiator vs. "black box" AI. Trust framing.)*

### 5.9 Teams, Roles & Multi-Workspace
- **Roles:** owner, admin, accountant, sales, inventory, viewer — enforced at the **database level** (Postgres row-level security), not just in the UI.
- **Team members:** add colleagues by email with a role.
- **Workspace switcher:** run multiple businesses from one login; every record is isolated per organization.
- Signup auto-creates a personal workspace — zero setup.

### 5.10 Everyday-productivity layer
- **⌘K command palette:** live search across invoices, customers, vendors, and products from anywhere.
- Dashboard KPIs: Revenue YTD, receivables (+ overdue count), payables, expenses YTD, 12-month invoice-volume chart.

### 5.11 Free Business Document Tools (acquisition funnel — "Popular")
No login, no signup, no card. Ten generators:
Invoice Generator (GST: CGST/SGST/IGST + HSN/SAC), Quotation, Proforma Invoice, Purchase Order, Delivery Challan, Commercial Invoice, Consulting Invoice, Invoice with VAT, Invoice Formats, Packing List.
- **8 visual templates** (Classic, Modern Blue, Minimalist, Elegant Dark, Green Corporate, Bold Orange, Purple Creative, Warm Paper).
- **13 currencies**, PDF download, discounts, amount-in-words, bank details.
- *(Marketing framing: "free forever" tools act as a genuine lead magnet — give value before asking anything.)*

### 5.12 Platform & security
- Multi-tenant by design with **row-level security** at the database layer.
- Multi-currency with internal FX rate table.
- Modern stack (React 19, TypeScript, serverless edge runtime, PostgreSQL) — fast, always-on, no local install.

---

## 6. USPs (Unique Selling Points) — "ups"

Write every channel around these five. Each is a claim + proof.

1. **One ledger, not five tools.** Quotes, invoices, payments, bills, stock, expenses, and books share one database — data is entered once and flows everywhere. *Proof: invoice → auto-posted journal entries via database triggers; PO → bill conversion; stock movements tied to documents.*

2. **Real double-entry accounting — with zero bookkeeping effort.** This is a genuine accounting system (chart of accounts, trial balance, P&L), where the paperwork you already do *becomes* the books. *Proof: P&L/Balance Sheet/Cash Flow generated from posted entries.*

3. **Freya: an AI analyst that shows its work.** Unlike chatbots that hallucinate, Freya grounds every answer in live data through visible, inspectable tool calls. *Proof: per-step tool-call traces in the chat UI.* *(Badge: Beta — keep the badge in all assets to stay honest.)*

4. **Compliance built into the workflow, not bolted on.** Tax regime per workspace, missing-tax-ID warnings *before* filing, filing-ready registers and CSV exports. *Proof: Compliance module with GST/VAT regimes and exports.*

5. **Enterprise-grade control at SMB prices-should-be.** Database-enforced roles (owner→viewer), multi-workspace isolation, multi-location inventory, 14 currencies, ⌘K speed — features usually reserved for ERPs costing 10× more. *(Anchoring against "legacy ERP" pricing.)*

**Supporting USP:** Free document tools with no login — the barrier to trying Equity.AI is zero. Use the tools, and they become your first step into the paid product. *(Zero-price effect: the free tier is the top of funnel.)*

---

## 7. Keywords & SEO

### Primary keywords
AI-powered ERP · AI accounting software for small business · cloud ERP for SMBs · double-entry accounting software · invoice and inventory software · GST invoice software · VAT accounting · small business financial dashboard

### Long-tail / intent keywords
- `free invoice generator with GST / HSN` *(free-tool funnel)*
- `free quotation maker online no signup`
- `proforma invoice generator free download PDF`
- `invoice software with automatic journal entries`
- `accounts receivable and payable in one app`
- `small business tax compliance checklist / output input tax calculator`
- `multi-location inventory tracking for small business`
- `AI finance assistant for my business data`
- `cheaper alternative to QuickBooks / Zoho / Wave for [market]` *(competitor page — see programmatic-SEO note)*

### Search-intent grouping
| Intent | Asset to build |
|---|---|
| Free tools (top of funnel) | Tool landing pages per generator (10 pages) |
| Comparison | "Equity.AI vs QuickBooks/Zoho Books/Tally" pages |
| Problem-aware | "Why your books never match your bank" content |
| Solution-aware | Feature pages: invoicing, inventory, compliance, AI analyst |
| Decision | Pricing, security, roles/multi-workspace page |

---

## 8. Value propositions (per psychological driver)

*(Each maps to a marketing-psychology model — use the stated frame in copy.)*

| Driver | Value proposition copy |
|---|---|
| **Loss aversion** | "Every missed tax ID is a potential penalty. Equity.AI warns you before you file — not after." |
| **Uncertainty → certainty** | "Know what you're owed, what you owe, and what you made — any second of any day." |
| **Status-quo bias / switching cost** | "Import once, then everything after is automatic. Your first invoice takes 2 minutes." *(reduce friction to switch)* |
| **Zero-price effect** | "Our document tools are free forever — no signup, no card, no trial countdown." |
| **Endowment effect** | "Your data, your workspace, from day one. The free business you create today is yours to grow." |
| **Paradox of choice** | "One complete system instead of five half-tools. No integrations to maintain — it's all one ledger." |
| **Authority / trust** | "Real double-entry books, database-enforced roles, and an AI that shows you exactly which data it used." |
| **Mental accounting** | "Less than a coffee a day replaces your accountant's admin hours." ⚠️ (confirm pricing before using) |

### Boilerplate (press / directory / launch text — short)
> **Equity.AI** is the AI-powered ERP and accounting platform for small and medium businesses. It unifies invoicing, payments, inventory, expenses, double-entry accounting, and tax compliance in one live, multi-workspace ledger — with Freya, an AI finance analyst grounded in your real data. Free document tools are available at no cost, no signup.

### Boilerplate (long)
> Small businesses lose hours every week re-entering the same data across invoicing apps, spreadsheets, and tax tools — and still don't know their real financial position. Equity.AI replaces that patchwork with one AI-powered cloud workspace: quotes convert to invoices, invoices post to the ledger automatically, purchase orders become bills, stock moves in real time across locations, and every number flows into live financial statements and a filing-ready tax compliance workbench. Freya, the built-in AI finance analyst, answers questions like "What's my net profit this quarter?" using your actual data — with every step visible and auditable. Built on modern cloud infrastructure with database-level security, team roles from owner to viewer, 14 currencies, and country-specific tax regimes (GST, VAT, and more), Equity.AI gives growing businesses ERP-grade control without ERP-grade cost or complexity.

---

## 9. Changelog (drafted from shipped evidence)

> ⚠️ **Honesty note:** the repository contains **no changelog or version history**. The entries below are reconstructed from shipped features, database migration dates (May–June 2026), and route/schema evidence. **Confirm the version numbers and dates before publishing.** Entries marked 🔒 are shipped-and-verified; anything else should be re-verified.

### v1.1 — Finance & Intelligence era *(⚠️ version/date TBD)*
- 🔒 **Freya, AI Finance Analyst (Beta):** streaming chat grounded in live org data via tool calling (`financial_summary`, `recent_invoices`, `recent_bills`, `inventory_snapshot`, `tax_summary`), with fully inspectable tool-call traces.
- 🔒 **Compliance module:** output vs. input tax, net liability, missing-tax-ID warnings, sales/purchase registers with CSV export.
- 🔒 **Financial statements:** Profit & Loss, Balance Sheet, Cash Flow with period selector (this/last month, QTD, YTD, last year) and CSV export.
- 🔒 **Sales analytics:** collected vs. outstanding revenue, active customers, average invoice value, monthly trend, top customers, top line items.

### v1.0 — Full commercial cycle *(⚠️ version/date TBD; migrations 2026-05)*
- 🔒 Quotes with line items and one-click quote→invoice conversion; automatic numbering (Q-, PO-, CN- sequences by year).
- 🔒 Invoicing with taxes, statuses (draft/sent/partial/paid/void), printable branded PDF, void & delete.
- 🔒 Payments in 6 methods (cash, bank transfer, card, UPI, cheque, other) with auto-apply to open invoices across multiple invoices.
- 🔒 Credit notes, linked-to-invoice or standalone, with numbering.
- 🔒 Purchase orders with PO→bill conversion; bills and vendor payments applied to open bills.
- 🔒 Multi-location inventory: products (SKU/unit/cost/sale/tax/track toggle), stock by location, movement history (receipt, issue, adjustment, transfers).
- 🔒 Double-entry accounting: chart of accounts, journal entries, trial balance; invoices auto-post AR/Revenue/Tax entries via database triggers.
- 🔒 Expenses with categories, vendors, and tax.
- 🔒 Multi-workspace (organizations) with per-workspace country, currency, and tax regime; workspace switcher; row-level security; roles owner/admin/accountant/sales/viewer; signup auto-creates a workspace.
- 🔒 Multi-currency with FX rates (14 currencies).
- 🔒 ⌘K command palette with live search across invoices, customers, vendors, products.
- 🔒 Dashboard KPIs: revenue YTD, receivables + overdue, payables, expenses YTD, 12-month invoice chart.

### v0.x — Foundation *(⚠️ dates TBD from migration log 2026-05→06)*
- 🔒 Auth with auto-provisioned workspace; team member management with roles.
- 🔒 **Free Business Document Tools:** 10 no-login generators (invoice GST/VAT, quotation, proforma, PO, delivery challan, commercial invoice, consulting invoice, packing list, formats) with 8 templates, 13 currencies, PDF download.
- 🔒 Country onboarding presets (US, UK, DE, FR, ES, IT, NL, IN-GST, AE-VAT, SG, AU, CA, JP, BR).

---

## 10. Upcoming features / roadmap

> ⚠️ Grounded in code evidence, not speculation. Do **not** publish items as "coming soon" unless you intend to ship them — but these are safe teaser candidates with real backing.

| Feature | Evidence / status |
|---|---|
| **Recurring invoices** (weekly/monthly/quarterly/yearly) | `recurring_invoices` table exists in schema with frequency + JSONB template — backend-ready, UI not yet surfaced. Strongest "coming soon" candidate. |
| **Team email invitations** | "Invitations are coming soon" is already stated in the product UI; an email-invite flow is the natural completion. |
| **Freya graduating from Beta** | AI Agent currently badged Beta; expands as trust and tool coverage grow. |
| **Localized interface (i18n)** | Currency/regime breadth suggests demand; ⚠️ not started — treat as survey-feedback-driven, don't promise. |

### Open community questions to gather demand for (content + research angle)
- Which tax regimes to add next? (Candidates: PK-PSE/STS, BD-NBR VAT, MY-SST — inferred from built-in currency support ⚠️)
- Integrations wanted (bank feeds, marketplaces, payment gateways)?

---

## 11. Claims guardrails — what NOT to say ⚠️

Protect brand trust (and yourself from refund/chargeback pain) by never overclaiming:

1. ❌ Don't claim POS, payroll, HR, e-commerce, or restaurant modules — none exist.
2. ❌ Don't claim Arabic or multi-language UI — English-only today (multi-*currency* yes, multi-*language* no).
3. ❌ Don't imply email invitations or messaging exist — team adds are manual today.
4. ✅ Keep "Beta" badge on Freya in all public assets.
5. ✅ "Multi-currency," "multi-workspace," "multi-location," and "double-entry" are all *provable* — use them freely.
6. ✅ If using competitor comparisons or pricing claims, verify current facts at publish time.

---

## 12. Quick asset checklist (channel mapping)

| Channel | Pull from | Hero hook |
|---|---|---|
| Landing page hero | §1 taglines, §6 loss-aversion line | "Run your whole business on one ledger." |
| Free-tools pages | §5.11 | "Free invoice generator — no signup, no card." |
| Ads (search) | §7 keywords, §3 pain rows | "Your books, your stock, your tax — one live ledger." |
| Social proof posts | §9 changelog items (ship announcements) | "Invoices now post to your ledger automatically." |
| Comparison/SEO pages | §7 competitor keywords | "Equity.AI vs [Tool]: one ledger replaces five tools." |
| Onboarding email | §6 zero-price + endowment | "Your workspace is live. First invoice in 2 minutes." |

---

## 13. Product descriptions (multiple variants)

> Template: "EQUITY is an AI-powered platform for finance teams to [automate reporting/analysis/compliance]. Built with [framework], it includes a web app and [database], integrating with [key external services]."

**V1 — Full (template filled):**
> EQUITY is an AI-powered platform for finance teams to automate reporting, analysis, and tax compliance across invoicing, inventory, and double-entry accounting. Built with React 19 + TypeScript (TanStack Start, deployed to Cloudflare Workers), it includes a web app and a Supabase PostgreSQL database, integrating with Supabase Auth and the Lovable AI Gateway (Google Gemini 2.5 Flash) for its built-in finance analyst.

**V2 — Short (README / one-paragraph):**
> EQUITY is an AI-powered ERP & accounting platform for finance teams to automate reporting, analysis, and compliance. Built with React 19 + TypeScript, it includes a web app and a Supabase PostgreSQL database, integrating with Supabase Auth and a Gemini-powered AI analyst grounded in live business data.

**V3 — Marketing tone:**
> EQUITY is an AI-powered platform for finance teams to automate reporting, run instant analysis, and stay compliant — turning quotes, invoices, and stock movements into live, filing-ready books. Built with a modern React + TypeScript stack, it includes a fast web app and a secure PostgreSQL database, integrating with AI so you can ask your own numbers questions in plain language.

**V4 — Technical / developer-oriented:**
> EQUITY is an AI-powered platform for finance teams to automate financial reporting, live-data analysis, and multi-jurisdiction tax compliance (GST, VAT, and more). Built with TanStack Start + React 19 (SSR on Cloudflare Workers edge runtime), it includes a web app and a Supabase PostgreSQL database with row-level multi-tenant security, integrating with Supabase Auth, Vercel AI SDK tool-calling backed by the Lovable AI Gateway (Google Gemini 2.5 Flash), and FX/multi-currency rate management.

**V5 — Launch blurb (Product Hunt style):**
> EQUITY is an AI-powered platform for finance teams to automate reporting, analysis, and compliance — without spreadsheets or five disconnected tools. Built with React 19 + TypeScript, it includes a web app and a managed PostgreSQL database, integrating with Supabase and Google Gemini to power Freya, the AI finance analyst that answers "What's my profit?" from your real data.

**V6 — Investor / bank-facing (formal):**
> EQUITY is an AI-powered platform for finance teams to automate financial reporting, analytical insight, and statutory compliance. Built with a modern TypeScript web stack, it includes a production web application and a PostgreSQL-backed data layer, integrating with managed identity, storage, and AI inference services to deliver real-time accounting, multi-currency operations, and role-based governance for small and medium businesses.

**V7 — Ultra-short (directory listing, ~30 words):**
> EQUITY is an AI-powered platform for finance teams to automate reporting, analysis, and compliance. Built with React + TypeScript, it includes a web app and PostgreSQL database, integrating with Supabase and Gemini.

---

*Document owner: update §9 dates/versions and §11 guardrails after each release. Keep every public claim traceable to a shipped feature — this file is the source of truth.*
