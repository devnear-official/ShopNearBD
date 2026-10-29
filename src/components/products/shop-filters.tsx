"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { Camera, Mic, Search, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import type { ProductQuery } from "@/lib/catalog";
import { shopHref } from "@/lib/shop-params";
import { formatTaka } from "@/lib/format";
import { useDialog } from "@/hooks/use-dialog";

type Cat = { slug: string; name: string; product_count: number };
const SORTS: { value: NonNullable<ProductQuery["sort"]> | ""; label: string }[] = [
  { value: "", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "discount", label: "Biggest discount" },
];
const PRESETS = [
  { label: "Under ৳500", min: undefined, max: 500 },
  { label: "৳500 – ৳1,500", min: 500, max: 1500 },
  { label: "৳1,500 – ৳3,000", min: 1500, max: 3000 },
  { label: "৳3,000+", min: 3000, max: undefined },
];

export function ShopFilters({ query, categories, total }: { query: ProductQuery; categories: Cat[]; total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(query.q ?? "");
  const [panel, setPanel] = useState(false);
  const [min, setMin] = useState(query.min?.toString() ?? "");
  const [max, setMax] = useState(query.max?.toString() ?? "");
  const [inStock, setInStock] = useState(Boolean(query.inStock));
  const ref = useDialog<HTMLDivElement>(panel, () => setPanel(false));

  const go = (patch: Partial<ProductQuery>) => start(() => router.push(shopHref(query, { ...patch, page: 1 }), { scroll: false }));
  const toNum = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Math.max(0, Math.floor(Number(v))));
  const active: { label: string; clear: Partial<ProductQuery> }[] = [
    query.q ? { label: `“${query.q}”`, clear: { q: undefined } } : null,
    query.collection ? { label: query.collection.replace(/-/g, " "), clear: { collection: undefined } } : null,
    query.min !== undefined || query.max !== undefined ? { label: `${query.min !== undefined ? formatTaka(query.min) : "৳0"} – ${query.max !== undefined ? formatTaka(query.max) : "any"}`, clear: { min: undefined, max: undefined } } : null,
    query.inStock ? { label: "In stock", clear: { inStock: undefined } } : null,
  ].filter(Boolean) as { label: string; clear: Partial<ProductQuery> }[];

  return (
    <>
      {pending && <div className="fixed inset-x-0 top-0 z-[60] h-1 animate-shimmer bg-[linear-gradient(90deg,#1E6BFF,#2FC6FF,#FF7A1A,#1E6BFF)] bg-[length:200%_100%]" role="progressbar" aria-label="Loading products" />}
      <div className="sticky top-[5.25rem] z-30 -mx-4 bg-paper/85 px-4 py-3 backdrop-blur-lg sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() || undefined }); }} className="relative order-1 w-full sm:order-none sm:w-72" role="search">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden />
            <label htmlFor="shop-q" className="sr-only">Search products</label>
            <input id="shop-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in shop…" enterKeyHint="search"
              className="h-11 w-full rounded-full bg-white pl-10 pr-24 text-sm shadow-[var(--shadow-card)] outline-none ring-electric focus:ring-2" />
            {/* Voice and photo search open the search panel in that mode. */}
            <span className="absolute right-1 top-1/2 flex -translate-y-1/2">
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("sn:open-search", { detail: { mode: "voice" } }))} className="grid size-10 place-items-center rounded-full text-electric hover:bg-cloud" aria-label="Search by voice" title="Search by voice"><Mic className="size-[1.1rem]" /></button>
              <label className="grid size-10 cursor-pointer place-items-center rounded-full text-tangerine hover:bg-cloud focus-within:ring-2 focus-within:ring-electric" title="Search with a photo">
                <Camera className="size-[1.1rem]" aria-hidden />
                <input type="file" accept="image/*" className="sr-only" aria-label="Search with a photo" data-shop-image-input
                  onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) window.dispatchEvent(new CustomEvent("sn:open-search", { detail: { mode: "image", file } })); }} />
              </label>
            </span>
          </form>
          <button type="button" onClick={() => setPanel(true)} className="flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white">
            <SlidersHorizontal className="size-4" /> Filters{active.length ? ` · ${active.length}` : ""}
          </button>
          <label className="sr-only" htmlFor="shop-sort">Sort by</label>
          <select id="shop-sort" value={query.sort ?? ""} onChange={(e) => go({ sort: (e.target.value || undefined) as ProductQuery["sort"] })}
            className="h-11 rounded-full bg-white px-4 text-sm font-semibold shadow-[var(--shadow-card)] outline-none focus:ring-2 focus:ring-electric">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="ml-auto hidden text-sm text-slate sm:block" aria-live="polite">{total} product{total === 1 ? "" : "s"}</p>
        </div>
        <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Categories">
          <Chip active={!query.category} onClick={() => go({ category: undefined })}>All</Chip>
          {categories.map((c) => (
            <Chip key={c.slug} active={query.category === c.slug} onClick={() => go({ category: c.slug })}>
              {c.name} <span className="opacity-50">{c.product_count}</span>
            </Chip>
          ))}
        </div>
        {active.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {active.map((a) => (
              <button key={a.label} type="button" onClick={() => go(a.clear)} className="flex h-8 items-center gap-1 rounded-full bg-electric/10 px-3 text-xs font-semibold capitalize text-electric-deep">
                {a.label} <X className="size-3.5" aria-label="Remove filter" />
              </button>
            ))}
            <button type="button" onClick={() => start(() => router.push("/shop", { scroll: false }))} className="h-8 px-2 text-xs font-semibold text-slate underline">Clear all</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {panel && (
          <m.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" tabIndex={-1} aria-label="Close filters" className="absolute inset-0 bg-ink/40" onClick={() => setPanel(false)} />
            <m.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="filters-title" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="pb-safe relative w-full max-w-lg rounded-t-[2rem] bg-white p-6 sm:rounded-[2rem]">
              <div className="flex items-center justify-between">
                <h2 id="filters-title" className="display t-sub">Filters</h2>
                <button type="button" onClick={() => setPanel(false)} className="grid size-11 place-items-center rounded-full bg-cloud" aria-label="Close filters"><X className="size-5" /></button>
              </div>
              <fieldset className="mt-6">
                <legend className="label">Price (৳)</legend>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <Chip key={p.label} active={toNum(min) === p.min && toNum(max) === p.max} onClick={() => { setMin(p.min?.toString() ?? ""); setMax(p.max?.toString() ?? ""); }}>{p.label}</Chip>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><label htmlFor="f-min" className="text-xs text-slate">Min</label><input id="f-min" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className="input" placeholder="0" /></div>
                  <div><label htmlFor="f-max" className="text-xs text-slate">Max</label><input id="f-max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} className="input" placeholder="Any" /></div>
                </div>
              </fieldset>
              <label className="mt-6 flex cursor-pointer items-center justify-between rounded-2xl bg-paper p-4">
                <span className="font-semibold">In stock only</span>
                <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-5 accent-electric" />
              </label>
              <div className="mt-6 flex gap-3">
                <button type="button" className="h-12 flex-1 rounded-full font-semibold ring-1 ring-line" onClick={() => { setMin(""); setMax(""); setInStock(false); }}>Reset</button>
                <button type="button" className="h-12 flex-[2] rounded-full bg-electric font-semibold text-white" onClick={() => { setPanel(false); go({ min: toNum(min), max: toNum(max), inStock: inStock || undefined }); }}>Show results</button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx("flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition", active ? "bg-electric text-white" : "bg-white text-ink-2 shadow-[var(--shadow-card)] hover:bg-cloud")}>
      {children}
    </button>
  );
}
