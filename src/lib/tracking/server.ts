import "server-only";
import { cookies, headers } from "next/headers";
import { system } from "../db";
import { hashedIdentity } from "./hash";
import { metaCustomData, tiktokEventName, tiktokProperties, type EventParams, type TrackEvent } from "./events";

export type TrackingConfig = {
  metaPixelId: string | null; tiktokPixelId: string | null; purchaseTrigger: "placed" | "confirmed"; tiktokPurchaseEvent: "Purchase" | "CompletePayment";
  serverEvents: boolean; metaToken: string | null; metaTestCode: string | null; tiktokToken: string | null; tiktokTestCode: string | null;
};

/** Settings from Admin → Settings → Tracking; environment variables override the stored tokens. */
export async function trackingConfig(): Promise<TrackingConfig> {
  const rows = await system((tx) => tx<{ key: string; value: Record<string, string | boolean> }[]>`select key, value from public.site_settings where key in ('tracking', 'tracking_secrets')`);
  const t = rows.find((r) => r.key === "tracking")?.value ?? {};
  const s = rows.find((r) => r.key === "tracking_secrets")?.value ?? {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    metaPixelId: str(process.env.META_PIXEL_ID) ?? str(t.meta_pixel_id),
    tiktokPixelId: str(process.env.TIKTOK_PIXEL_ID) ?? str(t.tiktok_pixel_id),
    purchaseTrigger: t.purchase_trigger === "confirmed" ? "confirmed" : "placed",
    tiktokPurchaseEvent: t.tiktok_purchase_event === "CompletePayment" ? "CompletePayment" : "Purchase",
    serverEvents: t.server_events !== false,
    metaToken: str(process.env.META_CAPI_ACCESS_TOKEN) ?? str(s.meta_access_token),
    metaTestCode: str(process.env.META_TEST_EVENT_CODE) ?? str(s.meta_test_event_code),
    tiktokToken: str(process.env.TIKTOK_EVENTS_ACCESS_TOKEN) ?? str(s.tiktok_access_token),
    tiktokTestCode: str(process.env.TIKTOK_TEST_EVENT_CODE) ?? str(s.tiktok_test_event_code),
  };
}

/** Browser context for server events: IP, user agent and the platforms' first-party cookies. */
export type BrowserContext = { ip: string | null; userAgent: string | null; fbp: string | null; fbc: string | null; ttp: string | null; ttclid: string | null; url: string | null; referrer: string | null };

export async function requestContext(): Promise<BrowserContext> {
  const h = await headers();
  const c = await cookies();
  return {
    ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null,
    userAgent: h.get("user-agent"),
    fbp: c.get("_fbp")?.value ?? null,
    fbc: c.get("_fbc")?.value ?? null,
    ttp: c.get("_ttp")?.value ?? null,
    ttclid: null,
    url: h.get("referer"),
    referrer: null,
  };
}

export type ServerEvent = {
  name: TrackEvent; eventId: string; eventTime?: number; context: BrowserContext; params: EventParams; orderId?: string | null;
  customer?: { phone?: string | null; email?: string | null; name?: string | null; district?: string | null };
};

type Result = { platform: "meta" | "tiktok"; status: "sent" | "failed" | "skipped"; httpStatus?: number; detail?: string };

async function post(url: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...extraHeaders }, body: JSON.stringify(body), signal: ctrl.signal, cache: "no-store" });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: r.status, json };
  } finally {
    clearTimeout(t);
  }
}

async function sendMeta(cfg: TrackingConfig, e: ServerEvent): Promise<Result> {
  if (!cfg.metaPixelId || !cfg.metaToken) return { platform: "meta", status: "skipped", detail: "Meta pixel ID or Conversions API token not set" };
  const id = hashedIdentity(e.customer ?? {});
  const user_data = Object.fromEntries(Object.entries({
    ...id.meta,
    client_ip_address: e.context.ip ?? undefined,
    client_user_agent: e.context.userAgent ?? undefined,
    fbp: e.context.fbp ?? undefined,
    fbc: e.context.fbc ?? undefined,
  }).filter(([, v]) => v !== undefined));
  const base = (process.env.META_GRAPH_BASE ?? "https://graph.facebook.com").replace(/\/$/, "");
  const version = process.env.META_GRAPH_VERSION ?? "v26.0";
  const body = {
    data: [{
      event_name: e.name, event_time: e.eventTime ?? Math.floor(Date.now() / 1000), event_id: e.eventId, action_source: "website",
      event_source_url: e.context.url ?? undefined, user_data, custom_data: metaCustomData(e.params),
    }],
    ...(cfg.metaTestCode ? { test_event_code: cfg.metaTestCode } : {}),
  };
  try {
    const r = await post(`${base}/${version}/${cfg.metaPixelId}/events?access_token=${encodeURIComponent(cfg.metaToken)}`, body);
    const ok = r.status === 200 && Number(r.json.events_received ?? 0) >= 1;
    const err = (r.json.error as { message?: string } | undefined)?.message;
    return { platform: "meta", status: ok ? "sent" : "failed", httpStatus: r.status, detail: ok ? `events_received=${r.json.events_received}` : (err ?? JSON.stringify(r.json)).slice(0, 300) };
  } catch (err) {
    return { platform: "meta", status: "failed", detail: (err as Error).name === "AbortError" ? "timeout" : (err as Error).message.slice(0, 300) };
  }
}

