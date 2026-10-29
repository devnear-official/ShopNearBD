import { courierFetch, CourierError, type CourierProvider, type CreateResult, type ShipmentStatus } from "./types";

/**
 * Steadfast (Packzy) merchant API. Endpoint paths follow Steadfast's merchant API
 * docs; confirm them in your Steadfast panel (API section) before going live.
 */
const base = () => (process.env.STEADFAST_BASE_URL ?? "https://portal.packzy.com/api/v1").replace(/\/$/, "");
const headers = () => ({ "Api-Key": process.env.STEADFAST_API_KEY ?? "", "Secret-Key": process.env.STEADFAST_SECRET_KEY ?? "", "Content-Type": "application/json", Accept: "application/json" });

export function mapSteadfast(s: string): ShipmentStatus {
  switch (s) {
    case "delivered": case "delivered_approval_pending": return "delivered";
    case "partial_delivered": case "partial_delivered_approval_pending": return "partial_delivered";
    case "cancelled": case "cancelled_approval_pending": return "returned";
    case "hold": case "in_review": case "pending": return "in_transit";
    default: return "in_transit";
  }
}

const result = (c: Record<string, unknown>): CreateResult => ({
  consignmentId: String(c.consignment_id),
  trackingCode: (c.tracking_code as string) ?? null,
  trackingUrl: c.tracking_code ? `https://steadfast.com.bd/t/${c.tracking_code}` : null,
  labelUrl: null,
  status: "created",
  deliveryFee: null,
  raw: c,
});

export const steadfast: CourierProvider = {
  id: "steadfast",
  label: "Steadfast",
  sandbox: false,
  missingConfig: () => ["STEADFAST_API_KEY", "STEADFAST_SECRET_KEY"].filter((k) => !process.env[k]),
  async createShipment(i) {
    const body = await courierFetch(`${base()}/create_order`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({
        invoice: i.invoice, recipient_name: i.recipientName, recipient_phone: i.recipientPhone,
        recipient_address: [i.address, i.area, i.district].filter(Boolean).join(", ").slice(0, 250),
        cod_amount: Math.round(i.codAmount), note: i.note ?? undefined, item_description: i.itemDescription.slice(0, 200), total_lot: i.itemCount,
      }),
    }) as { status?: number; message?: string; consignment?: Record<string, unknown> };
    if (!body?.consignment?.consignment_id) throw new CourierError(`Steadfast rejected the parcel: ${body?.message ?? "no consignment returned"}`, false, 422, body);
    return result(body.consignment);
  },
  async getStatus(cid) {
    const body = await courierFetch(`${base()}/status_by_cid/${encodeURIComponent(cid)}`, { headers: headers() }) as { delivery_status?: string };
    const s = body?.delivery_status ?? "unknown";
    return { status: mapSteadfast(s), providerStatus: s, codCollected: null, raw: body };
  },
  async findByInvoice(invoice) {
    try {
      const body = await courierFetch(`${base()}/status_by_invoice/${encodeURIComponent(invoice)}`, { headers: headers() }) as { delivery_status?: string; consignment_id?: string | number };
      return body?.consignment_id ? { ...result(body as Record<string, unknown>), status: mapSteadfast(body.delivery_status ?? "") } : null;
    } catch (e) {
      if (e instanceof CourierError && e.status === 404) return null;
      throw e;
    }
  },
  parseWebhook(h, raw) {
    const token = process.env.STEADFAST_WEBHOOK_TOKEN;
    if (!token || h.get("authorization") !== `Bearer ${token}`) throw new CourierError("unauthorized", false, 401);
    const b = raw as Record<string, unknown>;
    const s = String(b.status ?? b.delivery_status ?? "");
    return {
      consignmentId: b.consignment_id ? String(b.consignment_id) : null, invoice: (b.invoice as string) ?? null,
      providerStatus: s || String(b.notification_type ?? "update"), status: s ? mapSteadfast(s) : null,
      codCollected: s.startsWith("delivered") || s.startsWith("partial") ? Number(b.cod_amount ?? 0) : null,
      dedupeKey: `steadfast:${b.consignment_id}:${s}:${b.updated_at ?? ""}`, raw,
    };
  },
};
