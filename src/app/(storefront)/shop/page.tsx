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
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-8">
      <header className="relative mb-6">
        <p className="eyebrow flex items-center gap-3 text-electric"><Streaks className="h-3.5 w-7" /> The whole shop</p>
        <h1 className="display mt-3 text-[clamp(3rem,10vw,7rem)]">Everything, <span className="text-gradient">nearby.</span></h1>
        <p className="bn mt-2 text-lg text-slate" lang="bn">সব পণ্য এক জায়গায়</p>
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
        <div className="mb-2 mt-6 rounded-[2rem] p-6 text-white" style={{ background: cat.accent ?? "#1E6BFF" }}>
          <h2 className="display text-4xl">{cat.name} {cat.name_bn && <span className="bn ml-2 text-2xl font-semibold opacity-80" lang="bn">{cat.name_bn}</span>}</h2>
          {cat.description && <p className="mt-2 max-w-xl text-white/85">{cat.description}</p>}
        </div>
      )}
      <div className="mt-6">
        {items.length ? (
          <ProductGrid items={items} featureFirst={query.page === 1 && !query.q && !query.sort} />
        ) : (
          <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-20 text-center shadow-[var(--shadow-card)]">
            <Streaks className="h-10 w-20" />
            <h2 className="display mt-6 text-3xl">Nothing matches — yet</h2>
            <p className="mt-2 max-w-sm text-slate">Try a different word, widen the price range, or browse all products.</p>
            <Link href="/shop" className="mt-6 rounded-full bg-ink px-6 py-3 font-semibold text-white">Clear filters</Link>
          </div>
        )}
      </div>
      <Pagination page={query.page} pages={pages} href={(p) => shopHref(query, { page: p })} />
    </>
  );
}
