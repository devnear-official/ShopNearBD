"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/auth";
import { system } from "@/lib/db";
import { clientIpHash, rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/env";

export type AuthState = { error?: string; message?: string };

export async function adminSignIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(6).max(200) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const ip = await clientIpHash();
  if (!(await rateLimit(`admin-login:${ip}`, 8, 900)) || !(await rateLimit(`admin-login:${parsed.data.email.toLowerCase()}`, 8, 900))) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email or password is incorrect." };
  const admin = await getAdmin();
  if (!admin) {
    await sb.auth.signOut();
    return { error: "This account doesn't have admin access." };
  }
  await system((tx) => tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id) values (${admin.id}, ${admin.email}, 'admin.login', 'user', ${admin.id})`);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin/dashboard");
}

export async function adminSignOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/admin/login");
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email." };
  if (!(await rateLimit(`admin-reset:${await clientIpHash()}`, 3, 3600))) return { error: "Too many requests. Try later." };
  const sb = await supabaseServer();
  await sb.auth.resetPasswordForEmail(email.data, { redirectTo: `${siteUrl()}/admin/settings?tab=account` });
  // Same answer whether or not the account exists.
  return { message: "If that email belongs to an admin, a reset link is on its way." };
}

export async function changePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const admin = await getAdmin();
  if (!admin) return { error: "Please sign in again." };
  const pw = String(form.get("password") ?? "");
  if (pw.length < 10) return { error: "Use at least 10 characters." };
  if (pw !== String(form.get("confirm") ?? "")) return { error: "The passwords don't match." };
  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  await system((tx) => tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id) values (${admin.id}, ${admin.email}, 'admin.password_change', 'user', ${admin.id})`);
  return { message: "Password updated." };
}
