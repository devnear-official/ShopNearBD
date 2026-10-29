import { courierFetch, CourierError, type CourierProvider, type ShipmentStatus } from "./types";

/**
 * Pathao Courier merchant API (OAuth password grant). City and zone IDs are
 * resolved from our district/area names. Confirm paths in Pathao's merchant
 * developer docs before going live; use the sandbox base URL to test.
 */
const base = () => (process.env.PATHAO_BASE_URL ?? "https://api-hermes.pathao.com").replace(/\/$/, "");
let token: { value: string; exp: number } | null = null;

async function auth(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const body = await courierFetch(`${base()}/aladdin/api/v1/issue-token`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: process.env.PATHAO_CLIENT_ID, client_secret: process.env.PATHAO_CLIENT_SECRET, username: process.env.PATHAO_USERNAME, password: process.env.PATHAO_PASSWORD, grant_type: "password" }),
  }) as { access_token?: string; expires_in?: number };
  if (!body?.access_token) throw new CourierError("Pathao authentication failed — check the client ID/secret and merchant login.", false, 401);
  token = { value: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}
const authed = async () => ({ Authorization: `Bearer ${await auth()}`, "Content-Type": "application/json", Accept: "application/json" });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

async function resolveLocation(district: string, area: string | null) {
  const h = await authed();
  const cities = ((await courierFetch(`${base()}/aladdin/api/v1/city-list`, { headers: h })) as { data?: { data?: { city_id: number; city_name: string }[] } }).data?.data ?? [];
  const alias: Record<string, string> = { chattogram: "chittagong", cumilla: "comilla", bogura: "bogra", jashore: "jessore", barishal: "barisal" };
  const want = alias[norm(district)] ?? norm(district);
  const city = cities.find((c) => norm(c.city_name) === want || norm(c.city_name) === norm(district));
  if (!city) throw new CourierError(`Pathao has no city matching “${district}”. Book this parcel manually.`, false, 422);
  const zones = ((await courierFetch(`${base()}/aladdin/api/v1/cities/${city.city_id}/zone-list`, { headers: h })) as { data?: { data?: { zone_id: number; zone_name: string }[] } }).data?.data ?? [];
  const zone = (area && zones.find((z) => norm(z.zone_name).includes(norm(area)) || norm(area).includes(norm(z.zone_name)))) || zones.find((z) => norm(z.zone_name) === want);
  if (!zone) throw new CourierError(`Couldn't match a Pathao zone for “${area ?? district}”. Add the thana/area to the order and retry.`, false, 422);
  return { city: city.city_id, zone: zone.zone_id };
}

export function mapPathao(s: string): ShipmentStatus {
  const k = s.toLowerCase();
  if (k.includes("partial")) return "partial_delivered";
  if (k.includes("deliver")) return k.includes("fail") ? "in_transit" : "delivered";
  if (k.includes("return")) return "returned";
  if (k.includes("cancel")) return "cancelled";
  if (k.includes("pick")) return "picked_up";
  return "in_transit";
}

export const pathao: CourierProvider = {
  id: "pathao",
  label: "Pathao Courier",
  sandbox: /sandbox/.test(process.env.PATHAO_BASE_URL ?? ""),
  missingConfig: () => ["PATHAO_CLIENT_ID", "PATHAO_CLIENT_SECRET", "PATHAO_USERNAME", "PATHAO_PASSWORD", "PATHAO_STORE_ID"].filter((k) => !process.env[k]),
  async createShipment(i) {
    const loc = await resolveLocation(i.district, i.area);
    const body = await courierFetch(`${base()}/aladdin/api/v1/orders`, {
      method: "POST", headers: await authed(),
      body: JSON.stringify({
        store_id: Number(process.env.PATHAO_STORE_ID), merchant_order_id: i.invoice, recipient_name: i.recipientName, recipient_phone: i.recipientPhone,
        recipient_address: i.address.slice(0, 220), recipient_city: loc.city, recipient_zone: loc.zone, delivery_type: 48, item_type: 2,
        special_instruction: i.note ?? "", item_quantity: i.itemCount, item_weight: Math.max(0.5, i.weightKg), amount_to_collect: Math.round(i.codAmount), item_description: i.itemDescription.slice(0, 200),
      }),
    }) as { data?: { consignment_id?: string; order_status?: string; delivery_fee?: number } };
    const d = body?.data;
    if (!d?.consignment_id) throw new CourierError("Pathao did not return a consignment ID.", false, 422, body);
    return { consignmentId: d.consignment_id, trackingCode: d.consignment_id, trackingUrl: null, labelUrl: null, status: "created", deliveryFee: d.delivery_fee ?? null, raw: body };
  },
  async getStatus(cid) {
    const body = await courierFetch(`${base()}/aladdin/api/v1/orders/${encodeURIComponent(cid)}/info`, { headers: await authed() }) as { data?: { order_status?: string } };
    const s = body?.data?.order_status ?? "unknown";
    return { status: mapPathao(s), providerStatus: s, codCollected: null, raw: body };
  },
  parseWebhook(h, raw) {
    const secret = process.env.PATHAO_WEBHOOK_SECRET;
    if (!secret || h.get("x-pathao-signature") !== secret) throw new CourierError("unauthorized", false, 401);
    const b = raw as Record<string, unknown>;
    const s = String(b.event ?? b.order_status ?? "");
    return {
      consignmentId: b.consignment_id ? String(b.consignment_id) : null, invoice: (b.merchant_order_id as string) ?? null,
      providerStatus: s, status: s ? mapPathao(s) : null, codCollected: /deliver/i.test(s) && !/fail/i.test(s) ? Number(b.collected_amount ?? b.amount_to_collect ?? 0) || null : null,
      dedupeKey: `pathao:${b.consignment_id}:${s}:${b.updated_at ?? b.timestamp ?? ""}`, raw,
    };
  },
};
