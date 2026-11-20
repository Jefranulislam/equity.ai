// Regenerates database/schema.sql from supabase/migrations/*.sql.
//
//   bun run db:schema          -> rewrite database/schema.sql
//   bun run db:schema --check  -> exit 1 if schema.sql is out of date (CI)
//
// schema.sql is the concatenation of every migration in filename (timestamp)
// order, so the "fresh install" path and the "migrations" path can never drift.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = "supabase/migrations";
// Repo layout: ./database. Submission archive layout: Project/ next to ../database.
const OUT = existsSync("database") ? "database/schema.sql" : "../database/schema.sql";

const HEADER = `-- =============================================================================
-- Equity.AI - Database schema (creates the database from scratch)
-- =============================================================================
-- GENERATED FILE - do not edit by hand. Source: supabase/migrations/*.sql in
-- filename order. Regenerate with:  bun run db:schema
--
-- HOW TO RUN:
--   Supabase:      Open the SQL Editor and paste this whole file, then run it.
--   Plain psql:    psql "$DATABASE_URL" -f database/schema.sql
--                  (requires a Supabase-compatible Postgres: the schema
--                  references auth.users, auth.uid() and the storage schema,
--                  which exist in every Supabase project.)
--
-- Use this file for a FRESH database only. To upgrade an existing database,
-- apply just the migrations you have not run yet (see HowToSetup.md).
-- After this script, optionally run database/seed.sql to create demo data.
-- =============================================================================
`;

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let out = HEADER;
for (const f of files) {
  const sql = readFileSync(join(MIGRATIONS, f), "utf8")
    .replace(/^﻿/, "") // strip UTF-8 BOM some editors add
    .replace(/\r\n/g, "\n")
    .trimEnd();
  out += `\n\n-- =============================================================================\n-- Migration: ${f}\n-- =============================================================================\n\n${sql}\n`;
}

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== out) {
    console.error(`[db:schema] ${OUT} is out of date. Run: bun run db:schema`);
    process.exit(1);
  }
  console.log(`[db:schema] ${OUT} is up to date (${files.length} migrations).`);
} else {
  writeFileSync(OUT, out);
  console.log(`[db:schema] wrote ${OUT} from ${files.length} migrations.`);
}
