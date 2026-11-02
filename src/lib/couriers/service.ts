import { notifyOrderStatus } from "../order-sms";
import "server-only";
import { system, type Tx } from "../db";
import type { AdminContext } from "../auth";
import { CourierError, getProvider, type ShipmentStatus, type WebhookEvent } from "./index";

const RANK: Record<ShipmentStatus, number> = { pending: 0, failed: 0, created: 1, picked_up: 2, in_transit: 3, partial_delivered: 4, delivered: 4, returned: 4, cancelled: 4 };

type OrderRow = { id: string; order_number: string; status: string; total: number; payment_method: string; payment_status: string; customer_name: string; phone: string; address: string; area: string | null; district: string; delivery_note: string | null };

export async function bookShipment(admin: AdminContext, orderId: string, providerId: string): Promise<{ ok: true; consignmentId: string } | { ok: false; error: string }> {
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, error: "Unknown courier." };
  const missing = provider.missingConfig();
  if (missing.length) return { ok: false, error: `${provider.label} isn't configured. Missing: ${missing.join(", ")}.` };

  // 1. Reserve the order's single active shipment slot (unique partial index).
  let shipmentId: string | undefined;
  let order: OrderRow;
  try {
    const r = await admin.db(async (tx) => {
      const [o] = await tx<OrderRow[]>`select id, order_number, status, total, payment_method, payment_status, customer_name, phone, address, area, district, delivery_note from public.orders where id = ${orderId} for update`;
      if (!o) throw new CourierError("Order not found.", false);
      if (!["confirmed", "packed"].includes(o.status)) throw new CourierError("Only confirmed or packed orders can be booked with a courier.", false);
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from public.shipments where order_id = ${o.id}`;
      const items = await tx<{ quantity: number; product_name: string }[]>`select quantity, product_name from public.order_items where order_id = ${o.id}`;
      const cod = o.payment_method === "cod" && o.payment_status !== "paid" ? Number(o.total) : 0;
      const recipient = { name: o.customer_name, phone: o.phone, address: o.address, area: o.area, district: o.district, items: items.map((i) => `${i.product_name} x${i.quantity}`).join(", ") };
      const [s] = await tx<{ id: string }[]>`
        insert into public.shipments (order_id, provider, is_sandbox, status, idempotency_key, cod_amount, recipient, created_by, attempts)
        values (${o.id}, ${provider.id}, ${provider.sandbox}, 'pending', ${`${o.order_number}:${provider.id}:${n + 1}`}, ${cod}, ${tx.json(recipient)}, ${admin.id}, 1)
        returning id`;
      return { o, sid: s.id, items, cod };
    });
    shipmentId = r.sid;
    const sid = r.sid;
    order = r.o;
    // 2. After an ambiguous earlier failure, adopt a parcel the courier already created.
    const existing = provider.findByInvoice ? await provider.findByInvoice(order.order_number).catch(() => null) : null;
    const created = existing ?? await provider.createShipment({
      invoice: order.order_number, recipientName: order.customer_name, recipientPhone: order.phone, address: order.address, area: order.area,
      district: order.district, codAmount: r.cod, note: order.delivery_note, itemCount: r.items.reduce((a, i) => a + i.quantity, 0),
      itemDescription: r.items.map((i) => `${i.product_name} x${i.quantity}`).join(", "), weightKg: 0.5 * Math.max(1, r.items.length),
    });
    await admin.db(async (tx) => {
      await tx`update public.shipments set status = ${created.status}, consignment_id = ${created.consignmentId}, tracking_code = ${created.trackingCode},
        tracking_url = ${created.trackingUrl}, label_url = ${created.labelUrl}, delivery_fee_charged = ${created.deliveryFee}, response_payload = ${tx.json(created.raw as never)}, last_error = null
        where id = ${sid}`;
      if (order.status === "confirmed") await tx`select public.admin_transition_order(${order.id}, 'packed', ${`Booked with ${provider.label}: ${created.consignmentId}`}, true)`;
      await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${admin.id}, ${admin.email ?? "admin"}, 'shipment.create', 'order', ${order.id}, ${tx.json({ provider: provider.id, consignment: created.consignmentId, adopted: Boolean(existing) })})`;
    });
    return { ok: true, consignmentId: created.consignmentId };
  } catch (e) {
    const err = e instanceof CourierError ? e : null;
    const pg = (e as { code?: string; constraint_name?: string });
    if (pg?.code === "23505") return { ok: false, error: "This order already has an active shipment." };
    if (shipmentId) {
      const sid = shipmentId;
      // Free the slot so the admin can retry; the error is kept for the record.
      await system((tx) => tx`update public.shipments set status = 'failed', last_error = ${(e as Error).message.slice(0, 500)} where id = ${sid}`);
    }
    if (!err) console.error("bookShipment", e);
    return { ok: false, error: err ? `${err.message}${err.retryable ? " You can retry — if the courier panel already shows this order, retrying will reuse it where the courier supports invoice lookup." : ""}` : "Booking failed unexpectedly. Nothing was sent to the courier." };
  }
}

