import "server-only";
import { system } from "./db";

/**
 * SMS gateways used in Bangladesh. Set SMS_PROVIDER and that provider's keys:
 * - bulksmsbd:   BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID   (bulksmsbd.net)
 * - sslwireless: SSL_SMS_API_TOKEN, SSL_SMS_SID            (SSL Wireless SMS Plus)
 * - mram:        MRAM_SMS_API_KEY, MRAM_SMS_SENDER_ID      (msg.mram.com.bd)
 * - console:     development/testing only; nothing is sent, messages go to dev_sms_outbox.
 */
export type SmsProvider = "bulksmsbd" | "sslwireless" | "mram" | "console";
export type SmsResult = { ok: boolean; provider: SmsProvider | "none"; detail?: string };

const devAllowed = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_SMS === "1";

export function smsProvider(): SmsProvider | null {
  const p = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
  if (p === "bulksmsbd" && process.env.BULKSMSBD_API_KEY && process.env.BULKSMSBD_SENDER_ID) return "bulksmsbd";
  if (p === "sslwireless" && process.env.SSL_SMS_API_TOKEN && process.env.SSL_SMS_SID) return "sslwireless";
  if (p === "mram" && process.env.MRAM_SMS_API_KEY && process.env.MRAM_SMS_SENDER_ID) return "mram";
  if (p === "console" && devAllowed()) return "console";
  if (!p && devAllowed() && process.env.NODE_ENV !== "production") return "console";
  return null;
}

const mask = (phone: string) => `${phone.slice(0, 3)}*****${phone.slice(-3)}`;
/** 01712345678 → 8801712345678 (both gateways expect the country code, no plus). */
const msisdn = (phone: string) => `88${phone}`;

async function post(url: string, init: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const text = await r.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    return { status: r.status, json };
  } finally {
    clearTimeout(t);
  }
}

async function deliver(provider: SmsProvider, phone: string, body: string): Promise<SmsResult> {
  if (provider === "console") {
    await system((tx) => tx`insert into public.dev_sms_outbox (phone, body) values (${phone}, ${body})`);
    if (process.env.NODE_ENV !== "production") console.info(`[sms:console] to ${phone}: ${body}`);
    return { ok: true, provider, detail: "dev outbox" };
  }
  if (provider === "bulksmsbd") {
    const base = (process.env.BULKSMSBD_BASE_URL ?? "https://bulksmsbd.net/api").replace(/\/$/, "");
    const r = await post(`${base}/smsapi`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: process.env.BULKSMSBD_API_KEY!, senderid: process.env.BULKSMSBD_SENDER_ID!, number: msisdn(phone), message: body }),
    });
    const code = String(r.json.response_code ?? "");
    return { ok: code === "202", provider, detail: `${code} ${String(r.json.success_message ?? r.json.error_message ?? "")}`.trim().slice(0, 200) };
  }
  if (provider === "sslwireless") {
    const base = (process.env.SSL_SMS_BASE_URL ?? "https://smsplus.sslwireless.com").replace(/\/$/, "");
    const r = await post(`${base}/api/v3/send-sms`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ api_token: process.env.SSL_SMS_API_TOKEN, sid: process.env.SSL_SMS_SID, msisdn: msisdn(phone), sms: body, csms_id: `sn${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` }),
    });
    const ok = r.status >= 200 && r.status < 300 && r.json.status === "SUCCESS";
    return { ok, provider, detail: `${r.json.status_code ?? r.status} ${String(r.json.error_message ?? r.json.status ?? "")}`.trim().slice(0, 200) };
  }
  if (provider === "mram") {
    const base = (process.env.MRAM_SMS_BASE_URL ?? "https://msg.mram.com.bd").replace(/\/$/, "");
    const isUnicode = /[^\x00-\x7f]/.test(body);
    const r = await post(`${base}/smsapi`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: process.env.MRAM_SMS_API_KEY!,
        type: isUnicode ? "unicode" : "text",
        contacts: msisdn(phone),
        senderid: process.env.MRAM_SMS_SENDER_ID!,
        msg: body,
      }),
    });
    const raw = typeof r.json.raw === "string" ? r.json.raw.trim() : JSON.stringify(r.json);
    const isError = /^(100[1-9]|101[0-9]|1020)\b/.test(raw) || (r.json.status && String(r.json.status).toLowerCase() === "failed");
    const ok = r.status >= 200 && r.status < 300 && !isError;
    const errorMap: Record<string, string> = {
      "1002": "Sender Id/Masking Not Found",
      "1003": "API Not Found",
      "1004": "SPAM Detected",
      "1005": "Internal Error",
      "1006": "Internal Error",
      "1007": "Balance Insufficient",
      "1008": "Message is empty",
      "1009": "Message Type Not Set",
      "1010": "Invalid User & Password",
      "1011": "Invalid User Id",
      "1012": "Invalid Number",
      "1013": "API limit error",
      "1014": "No matching template",
      "1015": "SMS Content Validation Fails",
      "1016": "IP address not allowed",
    };
    const detail = isError ? (errorMap[raw] ?? String(r.json.message ?? raw)) : String(r.json.message ?? raw);
    return { ok, provider, detail: detail.slice(0, 200) };
  }
  return { ok: false, provider, detail: "Unsupported provider" };
}

/** Sends one SMS and logs the outcome (never the message text). Never throws. */
export async function sendSms(phone: string, body: string, purpose: string): Promise<SmsResult> {
  const provider = smsProvider();
  if (!provider) return { ok: false, provider: "none", detail: "No SMS gateway configured" };
  let res: SmsResult;
  try {
    res = await deliver(provider, phone, body);
  } catch (e) {
    res = { ok: false, provider, detail: (e as Error).name === "AbortError" ? "timeout" : (e as Error).message.slice(0, 200) };
  }
  await system((tx) => tx`insert into public.sms_log (phone_masked, purpose, provider, status, detail) values (${mask(phone)}, ${purpose}, ${provider}, ${res.ok ? "sent" : "failed"}, ${res.detail ?? null})`).catch(() => {});
  return res;
}
