"use client";
import { Heart } from "lucide-react";
import clsx from "clsx";
import { parseJsonArray, useStoredValue } from "@/hooks/use-stored-value";

const KEY = "sn_wishlist";

/** Guest wishlist kept on this device (slugs only — nothing personal leaves the browser). */
export function useWishlist() {
  const [slugs, set, hydrated] = useStoredValue<string[]>(KEY, parseJsonArray, []);
  const toggle = (slug: string) => set(JSON.stringify(slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [slug, ...slugs].slice(0, 50)));
  return { slugs, has: (slug: string) => slugs.includes(slug), toggle, hydrated };
}

export function WishlistButton({ slug, name, className, withLabel }: { slug: string; name: string; className?: string; withLabel?: boolean }) {
  const { has, toggle } = useWishlist();
  const saved = has(slug);
  return (
    <button type="button" onClick={() => toggle(slug)} aria-pressed={saved} aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      className={clsx("grid place-items-center rounded-full transition active:scale-90", withLabel ? "h-14 gap-2 px-5 [grid-auto-flow:column] font-semibold ring-1 ring-line hover:bg-cloud" : "size-11 bg-white/90 shadow-md backdrop-blur hover:bg-white", className)}>
      <Heart className={clsx("size-5 transition", saved ? "fill-flame text-flame" : "text-ink")} />
      {withLabel && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
