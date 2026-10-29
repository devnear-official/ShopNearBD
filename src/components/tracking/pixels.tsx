"use client";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = { metaPixelId: string | null; tiktokPixelId: string | null; server: boolean; tiktokPurchase: "Purchase" | "CompletePayment" };

const CLICK_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ttclid", "gclid"];

/**
 * Loads the Meta and TikTok pixels (only when IDs are configured in
 * Admin → Settings → Tracking), sends PageView on every navigation, and
 * remembers UTM tags / click IDs so orders can be attributed to the ad.
 */
export function Pixels({ metaPixelId, tiktokPixelId, server, tiktokPurchase }: Props) {
  const meta = metaPixelId && /^\d{6,20}$/.test(metaPixelId) ? metaPixelId : null;
  const tiktok = tiktokPixelId && /^[A-Z0-9]{8,30}$/i.test(tiktokPixelId) ? tiktokPixelId : null;
  const path = usePathname();
  const search = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    window.__snTracking = { meta: Boolean(meta), tiktok: Boolean(tiktok), server, tiktokPurchase };
  }, [meta, tiktok, server, tiktokPurchase]);

  // Attribution: keep the first touch and the latest touch that carried campaign data.
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const touch: Record<string, string> = {};
      for (const k of CLICK_KEYS) { const v = params.get(k); if (v) touch[k] = v.slice(0, 300); }
      const stored = JSON.parse(localStorage.getItem("sn_attr") ?? "null") as { first?: Record<string, string>; last?: Record<string, string> } | null;
      const now = new Date().toISOString();
      const external = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer.slice(0, 300) : "";
      if (!stored) {
        localStorage.setItem("sn_attr", JSON.stringify({ first: { ...touch, landing: location.href.slice(0, 300), referrer: external, first_seen: now }, last: Object.keys(touch).length ? { ...touch, landing: location.href.slice(0, 300), referrer: external } : undefined }));
      } else if (Object.keys(touch).length) {
        localStorage.setItem("sn_attr", JSON.stringify({ ...stored, last: { ...touch, landing: location.href.slice(0, 300), referrer: external } }));
      }
      // If the pixel is blocked, still keep Meta's click ID cookie for the Conversions API.
      if (touch.fbclid && !document.cookie.includes("_fbc=")) {
        document.cookie = `_fbc=fb.1.${Date.now()}.${touch.fbclid}; path=/; max-age=${90 * 86400}; SameSite=Lax`;
      }
    } catch {}
  }, [search]);

  // PageView on client-side navigations (the base code sends the first one).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { if (meta) window.fbq?.("track", "PageView"); } catch {}
    try { if (tiktok) window.ttq?.page(); } catch {}
  }, [path, search, meta, tiktok]);

  return (
    <>
      {meta && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`}</Script>
      )}
      {tiktok && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');`}</Script>
      )}
    </>
  );
}
