/** Event vocabulary shared by the browser pixels and the server-side APIs. */
export type TrackEvent = "PageView" | "ViewContent" | "Search" | "AddToCart" | "AddToWishlist" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";
export type EventItem = { id: string; name?: string; quantity: number; price: number; category?: string };
export type EventParams = { value?: number; currency?: "BDT"; items?: EventItem[]; search?: string; orderId?: string };

/** Events the browser may ask the server to relay. Purchase is never relayed: it is sent from trusted order data. */
export const RELAYABLE: TrackEvent[] = ["ViewContent", "Search", "AddToCart", "AddToWishlist", "InitiateCheckout", "AddPaymentInfo"];

export function tiktokEventName(e: TrackEvent, purchaseName: "Purchase" | "CompletePayment" = "Purchase"): string | null {
  if (e === "PageView") return null; // TikTok uses ttq.page()
  if (e === "Purchase") return purchaseName;
  return e;
}

export function metaCustomData(p: EventParams) {
  const items = p.items ?? [];
  return strip({
    currency: p.value !== undefined || items.length ? p.currency ?? "BDT" : undefined,
    value: p.value,
    content_ids: items.length ? items.map((i) => i.id) : undefined,
    contents: items.length ? items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })) : undefined,
    content_type: items.length ? "product" : undefined,
    content_name: items.length === 1 ? items[0].name : undefined,
    content_category: items.length === 1 ? items[0].category : undefined,
    num_items: items.length ? items.reduce((n, i) => n + i.quantity, 0) : undefined,
    search_string: p.search,
    order_id: p.orderId,
  });
}

export function tiktokProperties(p: EventParams) {
  const items = p.items ?? [];
  return strip({
    currency: p.value !== undefined || items.length ? p.currency ?? "BDT" : undefined,
    value: p.value,
    contents: items.length ? items.map((i) => strip({ content_id: i.id, content_type: "product", content_name: i.name, content_category: i.category, quantity: i.quantity, price: i.price })) : undefined,
    content_type: items.length ? "product" : undefined,
    query: p.search,
    order_id: p.orderId,
  });
}

function strip<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as T;
}

/** Classify where a visitor came from, for order attribution. */
export function channelOf(a: { utm_source?: string; fbclid?: string; ttclid?: string; gclid?: string; referrer?: string }): string {
  const src = (a.utm_source ?? "").toLowerCase();
  const ref = (a.referrer ?? "").toLowerCase();
  if (a.fbclid || /facebook|^fb|instagram|^ig|meta|messenger/.test(src) || /facebook\.com|instagram\.com|messenger\.com|fb\.me/.test(ref)) return "facebook";
  if (a.ttclid || /tiktok/.test(src) || /tiktok\.com/.test(ref)) return "tiktok";
  if (a.gclid || /google/.test(src) || /google\./.test(ref)) return "google";
  if (src) return src.slice(0, 40);
  if (ref) return "referral";
  return "direct";
}
