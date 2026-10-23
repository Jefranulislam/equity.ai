# CLAUDE.md

Guide for AI coding tools (Claude Code, Codex, Cursor, etc.) working on Equity.AI.

## What this is

AI-powered ERP & accounting SaaS for SMBs. Multi-tenant (per-workspace isolation), RLS-first security, double-entry accounting with trigger-based auto-posting.

## Tech stack & commands

- **Stack:** React 19 + TypeScript, TanStack Start (SSR + server functions + server routes), TanStack Router & Query, Tailwind CSS v4, shadcn/Radix UI, Supabase (Postgres + auth + storage), Vercel AI SDK on an OpenAI-compatible gateway. Build target: Cloudflare Workers (`@cloudflare/vite-plugin`, `nodejs_compat`).
- **Package manager:** Bun (`bun.lock`) — npm (`package-lock.json`) also pinned.
- **Dev:** `bun run dev` — **Build:** `bun run build` — **Lint:** `bun run lint` — **Format:** `bun run format`.
- **Local prod-style run:** `bun x wrangler dev --port 8787` after `bun run build`.

## Folder map

```
src/
  routes/                 TanStack Router file-based routes
    __root.tsx            Root layout, SEO title/description, providers
    login.tsx / onboarding.tsx   Auth screens; country presets & workspace provisioning
    index.tsx             Redirect: signed-in → /dashboard, else /login
    _authenticated/       All app modules (dashboard, quotes, invoices, payments,
                          credit-notes, customers, inventory, purchase-orders, bills,
                          bill-payments, vendors, expenses, accounting, reports, sales,
                          compliance, members, settings, ai-agent, tools*)
    api/chat.ts           POST /api/chat — Freya AI endpoint (auth + membership checked)
  components/             Shared UI (app-sidebar, app-topbar, command-palette, ui/*)
  lib/                    Business logic
    members.functions.ts / org.functions.ts   Server functions (JWT-authenticated)
    invoice-utils.ts, format.ts, number-to-words.ts, error-*.ts
  integrations/supabase/
    client.ts             Browser client (anon key + user JWT → RLS applies)
    client.server.ts      server-only admin client (service role, NEVER import client-side)
    auth-middleware.ts    requireSupabaseAuth middleware: validates Bearer JWT, injects
                          { supabase (user-scoped), userId } context
    types.ts              GENERATED Database types — regenerate after schema changes
supabase/migrations/      Ordered SQL migrations (append-only; new migrations must be
                          forward-only, one concern per file)
database/                 schema.sql (from-scratch install) + seed.sql (demo data)
```

## Conventions

1. **Never import `client.server.ts` from browser code.** Service-role operations only for: team email lookup, workspace provisioning, AI data tools. Everything else must go through the user-scoped client so RLS is the enforcement point.
2. **New server functions:** always `.middleware([requireSupabaseAuth])`, validate input with zod, and re-check org membership (`organization_members` lookup for the caller) before acting on another user's records when admin client is required.
3. **Schema changes:** add a migration in `supabase/migrations/`, regenerate `types.ts`, then update `database/schema.sql` (concatenate new migration) and keep `database/seed.sql` valid against the new schema.
4. **Every business table** has `organization_id`, RLS policies using `is_org_member()`/`has_org_role()`, `updated_at` + trigger, and (where numbered) a numbering trigger. Follow the pattern of existing tables.
5. **Accounting integrity:** journal entries must stay balanced (enforced by trigger `tg_check_journal_balanced`); never bypass it.
6. Client data fetching: TanStack Query + the shared `supabase` browser client; naming follows existing route files (`x.{index,new,$id}.tsx`).

## Tests

No unit test framework is configured (checked: no test script in package.json). Manual verification protocol lives in `HowToSetup.md` → "Verification checklist". If you add tests, they should run via `bun test` with no extra config.
