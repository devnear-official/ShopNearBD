"use server";
import { z } from "zod";
import { asAnon } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { friendlyError } from "@/lib/errors";
import { bdPhone } from "@/lib/validation/common";
import { clientIpHash, rateLimit } from "@/lib/rate-limit";

const access = z.object({ orderNumber: z.string().regex(/^SN\d{11}$/), token: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/) });

export async function submitPaymentLater(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = access.extend({ sender: bdPhone, txid: z.string().trim().regex(/^[A-Za-z0-9]{6,20}$/, "Enter the Transaction ID from the SMS") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  const { orderNumber, token, sender, txid } = parsed.data;
  if (!(await rateLimit(`paylater:${await clientIpHash()}`, 10, 3600))) return { ok: false, error: friendlyError({ message: "RATE_LIMITED" }) };
  try {
    await asAnon((tx) => tx`select public.submit_payment_proof(${orderNumber}, ${sha256(token)}, ${sender}, ${txid}, ${null})`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function submitReview(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = access.extend({
    productId: z.string().uuid(),
    author: z.string().trim().min(2, "Add your name").max(60),
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().max(1500).optional(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the review and try again." };
  const { orderNumber, token, productId, author, rating, body } = parsed.data;
  if (!(await rateLimit(`review:${await clientIpHash()}`, 20, 3600))) return { ok: false, error: friendlyError({ message: "RATE_LIMITED" }) };
  try {
    await asAnon((tx) => tx`select public.submit_review(${orderNumber}, ${sha256(token)}, ${productId}, ${author}, ${rating}, ${body ?? null})`);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message === "REVIEW_NOT_ALLOWED" ? "Reviews open once the order is delivered." : friendlyError(e);
    return { ok: false, error: msg };
  }
}