/** Apply a courier status update (webhook, manual sync or sandbox simulation). Idempotent via dedupe key. */
export async function applyCourierEvent(provider: string, ev: WebhookEvent): Promise<{ applied: boolean; reason?: string }> {
  const result = await applyCourierEventTx(provider, ev);
  // After commit: tell the customer (once per event) only about states that are now saved.
  if (result.applied && result.orderId) await notifyOrderStatus(result.orderId);
  return { applied: result.applied, reason: result.reason };
}

async function applyCourierEventTx(provider: string, ev: WebhookEvent): Promise<{ applied: boolean; reason?: string; orderId?: string }> {
  return system(async (tx: Tx) => {
    const [s] = await tx<{ id: string; order_id: string; status: ShipmentStatus; cod_amount: number }[]>`
      select s.id, s.order_id, s.status, s.cod_amount from public.shipments s join public.orders o on o.id = s.order_id
      where s.provider = ${provider} and s.status not in ('failed')
        and (${ev.consignmentId}::text is not null and s.consignment_id = ${ev.consignmentId} or ${ev.consignmentId}::text is null and o.order_number = ${ev.invoice})
      order by s.created_at desc limit 1 for update of s`;
    const [ins] = await tx`insert into public.courier_events (shipment_id, provider, event_type, status, payload, dedupe_key)
      values (${s?.id ?? null}, ${provider}, 'status', ${ev.providerStatus}, ${tx.json(ev.raw as never)}, ${ev.dedupeKey}) on conflict (dedupe_key) do nothing returning id`;
    if (!ins) return { applied: false, reason: "duplicate" };
    if (!s) return { applied: false, reason: "unknown shipment" };
    if (!ev.status || RANK[ev.status] < RANK[s.status]) return { applied: false, reason: "stale or unmapped status" };

    await tx`update public.shipments set status = ${ev.status}, cod_collected = coalesce(${ev.codCollected}, cod_collected) where id = ${s.id}`;
    const [o] = await tx<{ status: string }[]>`select status from public.orders where id = ${s.order_id}`;
    const note = `Courier: ${ev.providerStatus}`;
    if (["picked_up", "in_transit"].includes(ev.status) && ["confirmed", "packed"].includes(o.status)) {
      await tx`select public.system_transition_order(${s.order_id}, 'shipped', ${note})`;
    }
    if (ev.status === "delivered" || ev.status === "partial_delivered") {
      if (["confirmed", "packed"].includes(o.status)) await tx`select public.system_transition_order(${s.order_id}, 'shipped', ${note})`;
      if (o.status !== "delivered") await tx`select public.system_transition_order(${s.order_id}, 'delivered', ${note})`;
      if (ev.codCollected && ev.codCollected > 0 && s.cod_amount > 0) await tx`select public.system_record_cod(${s.order_id}, ${Math.min(ev.codCollected, s.cod_amount)}, ${"Reported by courier"})`;
    }
    if ((ev.status === "returned" || ev.status === "cancelled") && o.status === "shipped") {
      await tx`select public.system_transition_order(${s.order_id}, 'returned', ${note})`;
    }
    return { applied: true, orderId: s.order_id };
  });
}
