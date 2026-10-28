/**
 * One-time admin bootstrap (trusted, server-side):
 *   1. creates the ADMIN_EMAIL user in Supabase Auth with ADMIN_PASS (or finds it),
 *   2. grants the 'admin' role in public.user_roles.
 * The password is sent only to Supabase Auth (which hashes it) and never logged.
 * After it succeeds, delete ADMIN_PASS from your environment and sign in normally
 * at /admin/login. Change the password from /admin/settings → Account.
 *
 *   npm run admin:bootstrap
 */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { loadEnv } from "./env";

loadEnv();
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, ADMIN_EMAIL: email, ADMIN_PASS: pass, DATABASE_URL: db } = process.env;

async function main() {
  if (!url || !key || !db) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL");
  if (!email) throw new Error("Set ADMIN_EMAIL");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | undefined;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    if (!pass || pass.length < 10) throw new Error("ADMIN_PASS must be at least 10 characters to create the admin user");
    const { data, error } = await supabase.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { full_name: "Store admin" } });
    if (error) throw error;
    userId = data.user.id;
    console.log(`created auth user ${email}`);
  } else {
    console.log(`auth user ${email} already exists — not changing its password`);
  }

  const sql = postgres(db, { max: 1, prepare: false, onnotice: () => {} });
  await sql`insert into public.profiles (id, full_name) values (${userId}, 'Store admin') on conflict (id) do nothing`;
  await sql`insert into public.user_roles (user_id, role) values (${userId}, 'admin') on conflict do nothing`;
  await sql`insert into public.audit_logs (actor_label, action, entity, entity_id, data) values ('bootstrap', 'admin.grant', 'user', ${userId}, ${sql.json({ email })})`;
  await sql.end();
  console.log("admin role granted. Remove ADMIN_PASS from your environment now.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
