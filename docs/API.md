# Equity.AI — API & Authorization Reference

Equity.AI has an intentionally **small server-side API surface**. The vast majority of reads and writes go directly from the browser to Supabase PostgREST using the signed-in user's own JWT, with row-level security (RLS) enforcing every rule at the database level. Only the endpoints below touch application server code.

## 1. How data flows

```
Browser (React/TanStack Start)
  ├─ @supabase/supabase-js (anon key + user JWT from the session) ──► PostgREST ──► RLS policies
  └─ server functions / /api/chat  ──► TanStack Start server (Workers) ──► Supabase
```

- The browser never receives the service-role key; it is used **only inside the server endpoints** listed in §3 and for signup workspace provisioning (client.ts/client.server.ts).
- Every table has RLS enabled with policies based on `is_org_member()` / `has_org_role()` SECURITY DEFINER helpers (revoked from `anon`) — see `database/schema.sql`, section "Row Level Security".
- Mutations through PostgREST automatically fail with `42501 permission denied` unless the caller's row in `organization_members` grants the required role.

## 2. Role model

`public.org_role` enum: `owner`, `admin`, `accountant`, `sales`, `inventory`, `viewer`.

| Endpoint / table action | Required role |
|---|---|
| Read any workspace data | any member |
| Invoices, payments, bills, expenses, journal, accounts, reports | `owner`, `admin`, `accountant` |
| Quotes, purchase orders, customers, vendors, inventory | `owner`, `admin`, `sales` / `inventory` |
| Team invitations | `owner`, `admin` |
| Workspace existence & membership | implicit via RLS (`organization_id` must match a membership row) |

The full, authoritative matrix lives in the RLS policies of `database/schema.sql` (search `has_org_role`).

## 3. Server endpoints

### 3.1 `POST /api/chat` — Freya AI assistant

`src/routes/api/chat.ts`

| Aspect | Detail |
|---|---|
| Auth | `Authorization: Bearer <supabase JWT>`; token verified with `auth.getUser`. Missing/invalid ⇒ **401**. |
| Membership | `organization_members` must contain (`organizationId`, `userId`) — any role ⇒ otherwise **403**. |
| Body | `{ messages: UIMessage[], organizationId: string }` ⇒ **400** otherwise. |
| Response | Server-sent-event stream (AI SDK UI message stream). |
| Grounding | Calls tools (`financial_summary`, `recent_invoices`, `recent_bills`, `inventory_snapshot`, `tax_summary`) **scoped to `organizationId`** via the admin client; all tool output derives from the caller's workspace only. |
| Config | Uses the user's OpenRouter key (Settings → AI) or `AI_API_KEY` (+ optional `AI_BASE_URL`, `AI_MODEL`). Unconfigured ⇒ **500** with a "not configured" message. |

> The admin client is used here because tool queries execute outside RLS; the endpoint therefore re-implements the org isolation check manually (membership test above) before issuing any scoped read.

### 3.2 `inviteMember` — server function (POST)

`src/lib/members.functions.ts`

- Middleware: `requireSupabaseAuth` (Bearer JWT, verified via `auth.getClaims`; context carries a Supabase client that acts **as the caller**, plus the caller's `userId`).
- Input (zod): `{ email: string (email), role: 'admin'|'accountant'|'sales'|'inventory'|'viewer', organization_id: uuid }`.
- Handler:
  1. Reads the caller's `role` from `organization_members` **as the caller (RLS applies)**.
  2. **403-equivalent error** unless role `owner`/`admin` (a viewer or accountant cannot attach others to the workspace — this passes the marketplace "authorization on mutating endpoints" rule).
  3. Resolves the invitee's auth user by email using the admin client (read-only directory lookup).
  4. Inserts the membership row; duplicate ⇒ "Already a member" error.

Errors are surfaced to the UI as thrown messages.

### 3.3 `createOrganization` — server function (POST)

`src/lib/org.functions.ts`

- Validates the Bearer token via the admin client (`auth.getUser`); **401** if absent/invalid.
- Creates the `organizations` row (`created_by` = caller id), inserts the caller as `owner` in `organization_members`, and creates the default inventory location.
- No extra role check is needed by design: creating a workspace grants ownership of that **new** workspace only; it never touches existing data (RLS still governs everything else).

## 4. Notes for security reviewers

- There are **no unauthenticated mutating endpoints**. Public surface: `GET /*` (SSR of the marketing/login pages), Supabase Auth REST endpoints (handled by Supabase), and the endpoints above — all gated by JWT.
- Passwords/JWTs are never stored in the app database; auth state lives in Supabase Auth, application tables only reference user UUIDs (`created_by`, `id` in `profiles`).
- The `/api/chat` tool layer performs **no writes** to any table.
- Attachments (invoices/bills expenses receipts) go through the Supabase Storage bucket `attachments`, whose policies require `organization_id` metadata to match a membership (see storage policy section of `schema.sql`).
- Supabase Key Verification: JWT verification and `auth.getClaims` use the anon-key auth path against the Supabase auth endpoint; the admin key never leaves the server.

## 5. Adding a new server endpoint (conventions)

1. Derive mutations from RLS first — prefer letting PostgREST enforce roles instead of server code.
2. If server code is required, use `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])` and re-verify membership/role **in the handler** — never trust input `organization_id` alone.
3. Use the admin client (`supabaseAdmin`) only inside `src/routes/api/**` or approved function handlers.