async function sendTikTok(cfg: TrackingConfig, e: ServerEvent): Promise<Result> {
  const name = tiktokEventName(e.name, cfg.tiktokPurchaseEvent);
  if (!name) return { platform: "tiktok", status: "skipped", detail: "no TikTok equivalent" };
  if (!cfg.tiktokPixelId || !cfg.tiktokToken) return { platform: "tiktok", status: "skipped", detail: "TikTok pixel ID or Events API token not set" };
  const id = hashedIdentity(e.customer ?? {});
  const user = Object.fromEntries(Object.entries({
    ...id.tiktok, ip: e.context.ip ?? undefined, user_agent: e.context.userAgent ?? undefined, ttp: e.context.ttp ?? undefined, ttclid: e.context.ttclid ?? undefined,
  }).filter(([, v]) => v !== undefined));
  const base = (process.env.TIKTOK_API_BASE ?? "https://business-api.tiktok.com").replace(/\/$/, "");
  const body = {
    event_source: "web", event_source_id: cfg.tiktokPixelId, ...(cfg.tiktokTestCode ? { test_event_code: cfg.tiktokTestCode } : {}),
    data: [{ event: name, event_time: e.eventTime ?? Math.floor(Date.now() / 1000), event_id: e.eventId, user, page: { url: e.context.url ?? undefined, referrer: e.context.referrer ?? undefined }, properties: tiktokProperties(e.params) }],
  };
  try {
    const r = await post(`${base}/open_api/v1.3/event/track/`, body, { "Access-Token": cfg.tiktokToken });
    const ok = r.status === 200 && Number(r.json.code) === 0;
    return { platform: "tiktok", status: ok ? "sent" : "failed", httpStatus: r.status, detail: String(r.json.message ?? JSON.stringify(r.json)).slice(0, 300) };
  } catch (err) {
    return { platform: "tiktok", status: "failed", detail: (err as Error).name === "AbortError" ? "timeout" : (err as Error).message.slice(0, 300) };
  }
}

/** Send one event to every configured platform and record the outcome. Never throws. */
export async function sendServerEvent(e: ServerEvent, cfg?: TrackingConfig): Promise<Result[]> {
  try {
    const conf = cfg ?? (await trackingConfig());
    if (!conf.serverEvents) return [];
    const results = await Promise.all([sendMeta(conf, e), sendTikTok(conf, e)]);
    // PageView is high-volume: only its failures are worth a log row.
    const logged = results.filter((r) => (r.status !== "skipped" || e.name === "Purchase") && (e.name !== "PageView" || r.status === "failed"));
    if (logged.length) {
      await system((tx) => tx`insert into public.tracking_events ${tx(logged.map((r) => ({
        platform: r.platform, event_name: e.name, event_id: e.eventId, order_id: e.orderId ?? null, status: r.status, http_status: r.httpStatus ?? null,
        detail: r.detail ?? null, test_mode: Boolean(r.platform === "meta" ? conf.metaTestCode : conf.tiktokTestCode),
      })) as never)}`).catch(() => {});
    }
    return results;
  } catch (err) {
    console.error("tracking", err);
    return [];
  }
}

export const purchaseEventId = (orderNumber: string) => `purchase-${orderNumber}`;

/**
 * Server-side Purchase from the order as stored in the database (trusted
 * amounts). Sent at most once per order, guarded by orders.purchase_tracked_at.
 */
export async function sendPurchase(orderId: string, live?: BrowserContext): Promise<Result[]> {
  type Row = { id: string; order_number: string; total: number; customer_name: string; phone: string; email: string | null; district: string; attribution: Record<string, string>; created_at: Date };
  const [o] = await system((tx) => tx<Row[]>`
    update public.orders set purchase_tracked_at = now() where id = ${orderId} and purchase_tracked_at is null
    returning id, order_number, total, customer_name, phone, email, district, attribution, created_at`);
  if (!o) return [];
  const items = await system((tx) => tx<{ sku: string; product_name: string; quantity: number; unit_price: number }[]>`select sku, product_name, quantity, unit_price from public.order_items where order_id = ${orderId}`);
  const a = o.attribution ?? {};
  const context: BrowserContext = live ?? { ip: a.ip ?? null, userAgent: a.user_agent ?? null, fbp: a.fbp ?? null, fbc: a.fbc ?? null, ttp: a.ttp ?? null, ttclid: a.ttclid ?? null, url: a.checkout_url ?? null, referrer: a.referrer ?? null };
  if (live && a.ttclid) context.ttclid = a.ttclid;
  const age = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 1000);
  const results = await sendServerEvent({
    name: "Purchase",
    eventId: purchaseEventId(o.order_number),
    // Meta rejects events older than 7 days; use the order time when it is recent enough.
    eventTime: age < 6 * 86400 ? Math.floor(new Date(o.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
    context,
    orderId: o.id,
    customer: { phone: o.phone, email: o.email, name: o.customer_name, district: o.district },
    params: { value: Number(o.total), currency: "BDT", orderId: o.order_number, items: items.map((i) => ({ id: i.sku, name: i.product_name, quantity: i.quantity, price: Number(i.unit_price) })) },
  });
  // The raw IP and user agent were only kept for this event; drop them now.
  await system((tx) => tx`update public.orders set attribution = attribution - 'ip' - 'user_agent' where id = ${o.id}`).catch(() => {});
  return results;
}
