import { courierFetch, CourierError, type CourierProvider, type ShipmentStatus } from "./types";

/**
 * RedX open API. delivery_area_id is resolved from the district/area names via
 * the areas endpoint. Confirm paths in RedX's developer docs before going live.
 */
const base = () => (process.env.REDX_BASE_URL ?? "https://openapi.redx.com.bd/v1.0.0-beta").replace(/\/$/, "");
const headers = () => ({ "API-ACCESS-TOKEN": `Bearer ${process.env.REDX_API_TOKEN ?? ""}`, "Content-Type": "application/json", Accept: "application/json" });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function mapRedx(s: string): ShipmentStatus {
  const k = s.toLowerCase();
  if (k.includes("delivered")) return "delivered";
  if (k.includes("return")) return "returned";
  if (k.includes("cancel")) return "cancelled";
  if (k.includes("pickup") || k.includes("picked")) return "picked_up";
  return "in_transit";
}

export const redx: CourierProvider = {
  id: "redx",
  label: "RedX",
  sandbox: /sandbox|stage/.test(process.env.REDX_BASE_URL ?? ""),
  missingConfig: () => ["REDX_API_TOKEN"].filter((k) => !process.env[k]),
  async createShipment(i) {
    const areas = ((await courierFetch(`${base()}/areas?district_name=${encodeURIComponent(i.district)}`, { headers: headers() })) as { areas?: { id: number; name: string }[] }).areas ?? [];
    const area = (i.area && areas.find((a) => norm(a.name).includes(norm(i.area!)) || norm(i.area!).includes(norm(a.name)))) || areas[0];
    if (!area) throw new CourierError(`RedX has no delivery area for “${i.district}”.`, false, 422);
    const body = await courierFetch(`${base()}/parcel`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({
        customer_name: i.recipientName, customer_phone: i.recipientPhone, delivery_area: area.name, delivery_area_id: area.id,
        customer_address: i.address.slice(0, 250), merchant_invoice_id: i.invoice, cash_collection_amount: String(Math.round(i.codAmount)),
        parcel_weight: String(Math.round(Math.max(0.5, i.weightKg) * 1000)), instruction: i.note ?? "", value: String(Math.round(i.codAmount)),
      }),
    }) as { tracking_id?: string };
    if (!body?.tracking_id) throw new CourierError("RedX did not return a tracking ID.", false, 422, body);
    return { consignmentId: body.tracking_id, trackingCode: body.tracking_id, trackingUrl: `https://redx.com.bd/track-parcel/?trackingId=${body.tracking_id}`, labelUrl: null, status: "created", deliveryFee: null, raw: body };
  },
  async getStatus(cid) {
    const body = await courierFetch(`${base()}/parcel/track/${encodeURIComponent(cid)}`, { headers: headers() }) as { tracking?: { message_en?: string }[] };
    const s = body?.tracking?.at(-1)?.message_en ?? "unknown";
    return { status: mapRedx(s), providerStatus: s, codCollected: null, raw: body };
  },
  parseWebhook(h, raw, url) {
    const token = process.env.REDX_WEBHOOK_TOKEN;
    if (!token || (url.searchParams.get("token") !== token && h.get("x-webhook-token") !== token)) throw new CourierError("unauthorized", false, 401);
    const b = raw as Record<string, unknown>;
    const s = String(b.status ?? "");
    return {
      consignmentId: b.tracking_number ? String(b.tracking_number) : null, invoice: (b.invoice_number as string) ?? null,
      providerStatus: s, status: s ? mapRedx(s) : null, codCollected: null,
      dedupeKey: `redx:${b.tracking_number}:${s}:${b.timestamp ?? ""}`, raw,
    };
  },
};
