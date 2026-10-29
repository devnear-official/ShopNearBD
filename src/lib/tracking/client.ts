"use client";
import { RELAYABLE, metaCustomData, tiktokEventName, tiktokProperties, type EventParams, type TrackEvent } from "./events";

type Fbq = (...args: unknown[]) => void;
type Ttq = { track: (name: string, props?: unknown, opts?: unknown) => void; page: () => void; identify: (p: unknown) => void };
declare global {
  interface Window { fbq?: Fbq; ttq?: Ttq; __snTracking?: { meta: boolean; tiktok: boolean; server: boolean; tiktokPurchase: "Purchase" | "CompletePayment" } }
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
export function track(name: TrackEvent, params: EventParams = {}, opts: { eventId?: string } = {}) {
  const cfg = typeof window !== "undefined" ? window.__snTracking : undefined;
  if (!cfg || (!cfg.meta && !cfg.tiktok)) return;
  const eventId = opts.eventId ?? newId();
  const p: EventParams = { currency: "BDT", ...params };
  try {
    if (cfg.meta && window.fbq) window.fbq("track", name, metaCustomData(p), { eventID: eventId });
  } catch {}
  try {
    const tt = tiktokEventName(name, cfg.tiktokPurchase);
    if (cfg.tiktok && window.ttq && tt) window.ttq.track(tt, tiktokProperties(p), { event_id: eventId });
  } catch {}
  if (cfg.server && RELAYABLE.includes(name)) {
    const attr = readAttribution();
    const payload = JSON.stringify({ event: name, eventId, url: location.href, referrer: document.referrer || undefined, ttclid: attr.ttclid, params: { value: p.value, items: p.items, search: p.search } });
    try {
      if (!navigator.sendBeacon?.("/api/track", payload)) fetch("/api/track", { method: "POST", body: payload, keepalive: true }).catch(() => {});
    } catch {}
  }
}
