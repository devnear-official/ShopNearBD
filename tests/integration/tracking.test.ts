import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { asRole, orderPayload, sql, variantBySku } from "../support/db";
import { startMockAds } from "../support/mock-ads";

const skip = process.env.NO_TEST_DB === "1";
let mock: Awaited<ReturnType<typeof startMockAds>>;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

beforeAll(async () => {
  if (skip) return;
  mock = await startMockAds();
  process.env.META_GRAPH_BASE = mock.url;
  process.env.TIKTOK_API_BASE = mock.url;
  process.env.META_PIXEL_ID = "123456789012345";
  process.env.TIKTOK_PIXEL_ID = "CTEST12345ABC";
  process.env.META_CAPI_ACCESS_TOKEN = "meta-token";
  process.env.TIKTOK_EVENTS_ACCESS_TOKEN = "tt-token";
});
afterAll(async () => {
  for (const k of ["META_GRAPH_BASE", "TIKTOK_API_BASE", "META_PIXEL_ID", "TIKTOK_PIXEL_ID", "META_CAPI_ACCESS_TOKEN", "TIKTOK_EVENTS_ACCESS_TOKEN"]) delete process.env[k];
  await mock?.close();
  await sql.end();
});
beforeEach(() => { if (mock) mock.requests.length = 0; });

async function placeOrder() {
  const v = await variantBySku("PWR-GAN-65-STD");
  const [r] = await asRole("anon", {}, (tx) => tx<{ r: { order_id: string; order_number: string; total: number } }[]>`select public.place_order(${tx.json(orderPayload([{ variant_id: v.id, quantity: 2 }], { customer: { name: "Karim Ahmed", phone: "01812345678", email: "karim@example.com", address: "House 1, Road 2, Uttara", district: "Dhaka", zone: "inside_dhaka" } }) as never)}) as r`);
  return r.r;
}

describe.skipIf(skip)("server-side ad events", () => {
  it("sends Purchase once to Meta and TikTok with hashed data, DB total and the shared event ID", async () => {
    const { sendPurchase } = await import("@/lib/tracking/server");
    const { buildAttribution, saveAttribution } = await import("@/lib/tracking/attribution");
    const o = await placeOrder();
    await saveAttribution(o.order_id, buildAttribution({ utm_source: "facebook", fbclid: "CLICK1", ttclid: "TT1" }, { ip: "103.1.2.3", userAgent: "Mozilla/5.0 test", fbp: "fb.1.1.1", fbc: null, ttp: "ttpcookie", ttclid: null, url: "https://shop.example/checkout", referrer: null }));

    const results = await sendPurchase(o.order_id);
    expect(results.map((r) => `${r.platform}:${r.status}`).sort()).toEqual(["meta:sent", "tiktok:sent"]);

    const meta = mock.requests.find((r) => r.platform === "meta")!;
    expect(meta.url).toBe("/v26.0/123456789012345/events?access_token=meta-token");
    const me = (meta.body.data as Record<string, Record<string, unknown>>[])[0];
    expect(me).toMatchObject({ event_name: "Purchase", event_id: `purchase-${o.order_number}`, action_source: "website", event_source_url: "https://shop.example/checkout" });
    expect(me.custom_data).toMatchObject({ currency: "BDT", value: Number(o.total), content_ids: ["PWR-GAN-65-STD"], num_items: 2, order_id: o.order_number });
    expect(me.user_data).toMatchObject({ ph: [sha("8801812345678")], em: [sha("karim@example.com")], fn: [sha("karim")], ln: [sha("ahmed")], client_ip_address: "103.1.2.3", client_user_agent: "Mozilla/5.0 test", fbp: "fb.1.1.1" });
    expect(me.user_data.fbc).toMatch(/\.CLICK1$/);
    expect(JSON.stringify(meta.body)).not.toContain("01812345678");

    const tt = mock.requests.find((r) => r.platform === "tiktok")!;
    expect(tt.url).toBe("/open_api/v1.3/event/track/");
    expect(tt.headers["access-token"]).toBe("tt-token");
    expect(tt.body).toMatchObject({ event_source: "web", event_source_id: "CTEST12345ABC" });
    const te = (tt.body.data as Record<string, Record<string, unknown>>[])[0];
    expect(te).toMatchObject({ event: "Purchase", event_id: `purchase-${o.order_number}` });
    expect(te.user).toMatchObject({ phone: sha("+8801812345678"), ttp: "ttpcookie", ttclid: "TT1", ip: "103.1.2.3" });
    expect(te.properties).toMatchObject({ currency: "BDT", value: Number(o.total), order_id: o.order_number });

    // Idempotent: a second call (e.g. confirm after place) sends nothing.
    mock.requests.length = 0;
    expect(await sendPurchase(o.order_id)).toEqual([]);
    expect(mock.requests).toHaveLength(0);

    // Logged, and raw IP / user agent removed from the order afterwards.
    const logged = await sql<{ platform: string; status: string }[]>`select platform, status from public.tracking_events where order_id = ${o.order_id} order by platform`;
    expect(logged).toEqual([{ platform: "meta", status: "sent" }, { platform: "tiktok", status: "sent" }]);
    const [{ attribution }] = await sql<{ attribution: Record<string, string> }[]>`select attribution from public.orders where id = ${o.order_id}`;
    expect(attribution).not.toHaveProperty("ip");
    expect(attribution).not.toHaveProperty("user_agent");
    expect(attribution.channel).toBe("facebook");
  });

  it("records platform errors without throwing", async () => {
    const { sendServerEvent } = await import("@/lib/tracking/server");
    mock.failNext(2);
    const res = await sendServerEvent({ name: "AddToCart", eventId: "atc-fail-1", context: { ip: null, userAgent: null, fbp: null, fbc: null, ttp: null, ttclid: null, url: null, referrer: null }, params: { value: 10, items: [{ id: "X", quantity: 1, price: 10 }] } });
    expect(res.map((r) => r.status)).toEqual(["failed", "failed"]);
    expect(res[0].detail).toContain("Invalid OAuth");
    const rows = await sql<{ status: string }[]>`select status from public.tracking_events where event_id = 'atc-fail-1'`;
    expect(rows).toHaveLength(2);
  });

  it("skips platforms without a token and respects the server-events switch", async () => {
    const { sendServerEvent, trackingConfig } = await import("@/lib/tracking/server");
    const cfg = await trackingConfig();
    const res = await sendServerEvent({ name: "ViewContent", eventId: "vc-1", context: { ip: null, userAgent: null, fbp: null, fbc: null, ttp: null, ttclid: null, url: null, referrer: null }, params: {} }, { ...cfg, tiktokToken: null });
    expect(res.find((r) => r.platform === "tiktok")?.status).toBe("skipped");
    expect(mock.requests.map((r) => r.platform)).toEqual(["meta"]);
    expect(await sendServerEvent({ name: "ViewContent", eventId: "vc-2", context: { ip: null, userAgent: null, fbp: null, fbc: null, ttp: null, ttclid: null, url: null, referrer: null }, params: {} }, { ...cfg, serverEvents: false })).toEqual([]);
  });
});
