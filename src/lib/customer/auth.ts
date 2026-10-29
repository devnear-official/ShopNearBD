import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { system } from "../db";
import { appSecret } from "../env";
import { randomToken, safeEqual, sha256 } from "../tokens";
import { rateLimit } from "../rate-limit";
import { sendSms, smsProvider } from "../sms";

export const SESSION_COOKIE = "sn_session";
const SESSION_DAYS = 60;
const CODE_MINUTES = 5;
const MAX_ATTEMPTS = 5;

const codeHash = (phone: string, code: string) => sha256(`otp:${phone}:${code}:${appSecret()}`);
export const accountsAvailable = () => smsProvider() !== null;

export type Account = { id: string; phone: string; name: string | null; email: string | null; verified_at: Date | null; created_at: Date };

/** Creates the (unverified) account for a phone that just ordered. Idempotent. */
export async function ensureAccount(phone: string, name: string | null) {
  await system((tx) => tx`insert into public.customer_accounts (phone, name, created_via) values (${phone}, ${name}, 'order')
    on conflict (phone) do update set name = coalesce(public.customer_accounts.name, excluded.name)`).catch(() => {});
}

export type OtpRequest = { ok: true; resendIn: number } | { ok: false; error: string; code: "RATE_LIMITED" | "UNAVAILABLE" | "COOLDOWN" | "SEND_FAILED"; retryIn?: number };

/**
 * Sends a 6-digit login code. Limits: one code per phone per 60 s, 5 per phone
 * per hour, 10 per IP per hour and 300 store-wide per hour (caps SMS spend if
 * someone tries to abuse the form).
 */
export async function requestOtp(phone: string, ip: string, storeName: string): Promise<OtpRequest> {
  if (!accountsAvailable()) return { ok: false, code: "UNAVAILABLE", error: "Login by SMS isn't set up yet. You can still track orders from the link we gave you." };
  const [last] = await system((tx) => tx<{ age: number }[]>`select extract(epoch from now() - created_at)::int as age from public.customer_otps where phone = ${phone} order by id desc limit 1`);
  if (last && last.age < 60) return { ok: false, code: "COOLDOWN", error: "We just sent a code. Please wait a moment before asking again.", retryIn: 60 - last.age };
  if (!(await rateLimit(`otp:phone:${phone}`, 5, 3600)) || !(await rateLimit(`otp:ip:${ip}`, 10, 3600)) || !(await rateLimit("otp:global", 300, 3600))) {
    return { ok: false, code: "RATE_LIMITED", error: "Too many code requests. Please try again later." };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await system((tx) => tx`insert into public.customer_otps (phone, code_hash, expires_at, ip_hash) values (${phone}, ${codeHash(phone, code)}, now() + ${`${CODE_MINUTES} minutes`}::interval, ${ip})`);
  const sms = await sendSms(phone, `${code} is your ${storeName} login code. Valid for ${CODE_MINUTES} minutes. Never share it with anyone.`, "login_otp");
  if (!sms.ok) return { ok: false, code: "SEND_FAILED", error: "We couldn't send the SMS right now. Please try again in a minute." };
  return { ok: true, resendIn: 60 };
}

export type OtpVerify = { ok: true; token: string; account: Account } | { ok: false; error: string };

/** Checks the latest unused code for the phone. Wrong guesses count; 5 wrong guesses burn the code. */
export async function verifyOtp(phone: string, code: string, userAgent: string | null): Promise<OtpVerify> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code from the SMS." };
  if (!(await rateLimit(`otp:verify:${phone}`, 15, 3600))) return { ok: false, error: "Too many attempts. Please request a new code later." };
  return system(async (tx) => {
    const [otp] = await tx<{ id: number; code_hash: string; attempts: number; expired: boolean }[]>`
      select id, code_hash, attempts, expires_at < now() as expired from public.customer_otps
      where phone = ${phone} and consumed_at is null order by id desc limit 1 for update`;
    if (!otp || otp.expired || otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "This code has expired. Please request a new one." } as const;
    if (!safeEqual(otp.code_hash, codeHash(phone, code))) {
      await tx`update public.customer_otps set attempts = attempts + 1 where id = ${otp.id}`;
      const left = MAX_ATTEMPTS - otp.attempts - 1;
      return { ok: false, error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "That code isn't right. Please request a new one." } as const;
    }
    await tx`update public.customer_otps set consumed_at = now() where id = ${otp.id}`;
    const [account] = await tx<Account[]>`
      insert into public.customer_accounts (phone, created_via, verified_at, last_login_at) values (${phone}, 'login', now(), now())
      on conflict (phone) do update set verified_at = coalesce(public.customer_accounts.verified_at, now()), last_login_at = now()
      returning id, phone, name, email, verified_at, created_at`;
    const token = randomToken(32);
    await tx`insert into public.customer_sessions (account_id, token_hash, user_agent, expires_at)
      values (${account.id}, ${sha256(token)}, ${userAgent?.slice(0, 300) ?? null}, now() + ${`${SESSION_DAYS} days`}::interval)`;
    return { ok: true, token, account } as const;
  });
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
}

/** The signed-in customer for this request, or null. */
export async function currentCustomer(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{30,80}$/.test(token)) return null;
  const [row] = await system((tx) => tx<Account[]>`
    with s as (update public.customer_sessions set last_seen_at = now() where token_hash = ${sha256(token)} and expires_at > now() returning account_id)
    select a.id, a.phone, a.name, a.email, a.verified_at, a.created_at from public.customer_accounts a join s on s.account_id = a.id`);
  return row ?? null;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await system((tx) => tx`delete from public.customer_sessions where token_hash = ${sha256(token)}`).catch(() => {});
  jar.delete(SESSION_COOKIE);
}

/** For a signed-in customer: the stored access hash of their own order (phone must match), else null. */
export async function ownOrderHash(orderNumber: string): Promise<string | null> {
  const me = await currentCustomer();
  if (!me) return null;
  const [o] = await system((tx) => tx<{ h: string }[]>`select access_token_hash as h from public.orders where order_number = ${orderNumber} and phone = ${me.phone}`);
  return o?.h ?? null;
}
