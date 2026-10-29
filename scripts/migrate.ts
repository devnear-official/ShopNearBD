/**
 * Applies supabase/migrations/*.sql in order to DATABASE_URL, recording each
 * file in app_meta.migrations so it runs once.
 *
 *   npm run db:migrate              # real Supabase (or any Postgres with Supabase roles)
 *   npm run db:migrate -- --dev     # local plain Postgres: applies the dev shim first
 *
 * Hosted Supabase alternative: `supabase db push` with the Supabase CLI.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { loadEnv } from "./env";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const dev = process.argv.includes("--dev");
const sql = postgres(url, { max: 1, onnotice: () => {}, prepare: false });

async function main() {
  if (dev) {
    const shim = fs.readFileSync(path.resolve("supabase/dev/00_supabase_shim.sql"), "utf8");
    await sql.unsafe(shim);
    console.log("applied dev shim");
  }
  await sql.unsafe(`create schema if not exists app_meta;
    create table if not exists app_meta.migrations (name text primary key, applied_at timestamptz not null default now());
    revoke all on schema app_meta from public;`);
  const dir = path.resolve("supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await sql<{ name: string }[]>`select name from app_meta.migrations`).map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into app_meta.migrations (name) values (${f})`;
    });
    console.log("applied", f);
  }
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
