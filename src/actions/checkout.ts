"use server";
import { z } from "zod";
import { asAnon } from "@/lib/db";
import { checkoutSchema, cartLines } from "@/lib/validation/checkout";
import { bdPhone } from "@/lib/validation/common";
import { friendlyError, dbErrorCode } from "@/lib/errors";
import { randomToken, sha256 } from "@/lib/tokens";
import { clientIpHash, rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { after } from "next/server";
import { requestContext, sendPurchase, trackingConfig } from "@/lib/tracking/server";
import { buildAttribution, saveAttribution } from "@/lib/tracking/attribution";

export type QuoteLine = { variant_id: string; sku?: string; product_id: string; slug: string; name: string; variant_name: string; unit_price: number; quantity: number; line_total: number; stock: number; image_url: string | null };
export type Quote = {
  lines: QuoteLine[]; subtotal: number; discount: number; total: number;
  shipping: { zone: string; fee: number; label: string; eta: string | null } | null;
  issues: { variant_id?: string; issue: string; available?: number }[];
};

const quoteInput = z.object({
  items: cartLines,
  district: z.string().max(40).optional(),
  zone: z.string().max(40).optional(),
  couponCode: z.string().trim().max(32).optional(),
  phone: z.string().max(20).optional(),
});

/** Prices every line from the database. The browser's numbers are never used. */
export async function quoteCart(input: z.input<typeof quoteInput>): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
  const parsed = quoteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Your cart looks invalid. Please refresh the page." };
  const { items, district, zone, couponCode, phone } = parsed.data;
  const normalizedPhone = phone ? bdPhone.safeParse(phone) : null;
  try {
    const [row] = await asAnon((tx) => tx<{ q: Quote }[]>`
      select public.quote_cart(${tx.json({
        items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
        district: district || null,
        zone: zone || null,
        coupon_code: couponCode || null,
        phone: normalizedPhone?.success ? normalizedPhone.data : null,
      })}) as q`);
    const q = row.q;
    return {
      ok: true,
      quote: {
        ...q,
        subtotal: Number(q.subtotal), discount: Number(q.discount), total: Number(q.total),
        shipping: q.shipping ? { ...q.shipping, fee: Number(q.shipping.fee) } : null,
        lines: q.lines.map((l) => ({ ...l, unit_price: Number(l.unit_price), line_total: Number(l.line_total) })),
      },
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; token: string; total: number }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const { items, delivery, payment, couponCode, idempotencyKey, accessToken, proofPath, attribution } = parsed.data;

  const ip = await clientIpHash();
  if (!(await rateLimit(`checkout:ip:${ip}`, 8, 600)) || !(await rateLimit(`checkout:phone:${delivery.phone}`, 6, 3600))) {
    return { ok: false, error: friendlyError({ message: "RATE_LIMITED" }), code: "RATE_LIMITED" };
  }

  // Only the hash of the customer's order secret is stored.
  const token = accessToken;
  const payload = {
    idempotency_key: idempotencyKey,
    access_token_hash: sha256(token),
    ip_hash: ip,
    customer: {
      name: delivery.name, phone: delivery.phone, email: delivery.email || null, address: delivery.address,
      district: delivery.district, zone: delivery.zone || null, area: delivery.area || null, note: delivery.note || null,
    },
    items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    payment:
      payment.method === "cod" || payment.payLater
        ? { method: payment.method }
        : { method: payment.method, sender_number: bdPhone.parse(payment.senderNumber ?? ""), transaction_id: payment.transactionId?.trim(), proof_path: proofPath ?? null },
    coupon_code: couponCode || null,
  };

  try {
    const [row] = await asAnon((tx) => tx<{ r: { order_id: string; order_number: string; total: number; duplicate: boolean } }[]>`select public.place_order(${tx.json(payload)}) as r`);
    if (row.r.duplicate) {
      // A retried submit: hand back the original order only if this browser holds its secret.
      const [own] = await asAnon((tx) => tx<{ o: unknown }[]>`select public.get_order_public(${row.r.order_number}, ${sha256(token)}) as o`);
      if (!own.o) return { ok: false, error: "This checkout was already used. Please refresh the page.", code: "DUPLICATE" };
    }
    if (!row.r.duplicate) {
      // Ads attribution + server-side Purchase (after the response, so checkout stays fast).
      const ctx = await requestContext();
      const attr = buildAttribution(attribution, ctx);
      await saveAttribution(row.r.order_id, attr);
      const orderId = row.r.order_id;
      after(async () => {
        const cfg = await trackingConfig();
        if (cfg.purchaseTrigger === "placed") await sendPurchase(orderId, { ...ctx, ttclid: attr.ttclid ?? null, referrer: attr.referrer ?? null });
      });
    }
    return { ok: true, orderNumber: row.r.order_number, token, total: Number(row.r.total) };
  } catch (e) {
    const code = dbErrorCode(e) ?? undefined;
    if (!code) console.error("placeOrder failed", e);
    return { ok: false, error: friendlyError(e, "We couldn't place your order. Please try again."), code };
  }
}

const proofTypes = ["image/jpeg", "image/png", "image/webp"];

/** Optional payment screenshot → private bucket. Returns the object path for the order. */
export async function uploadPaymentProof(form: FormData): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an image." };
  if (!proofTypes.includes(file.type)) return { ok: false, error: "Upload a JPG, PNG or WebP screenshot." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, error: "The screenshot must be under 3 MB." };
  const ip = await clientIpHash();
  if (!(await rateLimit(`proof:ip:${ip}`, 6, 3600))) return { ok: false, error: friendlyError({ message: "RATE_LIMITED" }) };
  try {
    const ext = file.type.split("/")[1];
    const path = `${new Date().toISOString().slice(0, 10)}/${randomToken(12)}.${ext}`;
    const { error } = await supabaseAdmin().storage.from("payment-proofs").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (error) throw error;
    return { ok: true, path };
  } catch (e) {
    console.error("proof upload failed", e);
    return { ok: false, error: "Upload failed. You can still enter the Transaction ID instead." };
  }
}
