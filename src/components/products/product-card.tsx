"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, Plus, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { ProductCard as Product, Variant } from "@/lib/catalog";
import { compareAtPrice, unitPrice } from "@/lib/pricing";
import { formatTaka, percentOff } from "@/lib/format";
import { swatch, isLight } from "@/lib/colors";
import { cart } from "@/components/cart/cart-store";

/**
 * The "tag card": a product card cut like a shopping tag (punched eyelet,
 * tangerine price flag). Name, price, stock and the add button are always
 * visible; hover only adds a second image and a speed-streak flourish.
 */
export function ProductCard({ product, priority, className, tone = "light", large }: { product: Product; priority?: boolean; className?: string; tone?: "light" | "dark"; large?: boolean }) {
  const sizes = large ? "(min-width:1280px) 46vw, (min-width:768px) 30vw, 46vw" : "(min-width:1280px) 22vw, (min-width:768px) 30vw, 46vw";
  const initial = useMemo(() => product.variants.find((v) => v.stock > 0) ?? product.variants[0], [product.variants]);
  const [variant, setVariant] = useState<Variant | undefined>(initial);
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");

  const price = variant ? unitPrice(product, variant) : product.min_price;
  const was = variant ? compareAtPrice(product, variant) : null;
  const off = was ? percentOff(was, price) : null;
  const img = (variant && product.images.find((i) => i.variant_id === variant.id)) || product.images[0];
  const alt = product.images.find((i) => i !== img && !i.variant_id) ?? product.images[1];
  const stock = variant?.stock ?? 0;
  const soldOut = product.total_stock <= 0;
  const low = !soldOut && stock > 0 && stock <= product.low_stock_threshold;
  const colorOpt = product.option_names.includes("Color") && product.variants.length > 1;
  const otherOpt = !colorOpt && product.variants.length > 1;
  const href = `/shop/${product.slug}`;
  const dark = tone === "dark";

  const add = () => {
    if (!variant || variant.stock <= 0) return;
    setStatus("adding");
    cart.add({
      variantId: variant.id, productId: product.id, slug: product.slug, name: product.name, variantName: variant.name,
      image: img?.url ?? null, unitPrice: price, maxStock: variant.stock,
    });
    // brief confirmation; the header badge also pulses
    setTimeout(() => setStatus("added"), 220);
    setTimeout(() => setStatus("idle"), 1600);
  };

  return (
    <article className={clsx("group/card relative flex flex-col", className)}>
      <div className="relative">
      <Link href={href} className="relative block" aria-label={`${product.name}, ${formatTaka(price)}`}>
        <div className="tag-hole relative aspect-[4/5] overflow-hidden rounded-[var(--radius-tag)] bg-cloud shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-snap)] group-hover/card:-translate-y-1 group-hover/card:shadow-[var(--shadow-float)]">
          {img && (
            <Image src={img.url} alt={img.alt || product.name} fill priority={priority} sizes={sizes}
              className="object-cover transition-transform duration-700 ease-[var(--ease-soft)] group-hover/card:scale-[1.04]" />
          )}
          {alt && (
            <Image src={alt.url} alt="" aria-hidden fill sizes={sizes}
              className="hidden object-cover opacity-0 transition-opacity duration-500 [@media(hover:hover)]:block group-hover/card:opacity-100" />
          )}
          {/* eyelet ring around the punched hole */}
          <span aria-hidden className="absolute left-[1.6rem] top-[1.6rem] size-[1.35rem] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/70" />
          {/* speed streaks on hover */}
          <span aria-hidden className="absolute left-12 top-[1.25rem] flex flex-col gap-1 opacity-0 transition-all duration-500 group-hover/card:translate-x-1 group-hover/card:opacity-100">
            <span className="h-1 w-10 rounded-full bg-white/90" />
            <span className="h-1 w-6 rounded-full bg-white/70" />
          </span>

          {off ? (
            <span className="absolute right-3 top-3 origin-top-right rotate-3 rounded-xl rounded-tr-sm bg-tangerine px-2.5 py-1 text-xs font-extrabold text-ink shadow-md transition-transform duration-500 group-hover/card:rotate-[-4deg]">
              −{off}%
            </span>
          ) : null}
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            {soldOut ? (
              <span className="rounded-full bg-ink/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">Sold out</span>
            ) : low ? (
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-flame backdrop-blur">Only {stock} left</span>
            ) : <span />}
          </div>
        </div>
      </Link>

      {/* Quick add sits outside the link so it never triggers navigation. */}
      <button
        type="button"
        onClick={add}
        disabled={!variant || variant.stock <= 0 || status === "adding"}
        aria-label={variant && variant.stock > 0 ? `Add ${product.name}${variant.name !== "Default" ? ` (${variant.name})` : ""} to cart` : `${product.name} is sold out`}
        className={clsx(
          "absolute bottom-3 right-3 z-10 grid size-12 place-items-center rounded-full shadow-lg transition-all duration-300",
          status === "added" ? "bg-mint text-white" : "bg-electric text-white hover:scale-105 hover:bg-electric-deep",
          "disabled:bg-mist disabled:opacity-70",
        )}
        data-card-add
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "adding" ? (
            <m.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Loader2 className="size-5 animate-spin" /></m.span>
          ) : status === "added" ? (
            <m.span key="c" initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}><Check className="size-5" /></m.span>
          ) : (
            <m.span key="p" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}><Plus className="size-5" /></m.span>
          )}
        </AnimatePresence>
      </button>
      </div>

      <div className="mt-3 flex flex-1 flex-col px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {product.category && <p className={clsx("eyebrow mb-1", dark ? "text-white/45" : "text-mist")}>{product.category.name}</p>}
            <h3 className={clsx("line-clamp-2 font-semibold leading-snug", dark ? "text-white" : "text-ink")}>
              <Link href={href} className="hover:underline hover:decoration-electric hover:decoration-2 hover:underline-offset-4">{product.name}</Link>
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.p key={price} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2 }}
                className={clsx("font-display text-lg font-bold tabular-nums", dark ? "text-white" : "text-ink")}>
                {formatTaka(price)}
              </m.p>
            </AnimatePresence>
            {was ? <s className={clsx("text-xs tabular-nums", dark ? "text-white/40" : "text-mist")}>{formatTaka(was)}</s> : null}
          </div>
        </div>

        {(colorOpt || otherOpt) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={`${product.name} options`}>
            {product.variants.map((v) => {
              const selected = v.id === variant?.id;
              const label = colorOpt ? v.options.Color ?? v.name : v.name;
              if (colorOpt) {
                const c = swatch(label);
                return (
                  <button key={v.id} type="button" onClick={() => setVariant(v)} aria-pressed={selected} aria-label={`${label}${v.stock <= 0 ? " (sold out)" : ""}`} title={label}
                    className={clsx("relative grid size-10 place-items-center rounded-full transition", selected ? "ring-2 ring-electric ring-offset-2" : "ring-1 ring-ink/10 hover:scale-110", dark && "ring-offset-ink")}>
                    <span className="size-6 rounded-full" style={{ background: c, boxShadow: isLight(c) ? "inset 0 0 0 1px rgba(11,21,48,.15)" : undefined }} />
                    {v.stock <= 0 && <span aria-hidden className="absolute h-0.5 w-7 rotate-45 rounded bg-flame" />}
                  </button>
                );
              }
              return (
                <button key={v.id} type="button" onClick={() => setVariant(v)} aria-pressed={selected}
                  className={clsx("h-10 rounded-full px-3.5 text-xs font-semibold transition", selected ? "bg-ink text-white" : dark ? "bg-white/10 text-white" : "bg-cloud text-ink-2 hover:bg-line", v.stock <= 0 && "line-through opacity-50")}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[4/5] rounded-[var(--radius-tag)]" />
      <div className="skeleton mt-3 h-4 w-3/4 rounded" />
      <div className="skeleton mt-2 h-4 w-1/3 rounded" />
    </div>
  );
}
