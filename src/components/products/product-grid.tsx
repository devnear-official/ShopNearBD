import Link from "next/link";
import clsx from "clsx";
import type { ProductCard as P } from "@/lib/catalog";
import { ProductCard, ProductCardSkeleton } from "./product-card";

/**
 * Catalogue grid. Two columns on phones, three on tablets, four on desktop;
 * on wide screens a featured product on the first page gets a double-size slot.
 */
export function ProductGrid({ items, featureFirst = false }: { items: P[]; featureFirst?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
      {items.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} large={featureFirst && i === 0 && p.is_featured} className={clsx(featureFirst && i === 0 && p.is_featured && "xl:col-span-2 xl:row-span-2")} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Link href={href(page - 1)} rel="prev" className="h-11 rounded-full bg-white px-5 font-semibold leading-[2.75rem] shadow-[var(--shadow-card)]">← Prev</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-mist">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined}
            className={clsx("grid size-11 place-items-center rounded-full font-semibold tabular-nums", n === page ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)] hover:bg-cloud")}>
            {n}
          </Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} rel="next" className="h-11 rounded-full bg-white px-5 font-semibold leading-[2.75rem] shadow-[var(--shadow-card)]">Next →</Link>}
    </nav>
  );
}
