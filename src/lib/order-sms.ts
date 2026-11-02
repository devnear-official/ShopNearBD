import "server-only";
import { system } from "./db";
import { sendSms } from "./sms";
import { trackUrl } from "./customer/order-access";

export const SMS_EVENTS = ["placed", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"] as const;
export type SmsEvent = (typeof SMS_EVENTS)[number];

export const SMS_EVENT_LABEL: Record<SmsEvent, string> = {
  placed: "Order received", confirmed: "Order confirmed", processing: "Processing", shipped: "Shipped",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
};

/** Placeholders: {name} {order} {link}. The link is always appended last, so every message ends with it. */
export const DEFAULT_TEMPLATES: Record<SmsEvent, string> = {
  placed: "ShopNear BD: Hi {name}, we received your order {order}.",
  confirmed: "ShopNear BD: Your order {order} is confirmed.",
  processing: "ShopNear BD: Your order {order} is being processed.",
  shipped: "ShopNear BD: Your order {order} has been shipped.",
  out_for_delivery: "ShopNear BD: Your order {order} is out for delivery today.",
  delivered: "ShopNear BD: Your order {order} was delivered. Thank you!",
  cancelled: "ShopNear BD: Your order {order} was cancelled.",
};

export type SmsTemplates = Record<SmsEvent, string>;

export async function smsTemplates(): Promise<{ templates: SmsTemplates; enabled: Record<SmsEvent, boolean> }> {
  const [row] = await system((tx) => tx<{ value: { templates?: Partial<SmsTemplates>; disabled?: SmsEvent[] } }[]>`select value from public.site_settings where key = 'sms_templates'`);
  const t = row?.value?.templates ?? {};
  const off = new Set(row?.value?.disabled ?? []);
  return {
    templates: Object.fromEntries(SMS_EVENTS.map((e) => [e, (typeof t[e] === "string" && t[e]!.trim()) || DEFAULT_TEMPLATES[e]])) as SmsTemplates,
    enabled: Object.fromEntries(SMS_EVENTS.map((e) => [e, !off.has(e)])) as Record<SmsEvent, boolean>,
  };
}

/** Message text: template + dynamic Track Order link. Names are trimmed so the SMS stays short. */
export function renderSms(template: string, v: { name: string; order: string; link: string }): string {
  const first = v.name.trim().split(/\s+/)[0]?.slice(0, 20) || "there";
  const body = template.replace(/\{name\}/g, first).replace(/\{order\}/g, v.order).replace(/\{link\}/g, "").replace(/\s+/g, " ").trim();
  return `${body} Track: ${v.link}`;
}

type OrderRow = { id: string; order_number: string; status: string; phone: string; customer_name: string };

/**
 * Sends the SMS for one event, at most once per (order, event). Call it AFTER the change is saved:
 * the message is only sent if the database really is in the state it announces.
 * Never throws; the outcome is stored in order_sms for the admin.
 */
export async function notifyOrderEvent(orderId: string, event: SmsEvent): Promise<"sent" | "failed" | "skipped" | "duplicate"> {
  try {
    const [o] = await system((tx) => tx<OrderRow[]>`select id, order_number, status, phone, customer_name from public.orders where id = ${orderId}`);
    if (!o) return "skipped";

    // Verify the announced state is real.
    let verified: boolean;
    if (event === "placed") verified = true;
    else if (event === "processing" || event === "out_for_delivery") {
      const [u] = await system((tx) => tx<{ n: number }[]>`select count(*)::int as n from public.order_updates where order_id = ${orderId} and stage = ${event}`);
      verified = u.n > 0 && !["cancelled", "returned"].includes(o.status);
    } else verified = o.status === event;
    const { templates, enabled } = await smsTemplates();
    if (!verified || !enabled[event]) return "skipped";

    // Claim the slot. A concurrent or repeated call finds the row and stops (unless a previous attempt failed).
    const claim = await system((tx) => tx<{ id: number }[]>`
      insert into public.order_sms (order_id, event) values (${orderId}, ${event})
      on conflict (order_id, event) do update set status = 'pending'
        where public.order_sms.status = 'failed' and public.order_sms.attempts < 3
      returning id`);
    if (!claim.length) return "duplicate";

    const text = renderSms(templates[event], { name: o.customer_name, order: o.order_number, link: trackUrl(o.order_number) });
    const res = await sendSms(o.phone, text, `order_${event}`);
    await system((tx) => tx`update public.order_sms set status = ${res.ok ? "sent" : "failed"}, provider = ${res.provider}, detail = ${res.detail ?? null},
      attempts = attempts + 1, sent_at = ${res.ok ? new Date() : null} where id = ${claim[0].id}`);
    return res.ok ? "sent" : "failed";
  } catch (e) {
    console.error("notifyOrderEvent", event, (e as Error).message);
    return "failed";
  }
}

/** After any status change: announce the status the order is now in (if it has an SMS). */
export async function notifyOrderStatus(orderId: string) {
  const [o] = await system((tx) => tx<{ status: string }[]>`select status from public.orders where id = ${orderId}`);
  if (o && (SMS_EVENTS as readonly string[]).includes(o.status) && o.status !== "placed") await notifyOrderEvent(orderId, o.status as SmsEvent);
}
