"use client";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, ShoppingBag } from "lucide-react";
import clsx from "clsx";
import type { Category, ProductCard as Product } from "@/lib/catalog";
import { ProductCard } from "@/components/products/product-card";
import { ButtonLink } from "@/components/ui/button";
import { categoryProducts } from "@/actions/storefront";

/**
 * The mall: a building on the left, one floor (shop window) per category, a lit lift that
 * rides to the chosen floor. Pick a floor and its products appear on the right.
 *
 * Fast by design: pure HTML/CSS (no animation library on the building), only the first
 * category's products are sent with the page; the others load on hover/tap and are cached.
 */
export function CategoryMall({ categories, initialProducts }: { categories: Category[]; initialProducts: Product[] }) {
  const [selected, setSelected] = useState(0);
  const [cache, setCache] = useState<Record<string, Product[]>>(() => (categories[0] ? { [categories[0].slug]: initialProducts } : {}));
  const [, startTransition] = useTransition();
  const asked = useRef(new Set<string>(categories[0] ? [categories[0].slug] : []));
  const panel = useRef<HTMLDivElement>(null);

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

  const choose = (i: number) => {
    setSelected(i);
    load(categories[i].slug);
    // On phones the products sit below the building: bring them into view.
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

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
  const n = categories.length;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-10">
      {/* building */}
      <div className="relative mx-auto w-full max-w-[27rem] [--fg:0.5rem] [--fh:4.9rem] sm:[--fh:6rem]">
        <div aria-hidden className="absolute -inset-x-4 -inset-y-4 -z-10 overflow-hidden rounded-[2.25rem] bg-gradient-to-b from-[#cfe6ff] via-[#e4f1ff] to-[#f1f7ff]">
          <span className="absolute bottom-0 left-0 h-[62%] w-[20%] bg-[#b9cde6]/60 [background-image:repeating-linear-gradient(0deg,transparent_0_14px,rgba(255,255,255,.5)_14px_18px)]" />
          <span className="absolute bottom-0 right-0 h-[74%] w-[17%] bg-[#a9c0de]/55 [background-image:repeating-linear-gradient(0deg,transparent_0_14px,rgba(255,255,255,.5)_14px_18px)]" />
        </div>

        {/* roof + sign */}
        <div className="relative mx-auto w-[92%]">
          <span aria-hidden className="absolute -top-3 left-[10%] h-3 w-9 rounded-t-sm bg-[#8d9ab1]" />
          <span aria-hidden className="absolute -top-2 right-[12%] h-2 w-6 rounded-t-sm bg-[#8d9ab1]" />
          <div className="flex items-center justify-center gap-2.5 rounded-t-xl bg-gradient-to-b from-electric to-electric-deep px-4 py-2.5 text-white shadow-[0_0_30px_-4px_rgba(30,107,255,.65)] ring-2 ring-white/70">
            <Image src="/brand/mark-512.png" alt="" width={40} height={40} className="size-8 rounded-md bg-white p-0.5" />
            <span className="font-display text-lg font-bold uppercase tracking-[0.14em] sm:text-xl">ShopNear Mall</span>
          </div>
          <div className="h-2.5 rounded-sm bg-[#97a4ba]" />
        </div>

        {/* floors */}
        <div className="relative flex gap-1.5 bg-gradient-to-b from-[#c4cfdf] to-[#b3bfd3] p-2 shadow-[0_24px_40px_-24px_rgba(11,21,48,.6)]">
          <ol className="flex min-w-0 flex-1 flex-col gap-[var(--fg)]">
            {categories.map((c, i) => {
              const lit = i === selected;
              const pic = c.cover ?? c.image_url;
              const accent = c.accent ?? "#1E6BFF";
              return (
                <li key={c.slug}>
                  <button type="button" onClick={() => choose(i)} onPointerEnter={() => load(c.slug)} onFocus={() => load(c.slug)}
                    aria-pressed={lit} aria-label={`Floor ${n - i}: ${c.name}, ${c.product_count} products. Show products`}
                    className="group relative block h-[var(--fh)] w-full overflow-hidden rounded-[3px] text-left outline-none ring-1 ring-black/15 transition-[box-shadow,transform] duration-300 focus-visible:ring-2 focus-visible:ring-electric motion-reduce:transition-none">
                    <span aria-hidden className={clsx("absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none", lit ? "opacity-0" : "opacity-100")} style={{ background: "linear-gradient(160deg,#d4e1f1 0%,#aebfd8 100%)" }} />
                    <span aria-hidden className={clsx("absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none", lit ? "opacity-100" : "opacity-0")} style={{ background: "linear-gradient(180deg,#fff7e2 0%,#ffe8b8 100%)" }} />
                    <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
                    <span className="absolute inset-x-0 bottom-0 top-1.5 flex">
                      <span className="flex min-w-0 flex-1 flex-col justify-center px-3">
                        <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink/50">Floor {n - i}</span>
                        <span className="truncate font-display text-[1.05rem] font-bold leading-tight text-ink sm:text-xl">{c.name}</span>
                        {c.name_bn && <span className="bn truncate text-xs font-semibold text-ink/60" lang="bn">{c.name_bn}</span>}
                        <span className="mt-1 inline-flex items-center gap-1 text-[0.7rem] font-semibold" style={{ color: lit ? "#a8530a" : "#1a3a73" }}>
                          {c.product_count} item{c.product_count === 1 ? "" : "s"} <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </span>
                      <span className="relative m-2 w-[40%] shrink-0 overflow-hidden rounded-md bg-white/70 shadow-[inset_0_0_0_1px_rgba(11,21,48,.08)]">
                        {pic ? <Image src={pic} alt="" fill sizes="(min-width:1024px) 10rem, 30vw" className="object-cover transition-transform duration-500 group-hover:scale-105" /> : <ShoppingBag className="absolute inset-0 m-auto size-1/3" style={{ color: accent }} />}
                      </span>
                    </span>
                    {/* mullion and glass glint */}
                    <span aria-hidden className="absolute bottom-0 left-[58%] top-1.5 w-px bg-black/10" />
                    <span aria-hidden className="sn-glint pointer-events-none absolute inset-0" style={{ ["--gd" as string]: `${i * 1.3}s` }} />
                    <span aria-hidden className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/20" />
                  </button>
                </li>
              );
            })}
          </ol>
          {/* the lift: a lit car that rides to the chosen floor */}
          <span aria-hidden className="relative block w-3.5 shrink-0 rounded-sm bg-[#8794ab]">
            <span className="absolute inset-x-0.5 top-0 block h-[var(--fh)] rounded-[2px] bg-gradient-to-b from-[#ffe9a9] to-[#ffc65a] shadow-[0_0_14px_3px_rgba(255,198,90,.55)] transition-transform duration-700 ease-[cubic-bezier(.6,0,.2,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(calc(${selected} * (var(--fh) + var(--fg))))` }} />
          </span>
        </div>

        {/* ground floor */}
        <div className="bg-gradient-to-b from-[#b3bfd3] to-[#9fabc0] px-2 pb-0 pt-1.5">
          <div className="mx-auto mb-1.5 h-2.5 w-[70%] rounded-sm bg-ink/85 shadow-[0_6px_10px_-6px_rgba(11,21,48,.6)]" />
          <div className="flex h-[4.5rem] gap-1 sm:h-24">
            {[0, 1, 2, 3].map((k) => (
              <span key={k} className="relative flex-1 overflow-hidden rounded-t-[3px] bg-gradient-to-br from-[#bfe0ff] via-[#8fc2f5] to-[#6aa6e8] ring-1 ring-black/15">
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
                <span aria-hidden className="sn-glint absolute inset-0" style={{ ["--gd" as string]: `${k * 0.9 + 2}s` }} />
              </span>
            ))}
          </div>
        </div>
        <div aria-hidden className="h-3 rounded-b-md bg-[#7f8ca3]" />
      </div>

      {/* products for the chosen floor */}
      <div ref={panel} className="scroll-mt-28 lg:sticky lg:top-28">
        <AnimatePresence mode="wait" initial={false}>
          {current && (
            <m.section key={current.slug} aria-label={`${current.name} products`} aria-live="polite"
              initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.28, ease: [0.2, 0.9, 0.1, 1] }}
              className="rounded-[2rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-6">
              <header className="flex flex-wrap items-center gap-3">
                <span className="grid size-12 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: current.accent ?? "#1E6BFF" }}>F{n - selected}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-bold sm:text-2xl">{current.name}{current.name_bn && <span className="bn ml-2 text-base font-semibold text-slate" lang="bn">{current.name_bn}</span>}</h3>
                  {current.description && <p className="line-clamp-1 text-sm text-slate">{current.description}</p>}
                </div>
                <ButtonLink href={`/shop?category=${current.slug}`} size="md">View all {current.name} <ArrowRight className="size-4" /></ButtonLink>
              </header>

              {items === undefined ? (
                <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4" aria-hidden>
                  {[0, 1, 2, 3].map((k) => <li key={k} className="aspect-[4/5] animate-pulse rounded-3xl bg-cloud" />)}
                </ul>
              ) : items.length ? (
                <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
                  {items.slice(0, 4).map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
                </ul>
              ) : (
                <p className="mt-6 rounded-2xl bg-paper p-6 text-center text-slate">Products for {current.name} are on their way.</p>
              )}
            </m.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
