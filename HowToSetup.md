# HowToSetup — Install Equity.AI from scratch

Three install paths are described: **A) VPS (bare metal/systemd)**, **B) Docker Compose**, and the **database setup** (Supabase) they share. A hosted **Cloudflare deploy** is included as option C, and **static hosting (Hostinger / Netlify)** as option D.

Estimated time: 20–40 minutes. You will create accounts on **[supabase.com](https://supabase.com)** (free tier works) and either run locally/VPS/Docker, or optionally deploy to Cloudflare.

**Runtime requirements**

| Tool | Version | Notes |
|---|---|---|
| [Bun](https://bun.sh) | **1.3.14** pinned (`packageManager` in `package.json`; ≥ 1.2 works) | **The only supported package manager.** Always install with `bun install --frozen-lockfile` so `bun.lock` is honoured exactly. |
| Node.js | ≥ 20 | Only needed by the build scripts (`scripts/*.mjs`). Do not use npm/pnpm/yarn installs. |
| Docker (Target B only) | ≥ 24 with Compose v2 | Base image pinned to `oven/bun:1.3.14`. |

### Which deployment target should I use?

| Target | Build command | Server features (`/api/chat`, `/api/demo`, server functions) | Use it for |
|---|---|---|---|
| **D — Static SPA (Vercel / Hostinger / Netlify)** — *primary, runs the public demo* | `bun run build` → `dist/` | No — uses Supabase RPCs instead; Freya shows "not configured" | Public demo, simplest hosting |
| A — VPS · B — Docker · C — Cloudflare | `bun run build:worker` → `dist/server/` | Yes | Full self-hosted install incl. Freya AI chat |

All targets share the **same database setup (Step 1)** and the **same `.env` (Step 2)**.

### Quick start (clean machine, ~10 minutes)

```bash
# 1. Database: run database/schema.sql in the Supabase SQL Editor (Step 1)
cd Project
cp ../.env.example .env                 # fill in the 5 Supabase values (Step 2)
bun install --frozen-lockfile
bun test                                # unit tests (pure business helpers)
bun run dev                             # open the URL Vite prints; sign up and create a workspace
```

---

## Step 1 — Create the database (Supabase)

1. Sign up at [supabase.com](https://supabase.com) and create a **new project** (any region; free plan is fine). Save the database password.
2. Wait for provisioning, then open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon / publishable key**
   - **service_role key** (secret — server only)
3. Open the **SQL Editor** in the Supabase dashboard, create a new query, paste the entire contents of **`database/schema.sql`**, and press **Run**. **Use `schema.sql` OR the migrations, never both** (see "Database setup order" below). This creates all 30+ tables, RLS policies, functions, triggers, and the attachments storage bucket from scratch. ✅ Expected result: "Success. No rows returned".
4. *(Optional, recommended for the demo)* New query → paste **`database/seed.sql`** → replace `REVIEWER_EMAIL@example.com` (appears once, near the top) with the email you will register with in Step 2.4 → **Run**. This creates a demo workspace ("Acme Trading Co.") with 10 months of history: customers, vendors, products with multi-location stock, paid/partial/unpaid invoices, payments, vendor bills, expenses, quotes, a purchase order, a credit note, a recurring-invoice template and a manual journal entry — every report, dashboard and Freya tool then has real, consistent numbers.

> **Plain Postgres note:** the schema targets Supabase-compatible Postgres (it references `auth.users`, `auth.uid()` and the `storage` schema). For a fully self-hosted Postgres you must run [Supabase's auth migrations](https://github.com/supabase/postgres/tree/main/migrations) first, or use the hosted Supabase project — the recommended path.

> **psql fallback:** if your SQL client refuses the `ALTER TYPE ... ADD VALUE` statement inside one big transaction (older psql/node clients), run the two files statement-by-statement with `psql "$DATABASE_URL" -f database/schema.sql` instead. The Supabase SQL Editor and modern psql handle both files as-is.

## Step 2 — Run the application

### Common: configure environment (all targets)

In the **extracted project folder** (top level, next to this file):

```bash
cp .env.example .env       # (Windows PowerShell: Copy-Item .env.example .env)
```

> The archive layout is `archive-root/.env.example`, `archive-root/Project/…`, `archive-root/database/…`. Targets A and B run inside `Project/`, but `.env` stays at the archive root; the packaging script also drops a copy of `.env.example` inside `Project/`.

Open `.env` and fill in the **five Supabase values** from Step 1.3 (keep `VITE_*` identical to their server-side twins). Leave the AI keys empty to start; add them later (Step 4).

| Variable | Required | When it is read | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | **yes** | **build time** (baked into the browser bundle) | Browser client; RLS applies with the user's JWT |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | yes (A/B/C) | runtime | Server-side client |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (A/B/C) | runtime, **server only** | Workspace provisioning, team email lookup, AI data tools |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | optional | runtime | Freya AI chat (Step 4) |
| `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD` | optional | build time | Shows the one-tap demo button (public demo only) |
| `DEMO_ENABLED`, `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_SETUP_TOKEN` | optional | runtime | One-time demo seeding via `POST /api/demo` (token at least 16 chars). Leave unset in production. |
| `APP_PORT` | optional | Docker only | Host port (default 8787) |

```dotenv
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

### Target A — VPS (bare metal / systemd)

Requirements: Bun ≥ 1.2 (or Node 20+, commands below use Bun).

```bash
bun install --frozen-lockfile   # restores exactly the versions in bun.lock
bun run build:worker            # production build (Vite + Cloudflare Workers target)
```

> **Note:** the default `bun run build` produces a **static SPA** (Target D). Targets A, B and C need the Workers build, hence `build:worker`.

> **Memory tip:** on machines with <4 GB free RAM the SSR stage can fail with `FATAL: JavaScript heap out of memory`. Fix by raising Node's heap once: `NODE_OPTIONS=--max-old-space-size=6144 bun run build` (PowerShell: `$env:NODE_OPTIONS='--max-old-space-size=6144'; bun run build`).

Run the built Workers bundle locally with workerd (the Cloudflare Vite plugin emits `dist/server/wrangler.json` — this runs the exact production worker, no Cloudflare account or login needed):

```bash
bun x wrangler dev --config dist/server/wrangler.json --port 8787
```

> The build writes runtime server secrets to `dist/server/.dev.vars` automatically; **do not commit or ship `dist/`** — it is a build artifact regenerated from your `.env`.

Keep it alive with a systemd unit (`/etc/systemd/system/equity-ai.service`):

```ini
[Unit]
Description=Equity.AI app
After=network-online.target

[Service]
WorkingDirectory=/opt/equity-ai
EnvironmentFile=/opt/equity-ai/.env
ExecStart=/usr/local/bin/bun x wrangler dev --config dist/server/wrangler.json --port 8787
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now equity-ai
```

Expose it behind Nginx/Caddy with TLS on 443 proxying to `127.0.0.1:8787` (standard reverse-proxy config). **Firewall note:** only ports 80/443 should be public.

### Target B — Docker Compose

Requirements: Docker ≥ 24 with Compose v2. Run `cp .env.example .env` and fill it in (Step 2.1) **before** `docker compose up`, because the env file is mounted into the container.

```bash
docker compose up -d --build
docker compose logs -f app      # wait for "Ready on http://..."
```

The app is published on **http://localhost:8787** (override `APP_PORT` in `.env`).
The compose file contains **only the application**; the database lives in your Supabase project (Step 1) so your data survives redeploys.

### Target C — Hosted deploy (Cloudflare) — good for the public demo

The Cloudflare Vite plugin emits a deployable worker config at `dist/server/wrangler.json` during the build:

```bash
bun run build:worker
bun x wrangler deploy dist/server
```

Rename the default worker name in `wrangler.jsonc` first if needed. Add the same secrets in the Cloudflare dashboard (**Workers → your worker → Settings → Variables & Secrets**): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ optional `AI_API_KEY`).

### Target D — Static hosting (Hostinger / Netlify) — easiest public demo

`bun run build` (the default) produces a **pure static SPA** — no server required:

- `dist/` contains `index.html`, `assets/` and an `.htaccess` that rewrites every deep link (`/login`, `/invoices/123`, …) to the SPA entry.
- Just point the host at the `dist` output directory.
- **Vercel:** the included `vercel.json` sets install `bun install --frozen-lockfile`, build `bun run build`, output `dist`, and the SPA rewrite so deep links such as `/login` and `/dashboard` do not 404. No dashboard overrides are needed.

Because no server functions run on a static host, the app uses the Supabase client and the `invite_member` RPC for everything mutating — make sure the **`VITE_*` variables are present in the hosting build environment** (they are baked into the client bundle at build time):

```dotenv
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

Freya (AI chat) needs a working AI key in the environment or shows a clear "not configured" error; every other module works fully offline.

**Migrations matter on static hosts.** Team invites and workspace creation run through Supabase RPCs (`invite_member`, `create_workspace`) instead of server functions, so the database must include them — `database/schema.sql` already does. If your database was set up earlier, see "Upgrading an existing database" below.

## Step 3 — First login & admin access

1. Open the app (`http://localhost:8787`, or your domain).
2. On the login page, use **Sign Up** with your email and a password.
3. First sign-in asks workspace name + country → you are provisioned as **owner** of your own workspace automatically (a Supabase trigger does this). An owner can then invite teammates under **Settings → Team** with any of the roles `owner / admin / accountant / sales / inventory / viewer`.
4. If you ran `seed.sql`, your **demo workspace** now belongs to your account — use the workspace switcher in the top bar to jump between it and your personal signup workspace.

**Demo account for reviewers** (live demo: <https://equity-ai-wine.vercel.app>, then **Try the demo** or sign in manually):

| Email | Password | Role |
|---|---|---|
| `demo@equity.ai` | `demo1234` | owner of the seeded "Acme Trading Co." workspace |

This is a **public, intentionally published** demo login for an isolated sample workspace, not a secret. Production installs leave all `DEMO_*` variables unset.

## Step 4 — Optional: enable Freya (AI chat)

Pick one route in `.env`:

- **Option A — OpenRouter (bring-your-own, per user)**: each user pastes their own OpenRouter key in the app (**Settings → AI**) — no server env needed. Keys are stored in Supabase auth `user_metadata` and create at [openrouter.ai/keys](https://openrouter.ai/keys). Model is user-selectable; default `google/gemini-2.5-flash`.
- **Option B — platform-wide OpenAI-compatible endpoint**:
  ```dotenv
  AI_API_KEY=sk-...                              # an OpenRouter key works here too
  AI_BASE_URL=https://openrouter.ai/api/v1       # or OpenAI/your proxy
  AI_MODEL=gpt-4o-mini
  ```

Restart the app process afterward. Without a key, `/api/chat` answers with a clear "not configured" error; every other module works fully offline.

## Step 5 — Branding changes

| What | Where |
|---|---|
| Product name & SEO description | `src/routes/__root.tsx` |
| Sidebar logo text & navigation | `src/components/app-sidebar.tsx` |
| Login page tagline | `src/routes/login.tsx` |
| Currency defaults & country presets | `src/routes/onboarding.tsx` |
| Invoice PDF look | `src/routes/_authenticated/routes` invoice pages + print CSS |

After edits, rebuild and restart (Target A/B) or `wrangler deploy` (Target C).

## Verification checklist (a reviewer's smoke test)

- [ ] `bun install --frozen-lockfile && bun test && bun run build` succeeds on a clean clone from `.env.example` values alone
- [ ] Quotes, Credit Notes, Purchase Orders and Bill Payments lists load (customer/vendor names shown)
- [ ] At phone width (~390 px): the menu button opens the sidebar drawer, the search icon opens the palette, tables scroll inside their card
- [ ] "Create Invoice" appears in the top bar only on the Invoices screens
- [ ] A `viewer` sees Settings, Workspace as read-only
- [ ] App loads at `/login`; signup creates a workspace automatically
- [ ] Create a quote → convert to invoice → its line appears in Accounting and Reports
- [ ] Auto-posted invoice journal entry visible in **Accounting** (DR Accounts Receivable)
- [ ] P&L & Balance Sheet show numbers from the seed or your test data
- [ ] Team invite requires owner/admin; a `viewer` role cannot mutate data (RLS rejects)
- [ ] CSV exports download from Reports and Compliance


---

## Demo account (one-tap login)

The public demo account is only active when the build receives the two `VITE_DEMO_*` variables. Without them, the one-tap button is hidden and no demo credential is included in the browser bundle.

| Item | Value |
|---|---|
| Email | `demo@equity.ai` |
| Password | `demo1234` |
| Workspace | "Acme Trading Co." (seeded, isolated from real tenants) |

**One-time setup (optional; run only after Step 1 (database) and Step 2 (server running) are done, then turn it off):**

1. Set `DEMO_ENABLED=true`, `DEMO_EMAIL`, `DEMO_PASSWORD` (same value as `VITE_DEMO_PASSWORD`) and a random `DEMO_SETUP_TOKEN` of **at least 16 characters** (e.g. `openssl rand -hex 24`) on the server, then start the app with Target A, B or C (the static build has no server routes).
2. Call the setup route once: `POST /api/demo` with the header `x-demo-setup-token: <DEMO_SETUP_TOKEN>`. It creates the demo user and seeds the workspace. A wrong token returns 401 (compared in constant time); with `DEMO_ENABLED` unset or the token missing or too short it returns 404 (fail-closed).
3. Set `VITE_DEMO_EMAIL` and `VITE_DEMO_PASSWORD` in the frontend build environment for the demo deployment, then rebuild.
4. For production, leave all `DEMO_*` and `VITE_DEMO_*` variables unset, or delete the demo user in Supabase.

## Database setup order

There is **one authoritative path per situation**:

| Situation | Run | Do NOT run |
|---|---|---|
| **Fresh database** (recommended) | `database/schema.sql`, then optionally `database/seed.sql` (replace `REVIEWER_EMAIL@example.com` first) | the migrations (they are already inside `schema.sql`) |
| **Existing database from an earlier version** | only the migrations you have not applied yet, in filename order | `schema.sql` (it would fail on existing objects) |
| Supabase CLI users | `supabase db push` (applies `supabase/migrations/`) | `schema.sql` |

`database/schema.sql` is the concatenation of every file in `supabase/migrations/` in filename order, so the two never diverge. When adding a migration, append it to `schema.sql` the same way (see `CLAUDE.md`).

### Upgrading an existing database to 1.0.6

Run these in the Supabase SQL Editor, in order. All are idempotent (safe to re-run):

1. `supabase/migrations/20261105000000_add_missing_sales_document_fks.sql`: foreign keys for quotes, credit notes, purchase orders, bill payments
2. `supabase/migrations/20261120000000_harden_member_self_insert.sql`: stops users from adding themselves to workspaces they do not own
3. `supabase/migrations/20261120000001_account_balances_view.sql`: server-side trial-balance aggregation
4. `supabase/migrations/20261120000002_profiles_visible_to_teammates.sql`: teammates' names visible on the Team pages

## Security model (authentication and roles)

- **Authentication:** every app route sits under `_authenticated` (session required). Server functions use `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`), which verifies the Bearer JWT with Supabase. `/api/chat` verifies the JWT with `auth.getUser(token)` **and** checks `organization_members` for the requested `organizationId` (403 otherwise).
- **Tenant isolation:** every business table has `organization_id` and RLS enabled. SELECT, INSERT and UPDATE require `is_org_member(organization_id, auth.uid())`. Client queries also filter by `organization_id` as defence in depth, including deletes and updates by id.
- **Roles** (`owner, admin, accountant, sales, inventory, viewer`) are enforced **in the database** with `has_org_role(...)`, so they cannot be bypassed by calling the API directly:

| Action | Allowed roles (RLS) |
|---|---|
| Update workspace details | owner, admin |
| Delete workspace | owner |
| Invite, change role, remove member | owner, admin (the `invite_member` RPC and `inviteMember` server function re-check this) |
| Add yourself as a member | only to a workspace you created (onboarding) |
| Read another user's profile (name, avatar) | only users who share a workspace with you |
| Delete customers, invoices, payments, vendors, bills, expenses, products, quotes, POs, credit notes, accounts, journal entries | owner, admin |
| Delete document lines (invoice, quote, credit-note lines) | owner, admin, accountant, sales |

The UI hides or disables controls the user's role cannot use (`src/lib/use-org-role.ts`), but RLS is the enforcement point.

## Dependency audit

`bun audit` (Bun 1.3.14, run 2026-11-20 against `bun.lock`) reports **No vulnerabilities found**. Re-run any time with `bun run audit`. Transitive fixes are pinned in `package.json` `overrides` (`minimatch`, `esbuild`, `katex`, `mermaid`, plus the earlier list).

