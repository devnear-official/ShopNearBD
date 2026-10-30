"use client";

/**
 * "Into the bag" animation: a copy of the product photo arcs from where the
 * shopper tapped into the header cart, shrinking as it goes, then the cart
 * button bumps. Uses the Web Animations API (no library, ~1 KB) and only
 * animates transform/opacity, so it stays smooth on low-end phones.
 */
export function flyToCart(source: Element | null, imageUrl?: string | null) {
  if (typeof window === "undefined") return;
  const bump = () => window.dispatchEvent(new Event("sn:cart-bump"));
  const target = [...document.querySelectorAll<HTMLElement>("[data-cart-target]")].find((el) => el.getClientRects().length > 0);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!source || !target || reduce || !("animate" in Element.prototype)) return bump();

  // A small optimised copy of the photo (usually already cached), never the full-size original.
  const thumb = imageUrl ? `/_next/image?url=${encodeURIComponent(imageUrl)}&w=256&q=70` : null;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.max(56, Math.min(120, from.width, from.height || from.width));
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const dx = to.left + to.width / 2 - (startX + size / 2);
  const dy = to.top + to.height / 2 - (startY + size / 2);

  // Outer element moves horizontally (steady), inner vertically (eases in) → a natural arc.
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.setAttribute("aria-hidden", "true");
  Object.assign(outer.style, { position: "fixed", left: `${startX}px`, top: `${startY}px`, width: `${size}px`, height: `${size}px`, zIndex: "80", pointerEvents: "none", willChange: "transform" });
  Object.assign(inner.style, {
    width: "100%", height: "100%", borderRadius: "18px", willChange: "transform, opacity",
    background: thumb ? `#fff url("${thumb}") center/cover no-repeat` : "var(--color-electric)",
    boxShadow: "0 18px 40px -12px rgba(11,21,48,.45), 0 0 0 3px #fff",
  });
  outer.appendChild(inner);
  document.body.appendChild(outer);

  const duration = 720;
  outer.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], { duration, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
  const lift = Math.min(120, Math.abs(dy) * 0.35 + 40);
  const flight = inner.animate([
    { transform: "translateY(0) scale(1) rotate(0deg)", opacity: 1 },
    { transform: `translateY(${-lift}px) scale(.85) rotate(-8deg)`, opacity: 1, offset: 0.3 },
    { transform: `translateY(${dy}px) scale(.18) rotate(12deg)`, opacity: 0.5 },
  ], { duration, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
  flight.onfinish = () => { outer.remove(); bump(); };
  flight.oncancel = () => outer.remove();
}
