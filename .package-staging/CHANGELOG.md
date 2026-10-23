# Changelog

All notable changes to Equity.AI. Format: [Keep a Changelog](https://keepachangelog.com); versions: [SemVer](https://semver.org).

Dates are approximate build dates reconstructed from the migration log; adjust on release.

## [1.1.0] — 2026-06 · Finance & intelligence

### Added
- **Freya, AI finance analyst (beta):** streaming chat grounded in live workspace data via tool calling (`financial_summary`, `recent_invoices`, `recent_bills`, `inventory_snapshot`, `tax_summary`) with fully inspectable tool-call traces.
- **Compliance module:** output vs. input tax, net liability, missing-tax-ID warnings; filing-ready sales & purchase registers with CSV export.
- **Financial statements:** Profit & Loss, Balance Sheet, Cash Flow with period selector (this/last month, QTD, YTD, last year) and CSV export.
- **Sales analytics:** collected vs. outstanding revenue, active customers, average invoice value, monthly revenue trend, top customers, top line items.
- **Configurable AI provider:** Freya supports any OpenAI-compatible endpoint (`AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL`), with the Lovable AI Gateway as the default.

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
- **Free Business Document Tools:** ten no-login invoice/document generators (GST & VAT invoices, quotation, proforma, purchase order, delivery challan, commercial invoice, consulting invoice, packing list) with 8 templates, 13 currencies, PDF download.

## [Planned]

- Recurring invoices (schema-ready: `recurring_invoices` table with weekly/monthly/quarterly/yearly frequency).
- Team invitations by email with signed invite links.
- Freya graduating from beta (more data tools, scheduled insights).
- Additional tax-regime presets and interface localization.

[1.1.0]: #
[1.0.0]: #
