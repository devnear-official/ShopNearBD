"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProductCard as P } from "@/lib/catalog";
import { ProductCard, ProductCardSkeleton } from "@/components/products/product-card";
import { useWishlist } from "@/components/products/wishlist";

export function WishlistView() {
  const { slugs, hydrated } = useWishlist();
  const [items, setItems] = useState<P[] | null>(null);
  const key = slugs.join(",");
  useEffect(() => {
    if (!hydrated || !key) return;
    const ctrl = new AbortController();
    fetch(`/api/products?slugs=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { items: P[] }) => setItems(d.items))
      .catch(() => {});
    return () => ctrl.abort();
  }, [key, hydrated]);

  if (hydrated && !key) return <p className="rounded-[2rem] bg-white p-8 text-slate shadow-[var(--shadow-card)]">Nothing saved yet. Tap the ♡ on any product to keep it here. <Link href="/shop" className="font-semibold text-electric underline">Browse the shop</Link></p>;
  const list = (items ?? []).filter((p) => slugs.includes(p.slug)).sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
      {items === null ? Array.from({ length: Math.max(1, Math.min(slugs.length, 4)) }, (_, i) => <ProductCardSkeleton key={i} />) : list.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
