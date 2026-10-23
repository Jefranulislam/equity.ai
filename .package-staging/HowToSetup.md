# HowToSetup — Install Equity.AI from scratch

Three install paths are described: **A) VPS (bare metal/systemd)**, **B) Docker Compose**, and the **database setup** (Supabase) they share. A hosted **Cloudflare deploy** is included as option C for the public demo.

Estimated time: 20–40 minutes. You will create accounts on **[supabase.com](https://supabase.com)** (free tier works) and either run locally/VPS/Docker, or optionally deploy to Cloudflare.

**Runtime requirement:** [Bun](https://bun.sh) ≥ 1.2 (or Node.js ≥ 20 with npm — package-lock.json is provided).

---

## Step 1 — Create the database (Supabase)

1. Sign up at [supabase.com](https://supabase.com) and create a **new project** (any region; free plan is fine). Save the database password.
2. Wait for provisioning, then open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon / publishable key**
   - **service_role key** (secret — server only)
3. Open the **SQL Editor** in the Supabase dashboard, create a new query, paste the entire contents of **`database/schema.sql`**, and press **Run**. This creates all 30+ tables, RLS policies, functions, triggers, and the attachments storage bucket from scratch. ✅ Expected result: "Success. No rows returned".
4. *(Optional, recommended for the demo)* New query → paste **`database/seed.sql`** → replace `REVIEWER_EMAIL@example.com` (appears once, near the top) with the email you will register with in Step 2.4 → **Run**. This creates a demo workspace ("Acme Trading Co.") with 10 months of history: customers, vendors, products with multi-location stock, paid/partial/unpaid invoices, payments, vendor bills, expenses, quotes, a purchase order, a credit note, a recurring-invoice template and a manual journal entry — every report, dashboard and Freya tool then has real, consistent numbers.

> **Plain Postgres note:** the schema targets Supabase-compatible Postgres (it references `auth.users`, `auth.uid()` and the `storage` schema). For a fully self-hosted Postgres you must run [Supabase's auth migrations](https://github.com/supabase/postgres/tree/main/migrations) first, or use the hosted Supabase project — the recommended path.

> **psql fallback:** if your SQL client refuses the `ALTER TYPE ... ADD VALUE` statement inside one big transaction (older psql/node clients), run the two files statement-by-statement with `psql "$DATABASE_URL" -f database/schema.sql` instead. The Supabase SQL Editor and modern psql handle both files as-is.

## Step 2 — Run the application

### Common: configure environment (both A and B)

In the **extracted project folder** (top level, next to this file):

```bash
cp .env.example .env       # (Windows PowerShell: Copy-Item .env.example .env)
```

> The archive layout is `archive-root/.env.example`, `archive-root/Project/…`, `archive-root/database/…`. Targets A and B run inside `Project/`, but `.env` stays at the archive root; the packaging script also drops a copy of `.env.example` inside `Project/`.

Open `.env` and fill in the **five Supabase values** from Step 1.3 (keep `VITE_*` identical to their server-side twins). Leave the AI keys empty to start; add them later (Step 4).

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
bun install                # restores all packages from bun.lock (or: npm ci)
bun run build              # production build (Vite + Cloudflare Workers target)
```

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
bun run build
bun x wrangler deploy dist/server
```

Rename the default worker name in `wrangler.jsonc` first if needed. Add the same secrets in the Cloudflare dashboard (**Workers → your worker → Settings → Variables & Secrets**): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ optional `LOVABLE_API_KEY` / `AI_API_KEY`).

## Step 3 — First login & admin access

1. Open the app (`http://localhost:8787`, or your domain).
2. On the login page, use **Sign Up** with your email and a password.
3. First sign-in asks workspace name + country → you are provisioned as **owner** of your own workspace automatically (a Supabase trigger does this). An owner can then invite teammates under **Settings → Team** with any of the roles `owner / admin / accountant / sales / inventory / viewer`.
4. If you ran `seed.sql`, your **demo workspace** now belongs to your account — use the workspace switcher in the top bar to jump between it and your personal signup workspace.

**Demo accounts for reviewers/public demo** (create them in the app; record here before submission):

| Email | Password | Role |
|---|---|---|
| `demo@yourdomain.com` | *(set a strong one)* | owner, full demo workspace |

## Step 4 — Optional: enable Freya (AI chat)

Pick one route in `.env`:

- **Option A — Lovable AI Gateway** (default): `LOVABLE_API_KEY=your_key` (create at lovable.dev → Cloud → AI Gateway). Uses model `google/gemini-2.5-flash`.
- **Option B — any OpenAI-compatible endpoint**:
  ```dotenv
  AI_API_KEY=sk-...
  AI_BASE_URL=https://api.openai.com/v1      # or OpenRouter/your proxy
  AI_MODEL=gpt-4o-mini
  ```

Restart the app process afterward. Without a key, `/api/chat` answers with a clear "not configured" error; every other module works fully offline.

## Step 5 — Branding changes

| What | Where |
|---|---|
| Product name & SEO description | `src/routes/__root.tsx` |
| Sidebar logo text & navigation | `src/components/app-sidebar.tsx` |
| Login page tagline | `src/routes/login.tsx` |
| Currency defaults & country presets | `src/routes/onboarding.tsx`, `src/routes/tools/index.tsx` |
| Invoice PDF look | `src/routes/_authenticated/routes` invoice pages + print CSS |

After edits, rebuild and restart (Target A/B) or `wrangler deploy` (Target C).

## Verification checklist (a reviewer's smoke test)

- [ ] `bun install && bun run build` succeeds on a clean clone from `.env.example` values alone
- [ ] App loads at `/login`; signup creates a workspace automatically
- [ ] Create a quote → convert to invoice → its line appears in Accounting and Reports
- [ ] Auto-posted invoice journal entry visible in **Accounting** (DR Accounts Receivable)
- [ ] P&L & Balance Sheet show numbers from the seed or your test data
- [ ] Team invite requires owner/admin; a `viewer` role cannot mutate data (RLS rejects)
- [ ] CSV exports download from Reports and Compliance
