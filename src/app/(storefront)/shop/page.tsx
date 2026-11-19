import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCategories, listProducts } from "@/lib/catalog";
import { parseShopParams, shopHref, type ShopSearchParams } from "@/lib/shop-params";
import { ProductGrid, ProductGridSkeleton, Pagination } from "@/components/products/product-grid";
import { ShopFilters } from "@/components/products/shop-filters";
import { Streaks } from "@/components/ui/streaks";
import { TrackSearch } from "@/components/tracking/track-search";

export const metadata: Metadata = {
  title: "Shop all products",
  description: "Browse gadgets, home appliances, bags and lifestyle essentials with Cash on Delivery across Bangladesh.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-8 sm:pt-6">
      <header className="relative mb-2.5 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-electric/10 px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-electric">
                <Streaks className="h-2 w-4" /> The whole shop
              </span>
              <span className="bn text-xs text-slate font-medium" lang="bn">সব পণ্য এক জায়গায়</span>
            </div>
            <h1 className="font-display mt-1 text-xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Everything, <span className="text-gradient">nearby.</span>
            </h1>
          </div>
        </div>
      </header>
      <Suspense fallback={<><div className="h-28" /><ProductGridSkeleton /></>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  const query = parseShopParams(await searchParams);
  const [{ items, total, pageSize }, categories] = await Promise.all([listProducts({ ...query, pageSize: 12 }), getCategories()]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cat = categories.find((c) => c.slug === query.category);

  return (
    <>
      <ShopFilters query={query} categories={categories} total={total} />
      {query.q && <TrackSearch q={query.q} results={total} />}
      {cat && (
        <div
          className="mb-2 mt-3 rounded-2xl px-4 py-2.5 sm:mb-4 sm:mt-6 sm:rounded-[2rem] sm:p-6 text-white shadow-sm transition-all"
          style={{ background: cat.accent ?? "#1E6BFF" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-extrabold sm:text-2xl">
                <span>{cat.name}</span>
                {cat.name_bn && (
                  <span className="bn text-xs font-medium text-white/85 sm:text-lg" lang="bn">
                    ({cat.name_bn})
                  </span>
                )}
              </h2>
              {cat.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-white/85 sm:mt-1 sm:line-clamp-none sm:text-sm">
                  {cat.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="mt-3 sm:mt-6">
        {items.length ? (
          <ProductGrid items={items} featureFirst={query.page === 1 && !query.q && !query.sort} />
        ) : (
          <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-20 text-center shadow-[var(--shadow-card)]">
            <Streaks className="h-10 w-20" />
            <h2 className="display mt-6 t-sub">Nothing matches — yet</h2>
            <p className="mt-2 max-w-sm text-slate">Try a different word, widen the price range, or browse all products.</p>
            <Link href="/shop" className="mt-6 rounded-full bg-ink px-6 py-3 font-semibold text-white">Clear filters</Link>
          </div>
        )}
      </div>
      <Pagination page={query.page} pages={pages} href={(p) => shopHref(query, { page: p })} />
    </>
  );
}
