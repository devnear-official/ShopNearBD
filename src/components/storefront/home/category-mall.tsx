"use client";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, BatteryCharging, Gift, Headphones, House, Luggage, ShoppingBag, Watch } from "lucide-react";
import clsx from "clsx";
import type { Category, ProductCard as Product } from "@/lib/catalog";
import { ProductCard } from "@/components/products/product-card";
import { ButtonLink } from "@/components/ui/button";
import { categoryProducts } from "@/actions/storefront";

/**
 * Category deck: a row of colour cards (one per category) with the products of the chosen card laid out right under it.
 * The chosen card lifts, and a notch in its colour ties it to the panel below. No animation library and no images beyond
 * the small card covers; only the first category's products ship with the page, the rest load on hover/tap and are cached.
 */
function CatIcon({ slug, className, strokeWidth }: { slug: string; className?: string; strokeWidth?: number }) {
  const p = { "aria-hidden": true, className, strokeWidth } as const;
  if (slug.includes("audio")) return <Headphones {...p} />;
  if (slug.includes("wear")) return <Watch {...p} />;
  if (slug.includes("power")) return <BatteryCharging {...p} />;
  if (slug.includes("home")) return <House {...p} />;
  if (slug.includes("bag")) return <Luggage {...p} />;
  if (slug.includes("life")) return <Gift {...p} />;
  return <ShoppingBag {...p} />;
}

/** Where the product tiles sit on a card: left, top, width, tilt. Assorted, with the text corner left airy. */
const SLOTS: [string, string, string, number][] = [["56%", "7%", "36%", 9], ["7%", "22%", "28%", -8], ["35%", "27%", "27%", 6], ["68%", "40%", "26%", -11], ["50%", "58%", "32%", 7]];

/** Darkens a #rrggbb colour so every card gets a two-tone gradient from its accent. */
function shade(hex: string, amt: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  return `rgb(${ch(n >> 16)} ${ch((n >> 8) & 255)} ${ch(n & 255)})`;
}

