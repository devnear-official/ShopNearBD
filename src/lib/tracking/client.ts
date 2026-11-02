"use client";
import { GA4_EVENT, RELAYABLE, ga4Params, metaCustomData, tiktokEventName, tiktokProperties, type EventParams, type TrackEvent } from "./events";

type Fbq = (...args: unknown[]) => void;
type Ttq = { track: (name: string, props?: unknown, opts?: unknown) => void; page: () => void; identify: (p: unknown) => void };
declare global {
  interface Window { fbq?: Fbq; ttq?: Ttq; gtag?: (...args: unknown[]) => void; dataLayer?: unknown[]; __snTracking?: { meta: boolean; tiktok: boolean; ga4: boolean; server: boolean; tiktokPurchase: "Purchase" | "CompletePayment" } }
}

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");

export function readAttribution(): Record<string, string> {
  try {
    const a = JSON.parse(localStorage.getItem("sn_attr") ?? "null") as { first?: Record<string, string>; last?: Record<string, string> } | null;
    // Last non-direct touch wins for ad attribution; keep when the visitor first arrived.
    return { ...(a?.last ?? a?.first ?? {}), first_seen: a?.first?.first_seen ?? "" };
  } catch {
    return {};
  }
}

/**
 * Fire a standard event to the Meta and TikTok pixels with one shared event ID,
 * and (for non-purchase events) relay it to our server for the Conversions API /
 * Events API so ad blockers don't lose it. Deduplicated by event ID on both platforms.
 */
function relay(name: TrackEvent, eventId: string, p: EventParams) {
  const attr = readAttribution();
  const payload = JSON.stringify({ event: name, eventId, url: location.href, referrer: document.referrer || undefined, ttclid: attr.ttclid, params: { value: p.value, items: p.items, search: p.search } });
  try {
    if (!navigator.sendBeacon?.("/api/track", payload)) fetch("/api/track", { method: "POST", body: payload, keepalive: true }).catch(() => {});
  } catch {}
}

/** One PageView: browser pixels plus a server copy for Meta (same event ID, so it is counted once). TikTok's page() has no server twin. */
export function trackPageView() {
  const cfg = typeof window !== "undefined" ? window.__snTracking : undefined;
  if (!cfg || (!cfg.meta && !cfg.tiktok)) return;
  const eventId = newId();
  try { if (cfg.meta && window.fbq) window.fbq("track", "PageView", {}, { eventID: eventId }); } catch {}
  try { if (cfg.tiktok && window.ttq) window.ttq.page(); } catch {}
  if (cfg.server && cfg.meta) relay("PageView", eventId, {});
}

export function track(name: TrackEvent, params: EventParams = {}, opts: { eventId?: string } = {}) {
  const cfg = typeof window !== "undefined" ? window.__snTracking : undefined;
  if (!cfg || (!cfg.meta && !cfg.tiktok && !cfg.ga4)) return;
  const eventId = opts.eventId ?? newId();
  const p: EventParams = { currency: "BDT", ...params };
  try {
    if (cfg.meta && window.fbq) window.fbq("track", name, metaCustomData(p), { eventID: eventId });
  } catch {}
  try {
    const tt = tiktokEventName(name, cfg.tiktokPurchase);
    if (cfg.tiktok && window.ttq && tt) window.ttq.track(tt, tiktokProperties(p), { event_id: eventId });
  } catch {}
  try {
    if (cfg.ga4 && window.gtag && name !== "PageView") window.gtag("event", GA4_EVENT[name], ga4Params(p));
  } catch {}
  if ((cfg.meta || cfg.tiktok) && cfg.server && name !== "PageView" && RELAYABLE.includes(name)) relay(name, eventId, p);
}
