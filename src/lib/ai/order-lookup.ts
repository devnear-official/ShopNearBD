import "server-only";
import { asAnon, system } from "../db";
import { rateLimit } from "../rate-limit";
import { sha256, safeEqual } from "../tokens";
import { normalizeBdPhone } from "../validation/common";
import { trackSig, trackUrl, invoicePath } from "../customer/order-access";
import { siteUrl } from "../env";
import { CUSTOMER_STATUS, METHOD_LABEL, PAYMENT_STATUS } from "../order-status";
import { formatDateTime, formatTaka } from "../format";

/**
 * Order-status answers for the chat assistant. Facts come only from the database through get_order_public;
 * the wording is built here, not by the language model, so a status, date or tracking ID can never be invented.
 *
 * Who may see an order (an order number alone never counts):
 *  - "owner": this browser holds the order's private token, or the signed-in customer's phone matches.
 *    They get the signed Track Order link and the invoice link.
 *  - "phone": the customer typed the phone number used on the order. Enough to explain the status, but
 *    phone numbers are not secret, so no private link is given — only the generic Track Order page.
 *  Everything else gets one neutral message, whether the order exists or not.
 */
const ORDER_RE = /\bSN\d{11}\b/gi;
export const extractOrderNumbers = (t: string) => [...new Set((t.match(ORDER_RE) ?? []).map((n) => n.toUpperCase()))].slice(0, 3);
export const extractPhones = (t: string) => [...new Set((t.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).match(/(?:\+?88)?01[3-9][\s-]?\d{2}[\s-]?\d{6}|(?:\+?88)?01[3-9]\d{8}/g) ?? []).map(normalizeBdPhone).filter((p) => /^01[3-9]\d{8}$/.test(p)))];

type Pub = {
  order_number: string; status: string; payment_status: string; payment_method: string; total: number; created_at: string; delivered_at: string | null; updated_at: string;
  updates: { stage: string; message: string | null; at: string }[];
  shipment: { provider: string; courier_name: string | null; status: string; tracking_code: string | null; tracking_url: string | null } | null;
};
type Level = "owner" | "phone";

export type OrderAnswer = { text: string };

async function authorize(number: string, ctx: { tokens: { number: string; token: string }[]; customerPhone: string | null; phones: string[]; ipHash: string }): Promise<{ level: Level; hash: string } | null> {
  const [o] = await system((tx) => tx<{ h: string; phone: string }[]>`select access_token_hash as h, phone from public.orders where order_number = ${number}`);
  if (!o) return null;
  const t = ctx.tokens.find((x) => x.number === number && /^[A-Za-z0-9_-]{20,128}$/.test(x.token));
  if (t && safeEqual(sha256(t.token), o.h)) return { level: "owner", hash: o.h };
  if (ctx.customerPhone && ctx.customerPhone === o.phone) return { level: "owner", hash: o.h };
  if (ctx.phones.includes(o.phone)) return { level: "phone", hash: o.h };
  return null;
}

export async function answerOrderQuestion(input: { text: string; recentUserText: string; tokens: { number: string; token: string }[]; customerPhone: string | null; ipHash: string; bangla: boolean }): Promise<OrderAnswer> {
  const { bangla } = input;
  const numbers = extractOrderNumbers(input.recentUserText);
  const site = siteUrl();
  const generic = `${site}/order`;
  const tr = (en: string, bn: string) => (bangla ? bn : en);

  // No number typed: use the orders this browser or account already proves it owns.
  const targets = numbers.length ? numbers : input.tokens.map((t) => t.number).filter((n) => /^SN\d{11}$/.test(n)).slice(0, 3);
  if (!targets.length) {
    return { text: tr(
      `I can look up your order. Please send your order number (it looks like SN12345678901) and the phone number you ordered with.\n\nTrack Order: ${generic}`,
      `আপনার অর্ডার দেখে দিতে পারব। অনুগ্রহ করে অর্ডার নম্বর (যেমন SN12345678901) এবং অর্ডারে ব্যবহৃত ফোন নম্বর পাঠান।\n\nঅর্ডার ট্র্যাক করুন: ${generic}`) };
  }
  // Guess protection: only attempts that need the phone check are limited tightly.
  if (!(await rateLimit(`chat:orderlookup:${input.ipHash}`, 12, 3600))) {
    return { text: tr(`Too many order lookups from this connection. Please try again later or use Track Order: ${generic}`, `অনেকবার অর্ডার খোঁজা হয়েছে। পরে আবার চেষ্টা করুন বা এখানে দেখুন: ${generic}`) };
  }
  const ctx = { tokens: input.tokens, customerPhone: input.customerPhone, phones: extractPhones(input.recentUserText), ipHash: input.ipHash };
  const parts: string[] = [];
  let needVerify = false;
  for (const number of targets) {
    const auth = await authorize(number, ctx);
    if (!auth) { needVerify = true; continue; }
    const [row] = await asAnon((tx) => tx<{ o: Pub | null }[]>`select public.get_order_public(${number}, ${auth.hash}) as o`);
    if (!row?.o) { needVerify = true; continue; }
    parts.push(describe(row.o, auth.level, bangla));
  }
  if (needVerify) {
    parts.push(tr(
      `I couldn't verify one of those orders. For privacy I need the order number together with the phone number it was placed with (or sign in to your account).\n\nTrack Order: ${generic}`,
      `একটি অর্ডার যাচাই করা যায়নি। নিরাপত্তার জন্য অর্ডার নম্বরের সাথে অর্ডারে ব্যবহৃত ফোন নম্বর লাগবে (অথবা আপনার অ্যাকাউন্টে লগইন করুন)।\n\nঅর্ডার ট্র্যাক করুন: ${generic}`));
  }
  return { text: parts.join("\n\n") };
}

