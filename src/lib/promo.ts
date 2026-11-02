/** Shared by hero banners and ticker items: where a promotion points. Pure, so it runs anywhere. */
export const LINK_TYPES = ["product", "category", "deals", "campaign", "custom"] as const;
export type LinkType = (typeof LINK_TYPES)[number];
export const LINK_LABEL: Record<LinkType, string> = {
  product: "A product (enter its slug)",
  category: "A category (enter its slug)",
  deals: "Deals & discounts page",
  campaign: "A campaign / collection (enter its slug)",
  custom: "Custom link (/path or https://…)",
};
export const TICKER_KINDS = ["offer", "discount", "flash_deal", "ad", "announcement"] as const;
export type TickerKind = (typeof TICKER_KINDS)[number];
export const TICKER_KIND_LABEL: Record<TickerKind, string> = { offer: "Offer", discount: "Discount", flash_deal: "Flash deal", ad: "Advertisement", announcement: "Announcement" };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A custom link must be a site path or an https URL — never javascript:, data:, or protocol-relative. */
export function isSafeCustomLink(v: string): boolean {
  if (v.startsWith("/")) return !v.startsWith("//") && !v.includes("\\");
  try { return new URL(v).protocol === "https:"; } catch { return false; }
}

/** Returns an href, or null when the stored target is missing or unsafe (the item then renders unlinked). */
export function resolveLink(type: string, target: string | null | undefined): string | null {
  const t = (target ?? "").trim();
  switch (type) {
    case "product": return SLUG.test(t) ? `/shop/${t}` : null;
    case "category": return SLUG.test(t) ? `/shop?category=${t}` : null;
    case "campaign": return SLUG.test(t) ? `/shop?collection=${t}` : null;
    case "deals": return "/shop?sort=discount";
    case "custom": return isSafeCustomLink(t) ? t : null;
    default: return null;
  }
}

/** Validates the target for a given type (admin forms). Returns an error message or null. */
export function validateTarget(type: LinkType, target: string): string | null {
  if (type === "deals") return null;
  if (!target) return "Enter where this should link to.";
  if (type === "custom") return isSafeCustomLink(target) ? null : "Custom links must start with / or https://";
  return SLUG.test(target) ? null : "Use a slug like “summer-sale” (lowercase letters, numbers, dashes).";
}
