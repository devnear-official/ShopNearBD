import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { asUser, system, type Tx } from "./db";
import { supabaseConfigured, supabaseServer } from "./supabase/server";

export type SessionUser = { id: string; email: string | null };
export type AdminContext = SessionUser & { db: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };

/** The signed-in user, verified with Supabase Auth (not just decoded from the cookie). */
export async function currentUser(): Promise<SessionUser | null> {
  if (!supabaseConfigured()) return null;
  // Session checks are always request-time work (never part of a prerendered shell).
  await connection();
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export function userDb(user: SessionUser) {
  return <T,>(fn: (tx: Tx) => Promise<T>) => asUser({ sub: user.id, email: user.email, role: "authenticated" }, fn);
}

async function isAdmin(userId: string) {
  const rows = await system((tx) => tx`select 1 from public.user_roles where user_id = ${userId} and role = 'admin'`);
  return rows.length > 0;
}

/** Admin context or null. Every admin page and action re-checks this on the server. */
export async function getAdmin(): Promise<AdminContext | null> {
  const user = await currentUser();
  if (!user || !(await isAdmin(user.id))) return null;
  return { ...user, db: userDb(user) };
}

/** For pages: redirects to the login screen when not an admin. */
export async function requireAdminPage(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) throw new Error("FORBIDDEN");
  return admin;
}