function describe(o: Pub, level: Level, bangla: boolean): string {
  const tr = (en: string, bn: string) => (bangla ? bn : en);
  const st = CUSTOMER_STATUS[o.status] ?? CUSTOMER_STATUS.pending;
  const pay = PAYMENT_STATUS[o.payment_status]?.label ?? o.payment_status;
  const lines: string[] = [];
  lines.push(tr(`Order ${o.order_number} — ${st.label}`, `অর্ডার ${o.order_number} — ${st.bn}`));
  lines.push(`${st.detail}`);
  const latest = [...o.updates].reverse().find((u) => u.stage !== "info" || u.message);
  if (latest) lines.push(tr(`Latest update from our team: ${latest.stage === "out_for_delivery" ? "Out for delivery" : latest.stage === "processing" ? "Processing" : "Note"}${latest.message ? ` — “${latest.message}”` : ""} (${formatDateTime(latest.at)})`, `আমাদের সর্বশেষ আপডেট: ${latest.stage === "out_for_delivery" ? "ডেলিভারির জন্য বের হয়েছে" : latest.stage === "processing" ? "প্রসেসিং চলছে" : "বার্তা"}${latest.message ? ` — “${latest.message}”` : ""} (${formatDateTime(latest.at)})`));
  lines.push(tr(`Payment: ${METHOD_LABEL[o.payment_method] ?? o.payment_method} · ${pay} · Total ${formatTaka(o.total)}`, `পেমেন্ট: ${METHOD_LABEL[o.payment_method] ?? o.payment_method} · ${pay} · মোট ${formatTaka(o.total)}`));
  if (o.shipment) {
    const c = o.shipment.courier_name || (o.shipment.provider === "sandbox" ? "Courier (test mode)" : o.shipment.provider);
    lines.push(tr(`Courier: ${c}${o.shipment.tracking_code ? ` · Tracking ID ${o.shipment.tracking_code}` : ""}${o.shipment.tracking_url ? ` · [courier tracking](${o.shipment.tracking_url})` : ""}`, `কুরিয়ার: ${c}${o.shipment.tracking_code ? ` · ট্র্যাকিং আইডি ${o.shipment.tracking_code}` : ""}${o.shipment.tracking_url ? ` · [কুরিয়ার ট্র্যাকিং](${o.shipment.tracking_url})` : ""}`));
    lines.push(tr("I don't have a live parcel location; the courier link above shows what the courier reports.", "পার্সেলের লাইভ লোকেশন আমার কাছে নেই; উপরের কুরিয়ার লিংকে কুরিয়ারের তথ্য দেখতে পাবেন।"));
  } else if (!["delivered", "cancelled", "returned"].includes(o.status)) {
    lines.push(tr("No courier has been assigned yet, so there is no tracking number.", "এখনো কোনো কুরিয়ার নির্ধারণ হয়নি, তাই ট্র্যাকিং নম্বর নেই।"));
  }
  if (o.delivered_at) lines.push(tr(`Delivered on ${formatDateTime(o.delivered_at)}.`, `ডেলিভারি হয়েছে ${formatDateTime(o.delivered_at)}।`));
  lines.push(tr(`Last updated: ${formatDateTime(o.updated_at)}`, `সর্বশেষ আপডেট: ${formatDateTime(o.updated_at)}`));
  if (level === "owner") {
    lines.push(tr(`Invoice (PDF): ${site(invoicePath(o.order_number, { s: trackSig(o.order_number) }))}`, `ইনভয়েস (PDF): ${site(invoicePath(o.order_number, { s: trackSig(o.order_number) }))}`));
    lines.push(tr(`Track Order: ${trackUrl(o.order_number)}`, `অর্ডার ট্র্যাক করুন: ${trackUrl(o.order_number)}`));
  } else {
    lines.push(tr(`For the invoice and full details, sign in or open your private order link.\nTrack Order: ${site("/order")}`, `ইনভয়েস ও বিস্তারিত দেখতে লগইন করুন বা প্রাইভেট অর্ডার লিংক খুলুন।\nঅর্ডার ট্র্যাক করুন: ${site("/order")}`));
  }
  return lines.join("\n");
}
const site = (p: string) => `${siteUrl()}${p}`;
