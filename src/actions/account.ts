"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bdPhone } from "@/lib/validation/common";
import { clientIpHash } from "@/lib/rate-limit";
import { getPublicSettings } from "@/lib/catalog";
import { system } from "@/lib/db";
import { currentCustomer, requestOtp, setSessionCookie, signOut, verifyOtp } from "@/lib/customer/auth";

export type CodeResult = { ok: true; phone: string; resendIn: number } | { ok: false; error: string; retryIn?: number };

export async function requestLoginCode(input: { phone: string }): Promise<CodeResult> {
  const p = bdPhone.safeParse(input?.phone ?? "");
  if (!p.success) return { ok: false, error: "Enter a valid Bangladeshi mobile number, e.g. 01712345678" };
  const settings = await getPublicSettings();
  const r = await requestOtp(p.data, await clientIpHash(), settings.store?.name || "ShopNear BD");
  return r.ok ? { ok: true, phone: p.data, resendIn: r.resendIn } : { ok: false, error: r.error, retryIn: r.retryIn };
}

const verifyInput = z.object({ phone: bdPhone, code: z.string().trim(), next: z.string().max(200).optional() });

export async function verifyLoginCode(input: unknown): Promise<{ ok: false; error: string } | { ok: true; next: string }> {
  const p = verifyInput.safeParse(input);
  if (!p.success) return { ok: false, error: "Enter the 6-digit code from the SMS." };
  const r = await verifyOtp(p.data.phone, p.data.code, (await headers()).get("user-agent"));
  if (!r.ok) return r;
  await setSessionCookie(r.token);
  // Only same-site paths, never "//evil.example".
  const next = p.data.next && /^\/(?!\/)[\w\-/?=&%.]*$/.test(p.data.next) ? p.data.next : "/account";
  return { ok: true, next };
}

const profileInput = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email or leave it empty").max(120)]),
});

export async function updateProfile(_: unknown, form: FormData): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const me = await currentCustomer();
  if (!me) return { ok: false, error: "Please log in again." };
  const p = profileInput.safeParse({ name: form.get("name") ?? "", email: form.get("email") ?? "" });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  await system((tx) => tx`update public.customer_accounts set name = ${p.data.name}, email = ${p.data.email || null} where id = ${me.id}`);
  return { ok: true, message: "Saved." };
}

export async function logout() {
  await signOut();
  redirect("/account/login");
}
