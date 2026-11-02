import "server-only";
import { createHmac } from "node:crypto";
import { system } from "../db";
import { appSecret, siteUrl } from "../env";
import { safeEqual, sha256 } from "../tokens";
import { ownOrderHash } from "./auth";

/**
 * Three ways to prove you may open an order (an order number alone never works):
 *  1. `t`  — the private token from the confirmation page (only its hash is stored),
 *  2. `s`  — a signed link: HMAC(APP_SECRET, order number). SMS messages carry this, because the
 *            raw token cannot be recovered after checkout. 132 bits, unguessable, not derivable from the number,
 *  3. a signed-in customer session whose phone matches the order.
 */
const SIG = /^[A-Za-z0-9_-]{22}$/;
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export const trackSig = (orderNumber: string) => createHmac("sha256", appSecret()).update(`track:${orderNumber}`).digest("base64url").slice(0, 22);
export const trackUrl = (orderNumber: string) => `${siteUrl()}/order/${orderNumber}?s=${trackSig(orderNumber)}`;
export const invoicePath = (orderNumber: string, via: { t?: string | null; s?: string | null }) =>
  `/order/${orderNumber}/invoice${via.t ? `?t=${encodeURIComponent(via.t)}` : via.s ? `?s=${via.s}` : ""}`;

/** Returns the order's access-token hash if the requester proved access, else null. */
export async function resolveOrderHash(orderNumber: string, via: { t?: string | null; s?: string | null }): Promise<string | null> {
  if (!/^SN\d{11}$/.test(orderNumber)) return null;
  if (via.t && TOKEN.test(via.t)) return sha256(via.t);
  if (via.s && SIG.test(via.s)) {
    if (!safeEqual(via.s, trackSig(orderNumber))) return null;
    const [o] = await system((tx) => tx<{ h: string }[]>`select access_token_hash as h from public.orders where order_number = ${orderNumber}`);
    return o?.h ?? null;
  }
  return ownOrderHash(orderNumber);
}
