import "server-only";
import { system } from "../db";
import { channelOf } from "./events";
import type { BrowserContext } from "./server";

const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ttclid", "gclid", "landing", "referrer", "first_seen"] as const;

/** Sanitise the browser-reported attribution and merge the request's identifiers. */
export function buildAttribution(raw: unknown, ctx: BrowserContext): Record<string, string> {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of KEYS) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  // Meta's click cookie: build it from fbclid if the pixel was blocked and didn't set one.
  const fbc = ctx.fbc ?? (out.fbclid ? `fb.1.${Date.now()}.${out.fbclid}` : null);
  for (const [k, v] of Object.entries({ fbp: ctx.fbp, fbc, ttp: ctx.ttp, ip: ctx.ip, user_agent: ctx.userAgent?.slice(0, 400), checkout_url: ctx.url?.slice(0, 400) })) if (v) out[k] = v;
  out.channel = channelOf(out);
  return out;
}

export async function saveAttribution(orderId: string, attribution: Record<string, string>) {
  await system((tx) => tx`update public.orders set attribution = ${tx.json(attribution)} where id = ${orderId} and attribution = '{}'::jsonb`).catch(() => {});
}