export function CategoryMall({ categories, initialProducts }: { categories: Category[]; initialProducts: Product[] }) {
  const [selected, setSelected] = useState(0);
  const [cache, setCache] = useState<Record<string, Product[]>>(() => (categories[0] ? { [categories[0].slug]: initialProducts } : {}));
  const [, startTransition] = useTransition();
  const asked = useRef(new Set<string>(categories[0] ? [categories[0].slug] : []));

  const load = (slug: string) => {
    if (asked.current.has(slug)) return;
    asked.current.add(slug);
    startTransition(async () => {
      try {
        const items = await categoryProducts(slug);
        setCache((c) => ({ ...c, [slug]: items }));
      } catch {
        asked.current.delete(slug); // allow a retry on the next hover/tap
        setCache((c) => ({ ...c, [slug]: [] }));
      }
    });
  };

  const choose = (i: number) => { setSelected(i); load(categories[i].slug); };

  // Warm the neighbours once the page is idle so a click rarely waits.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const run = () => categories.slice(1, 3).forEach((c) => load(c.slug));
    const id = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 2500);
    return () => { if (!w.requestIdleCallback) clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, after mount
  }, []);

  const current = categories[selected];
  const items = current ? cache[current.slug] : undefined;
  const accent = current?.accent ?? "#1E6BFF";
  const cols = Math.min(Math.max(categories.length, 1), 6);

  return (
    <div>
      {/* the deck of category cards: a swipe rail on phones, one even row on desktop */}
      <ul className="-mx-4 flex scroll-px-4 snap-x snap-mandatory sm:scroll-px-8 lg:scroll-px-0 gap-3 overflow-x-auto px-4 pb-5 pt-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))] lg:gap-4 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        style={{ ["--cols" as string]: cols }}>
        {categories.map((c, i) => {
          const on = i === selected;
          const a = c.accent ?? "#1E6BFF";
          const pic = c.cover ?? c.image_url;
          const thumbs = c.thumbs ?? [];
          return (
            <li key={c.slug} className="relative w-[9.5rem] shrink-0 snap-start sm:w-[11rem] lg:w-auto lg:[grid-column:auto]">
              <button type="button" onClick={() => choose(i)} onPointerEnter={() => load(c.slug)} onFocus={() => load(c.slug)} aria-pressed={on}
                aria-label={`${c.name}, ${c.product_count} products. Show products`}
                className={clsx("group relative flex h-44 w-full flex-col justify-between overflow-hidden rounded-[1.6rem] p-3.5 text-left text-white outline-none ring-offset-2 transition-[transform,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-electric sm:h-48 sm:p-4",
                  on ? "-translate-y-1.5 ring-2 ring-white" : "hover:-translate-y-1")}
                style={{ background: `linear-gradient(150deg, ${a} 0%, ${shade(a, 0.42)} 100%)`, boxShadow: on ? `0 18px 34px -14px ${a}` : "0 10px 22px -16px rgba(11,21,48,.55)" }}>
                {/* the category's own products, scattered as small low-opacity tiles behind the text */}
                <span aria-hidden className="pointer-events-none absolute inset-0">
                  {(thumbs.length ? thumbs : pic ? [pic] : []).slice(0, SLOTS.length).map((src, k) => (
                    <span key={src + k} className="absolute overflow-hidden rounded-[0.9rem] bg-white/25 opacity-[0.42] shadow-[0_6px_14px_-8px_rgba(0,0,0,.5)] ring-1 ring-white/40"
                      style={{ left: SLOTS[k][0], top: SLOTS[k][1], width: SLOTS[k][2], aspectRatio: "1", transform: `rotate(${SLOTS[k][3]}deg)` }}>
                      <Image src={src} alt="" fill sizes="4.5rem" quality={45} className="object-cover" />
                    </span>
                  ))}
                  <span className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/30 to-transparent" />
                </span>
                <span className="relative font-display text-sm font-bold tabular-nums text-white/70">{String(i + 1).padStart(2, "0")}</span>
                <span className="relative max-w-[78%]">
                  <span className="block font-display text-base font-bold leading-[1.05] drop-shadow-sm sm:text-lg">{c.name}</span>
                  {c.name_bn && <span className="bn mt-0.5 block truncate text-[0.8rem] font-semibold text-white/85" lang="bn">{c.name_bn}</span>}
                  <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-0.5 text-[0.7rem] font-bold text-ink">{c.product_count} item{c.product_count === 1 ? "" : "s"}</span>
                </span>
              </button>
              {/* the notch that ties the chosen card to the panel */}
              {on && <span aria-hidden className="absolute -bottom-[1.05rem] left-1/2 z-10 size-4 -translate-x-1/2 rotate-45 rounded-[3px]" style={{ background: a }} />}
            </li>
          );
        })}
      </ul>

      {/* products of the chosen card */}
      {current && (
        <section key={current.slug} aria-label={`${current.name} products`} aria-live="polite" className="rounded-[2rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-6" style={{ borderTop: `4px solid ${accent}` }}>
          <header className="flex flex-wrap items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ background: `linear-gradient(150deg, ${accent}, ${shade(accent, 0.4)})` }}><CatIcon slug={current.slug} className="size-6" /></span>
            <div className="min-w-0 flex-[1_1_11rem]">
              <h3 className="font-display text-xl font-bold sm:text-2xl">{current.name}{current.name_bn && <span className="bn ml-2 text-base font-semibold text-slate" lang="bn">{current.name_bn}</span>}</h3>
              {current.description && <p className="line-clamp-2 text-sm text-slate">{current.description}</p>}
            </div>
            <ButtonLink href={`/shop?category=${current.slug}`} size="md" className="w-full sm:w-auto">View all {current.name} <ArrowRight className="size-4" /></ButtonLink>
          </header>

          {items === undefined ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-hidden>
              {[0, 1, 2, 3].map((k) => <li key={k} className="aspect-[4/5] animate-pulse rounded-3xl bg-cloud" />)}
            </ul>
          ) : items.length ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {items.slice(0, 4).map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
            </ul>
          ) : (
            <p className="mt-6 rounded-2xl bg-paper p-6 text-center text-slate">Products for {current.name} are on their way.</p>
          )}
        </section>
      )}
    </div>
  );
}
