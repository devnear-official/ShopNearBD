import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { asUser, sql, type Tx } from "./db";
import { supabaseConfigured, supabaseServer } from "./supabase/server";

export type SessionUser = { id: string; email: string | null };
export type AdminContext = SessionUser & { db: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };

/**
 * The signed-in user.
 * Pages read the identity from the verified JWT claims (signature + expiry checked locally against the
 * project's signing keys — no round trip to Supabase Auth). The proxy has already confirmed the session
 * with Supabase Auth for this navigation, and the admin role below is always read from the database.
 * Server actions pass `strong` and always ask Supabase Auth, so a revoked session cannot change data.
 */
export async function currentUser(strong = false): Promise<SessionUser | null> {
  if (!supabaseConfigured()) return null;
  // Session checks are always request-time work (never part of a prerendered shell).
  await connection();
  const sb = await supabaseServer();
  if (!strong) {
    const { data } = await sb.auth.getClaims();
    const c = data?.claims;
    if (c?.sub) return { id: c.sub, email: typeof c.email === "string" ? c.email : null };
  }
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export function userDb(user: SessionUser) {
  return <T,>(fn: (tx: Tx) => Promise<T>) => asUser({ sub: user.id, email: user.email, role: "authenticated" }, fn);
}

async function isAdmin(userId: string) {
  // One plain query (no BEGIN/COMMIT round trips).
  const rows = await sql()`select 1 from public.user_roles where user_id = ${userId} and role = 'admin'`;
  return rows.length > 0;
}

async function resolveAdmin(strong: boolean): Promise<AdminContext | null> {
  const user = await currentUser(strong);
  if (!user || !(await isAdmin(user.id))) return null;
  return { ...user, db: userDb(user) };
}

// Layout, nav and page all ask — only the first one does the work within a request.
const adminForRequest = cache(() => resolveAdmin(false));

/** Admin context or null. Every admin page and action re-checks this on the server. */
export async function getAdmin(): Promise<AdminContext | null> {
  return adminForRequest();
}

/** For pages: redirects to the login screen when not an admin. */
export async function requireAdminPage(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = await resolveAdmin(true);
  if (!admin) throw new Error("FORBIDDEN");
  return admin;
}
