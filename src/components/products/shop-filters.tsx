"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  ArrowDownUp,
  BatteryCharging,
  Boxes,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Flame,
  Gift,
  Headphones,
  House,
  LayoutGrid,
  Luggage,
  Mic,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Watch,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { ProductQuery } from "@/lib/catalog";
import { shopHref } from "@/lib/shop-params";
import { formatTaka } from "@/lib/format";
import { useDialog } from "@/hooks/use-dialog";

type Cat = {
  slug: string;
  name: string;
  product_count: number;
  name_bn?: string | null;
  accent?: string | null;
};

function getCategoryIcon(slug: string) {
  const s = slug.toLowerCase();
  if (!s || s === "all") return LayoutGrid;
  if (s.includes("audio") || s.includes("sound") || s.includes("earphone") || s.includes("headphone") || s.includes("speaker")) return Headphones;
  if (s.includes("wear") || s.includes("watch")) return Watch;
  if (s.includes("power") || s.includes("charg") || s.includes("battery") || s.includes("cable")) return BatteryCharging;
  if (s.includes("home") || s.includes("kitchen") || s.includes("appliance")) return House;
  if (s.includes("bag") || s.includes("travel") || s.includes("backpack") || s.includes("sling")) return Luggage;
  if (s.includes("desk") || s.includes("organizer") || s.includes("office")) return Boxes;
  if (s.includes("life") || s.includes("gift")) return Gift;
  if (s.includes("fashion") || s.includes("cloth")) return ShoppingBag;
  return Sparkles;
}
const SORTS = [
  { value: "", label: "Recommended", icon: Sparkles, desc: "Curated for you" },
  { value: "newest", label: "Newest", icon: Clock, desc: "Fresh arrivals" },
  { value: "popular", label: "Most popular", icon: TrendingUp, desc: "Top trending items" },
  { value: "price_asc", label: "Price: Low to High", icon: ArrowDownUp, desc: "Budget friendly first" },
  { value: "price_desc", label: "Price: High to Low", icon: ArrowDownUp, desc: "Premium items first" },
  { value: "discount", label: "Biggest discount", icon: Flame, desc: "Best savings & deals" },
] as const;
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
  const [catOpen, setCatOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [min, setMin] = useState(query.min?.toString() ?? "");
  const [max, setMax] = useState(query.max?.toString() ?? "");
  const [inStock, setInStock] = useState(Boolean(query.inStock));
  const ref = useDialog<HTMLDivElement>(panel, () => setPanel(false));
  const catMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!catOpen && !sortOpen) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (catOpen && catMenuRef.current && !catMenuRef.current.contains(target)) {
        setCatOpen(false);
      }
      if (sortOpen && sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setSortOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCatOpen(false);
        setSortOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("touchstart", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("touchstart", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [catOpen, sortOpen]);

  const toggleSort = () => {
    setSortOpen((prev) => !prev);
    setCatOpen(false);
  };
  const toggleCat = () => {
    setCatOpen((prev) => !prev);
    setSortOpen(false);
  };

  const activeCategory = categories.find((c) => c.slug === query.category);
  const ActiveCatIcon = activeCategory ? getCategoryIcon(activeCategory.slug) : LayoutGrid;
  const activeSort = SORTS.find((s) => s.value === (query.sort ?? "")) ?? SORTS[0];
  const ActiveSortIcon = activeSort.icon;

  const go = (patch: Partial<ProductQuery>) => start(() => router.push(shopHref(query, { ...patch, page: 1 }), { scroll: false }));
  const toNum = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Math.max(0, Math.floor(Number(v))));
  const active: { label: string; clear: Partial<ProductQuery> }[] = [
    query.q ? { label: `“${query.q}”`, clear: { q: undefined } } : null,
    query.category ? { label: activeCategory?.name ?? query.category, clear: { category: undefined } } : null,
    query.collection ? { label: query.collection.replace(/-/g, " "), clear: { collection: undefined } } : null,
    query.min !== undefined || query.max !== undefined ? { label: `${query.min !== undefined ? formatTaka(query.min) : "৳0"} – ${query.max !== undefined ? formatTaka(query.max) : "any"}`, clear: { min: undefined, max: undefined } } : null,
    query.inStock ? { label: "In stock", clear: { inStock: undefined } } : null,
  ].filter(Boolean) as { label: string; clear: Partial<ProductQuery> }[];

  return (
    <>
      {pending && <div className="fixed inset-x-0 top-0 z-[60] h-1 animate-shimmer bg-[linear-gradient(90deg,#1E6BFF,#2FC6FF,#FF7A1A,#1E6BFF)] bg-[length:200%_100%]" role="progressbar" aria-label="Loading products" />}
      {/* 1. Search box scrolls naturally with page content (NOT sticky) */}
      <div className="relative -mx-4 px-4 py-1.5 sm:-mx-8 sm:px-8 sm:py-2">
        <form onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() || undefined }); }} className="relative w-full sm:max-w-md" role="search">
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
      </div>

      {/* 2. Filters, Sort, and Category row is STICKY when scrolling */}
      <div className="sticky top-14 sm:top-16 z-30 -mx-4 border-b border-line/60 bg-paper/85 px-4 py-2 backdrop-blur-xl sm:-mx-8 sm:px-8">
        {/* On Mobile: 1 single row with 3 buttons (Filters, Sort, Category) in a 3-column grid */}
        {/* On PC: standard flex row with Filters, Sort, and total count */}
        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2">
          {/* Button 1: Filters */}
          <button
            type="button"
            onClick={() => {
              setPanel(true);
              setSortOpen(false);
              setCatOpen(false);
            }}
            className="flex h-9 sm:h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-ink px-2 sm:px-4 text-xs sm:text-sm font-semibold text-white transition active:scale-95"
          >
            <SlidersHorizontal className="size-3.5 sm:size-4 shrink-0" />
            <span className="truncate">Filters{active.length ? ` · ${active.length}` : ""}</span>
          </button>

          {/* Button 2: Custom Animated Sort / Recommended Popover Menu */}
          <div className="relative w-full sm:w-auto min-w-0" ref={sortMenuRef}>
            <button
              type="button"
              onClick={toggleSort}
              aria-expanded={sortOpen}
              className={clsx(
                "flex h-9 sm:h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-full px-2 sm:px-4 text-xs sm:text-sm font-semibold transition active:scale-95",
                sortOpen || Boolean(query.sort)
                  ? "bg-electric text-white shadow-lift ring-2 ring-electric/30"
                  : "bg-white text-ink-2 shadow-[var(--shadow-card)] hover:bg-cloud"
              )}
            >
              <ActiveSortIcon className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">{activeSort.label}</span>
              <ChevronDown className={clsx("size-3 shrink-0 transition-transform duration-200", sortOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {sortOpen && (
                <m.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-2 w-64 sm:w-72 rounded-2xl bg-white p-2 shadow-[var(--shadow-float)] ring-1 ring-line/80 backdrop-blur-xl"
                >
                  <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-mist">
                    Sort by
                  </div>
                  <div className="mt-1 space-y-1">
                    {SORTS.map((s) => {
                      const active = (query.sort ?? "") === s.value;
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setSortOpen(false);
                            go({ sort: (s.value || undefined) as ProductQuery["sort"] });
                          }}
                          className={clsx(
                            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98]",
                            active
                              ? "bg-electric/10 text-electric-deep font-bold"
                              : "text-ink-2 hover:bg-cloud"
                          )}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={clsx(
                                "grid size-7 shrink-0 place-items-center rounded-lg",
                                active ? "bg-electric text-white" : "bg-paper text-slate"
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="truncate text-left">
                              <span className="block leading-tight">{s.label}</span>
                              <span className="block text-[0.65rem] font-normal text-slate">
                                {s.desc}
                              </span>
                            </span>
                          </span>
                          {active && <Check className="size-4 shrink-0 text-electric" />}
                        </button>
                      );
                    })}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>

          {/* Button 3: Categories Popover Menu (Mobile only - 3rd button in the row) */}
          <div className="relative w-full min-w-0 sm:hidden" ref={catMenuRef}>
            <button
              type="button"
              onClick={() => setCatOpen(!catOpen)}
              aria-expanded={catOpen}
              className={clsx(
                "flex h-9 w-full items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold transition active:scale-95",
                catOpen || query.category
                  ? "bg-electric text-white shadow-lift ring-2 ring-electric/30"
                  : "bg-white text-ink-2 shadow-[var(--shadow-card)] hover:bg-cloud"
              )}
            >
              <ActiveCatIcon className="size-3.5 shrink-0" />
              <span className="truncate">
                {activeCategory ? activeCategory.name : "Category"}
              </span>
              <ChevronDown className={clsx("size-3 shrink-0 transition-transform duration-200", catOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {catOpen && (
                <m.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-2 shadow-[var(--shadow-float)] ring-1 ring-line/80 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-mist">
                    <span>Categories ({categories.length})</span>
                    {query.category && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatOpen(false);
                          go({ category: undefined });
                        }}
                        className="text-[0.7rem] font-semibold text-electric underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="mt-1 max-h-[60vh] space-y-1 overflow-y-auto scrollbar-none pr-0.5">
                    {/* All Products Item */}
                    <button
                      type="button"
                      onClick={() => {
                        setCatOpen(false);
                        go({ category: undefined });
                      }}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98]",
                        !query.category
                          ? "bg-electric/10 text-electric-deep font-bold"
                          : "text-ink-2 hover:bg-cloud"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={clsx("grid size-7 place-items-center rounded-lg", !query.category ? "bg-electric text-white" : "bg-paper text-slate")}>
                          <LayoutGrid className="size-4" />
                        </span>
                        <span>All Products</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[0.68rem] font-bold text-mist tabular-nums">{total}</span>
                        {!query.category && <Check className="size-4 text-electric" />}
                      </span>
                    </button>

                    {/* Category Items */}
                    {categories.map((c) => {
                      const active = query.category === c.slug;
                      const Icon = getCategoryIcon(c.slug);
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => {
                            setCatOpen(false);
                            go({ category: c.slug });
                          }}
                          className={clsx(
                            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98]",
                            active
                              ? "bg-electric/10 text-electric-deep font-bold"
                              : "text-ink-2 hover:bg-cloud"
                          )}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={clsx("grid size-7 shrink-0 place-items-center rounded-lg", active ? "bg-electric text-white" : "bg-paper text-slate")}
                              style={{
                                color: !active && c.accent ? c.accent : undefined,
                                backgroundColor: !active && c.accent ? `${c.accent}18` : undefined,
                              }}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="truncate text-left">
                              <span>{c.name}</span>
                              {c.name_bn && (
                                <span className="bn ml-1.5 text-[0.65rem] font-normal text-slate" lang="bn">
                                  {c.name_bn}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 pl-2">
                            <span className="text-[0.68rem] font-bold text-mist tabular-nums">
                              {c.product_count}
                            </span>
                            {active && <Check className="size-4 text-electric" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>

          <p className="ml-auto hidden text-sm text-slate sm:block" aria-live="polite">{total} product{total === 1 ? "" : "s"}</p>
        </div>

        {/* PC / Desktop only: Separate category chips with icons and product counts */}
        <div className="hidden sm:flex sm:flex-wrap sm:gap-2 mt-3" role="group" aria-label="Categories">
          <Chip
            active={!query.category}
            onClick={() => go({ category: undefined })}
            icon={<LayoutGrid className="size-4" />}
          >
            All <span className="opacity-60 tabular-nums text-xs">{total}</span>
          </Chip>
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.slug);
            const active = query.category === c.slug;
            return (
              <Chip
                key={c.slug}
                active={active}
                onClick={() => go({ category: c.slug })}
                icon={
                  <Icon
                    className="size-4"
                    style={{ color: !active && c.accent ? c.accent : undefined }}
                  />
                }
              >
                {c.name} <span className="opacity-60 tabular-nums text-xs">{c.product_count}</span>
              </Chip>
            );
          })}
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

function Chip({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx(
        "flex h-8 sm:h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 sm:px-3.5 text-xs sm:text-sm font-semibold transition active:scale-95",
        active
          ? "bg-electric text-white shadow-lift ring-2 ring-electric/30"
          : "border border-line/75 bg-white text-ink-2 shadow-xs hover:border-electric/30 hover:bg-cloud"
      )}>
      {icon}
      {children}
    </button>
  );
}
