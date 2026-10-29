"use client";
import { useEffect } from "react";
import { track } from "@/lib/tracking/client";
import type { EventItem } from "@/lib/tracking/events";

/**
 * Browser-side Purchase, fired once per order on this device. Uses the same
 * event ID as the server-side Conversions API / Events API call
 * (`purchase-<order number>`), so the platforms count it once.
 */
export function PurchasePixel({ orderNumber, value, items, enabled }: { orderNumber: string; value: number; items: EventItem[]; enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const key = `sn_px_${orderNumber}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    // The pixel scripts load after hydration; give them a moment.
    const t = setTimeout(() => {
      track("Purchase", { value, items, orderId: orderNumber }, { eventId: `purchase-${orderNumber}` });
      try { localStorage.setItem(key, "1"); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [orderNumber, value, items, enabled]);
  return null;
}
