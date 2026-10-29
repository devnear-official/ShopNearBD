"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Check, ShoppingBag, Truck } from "lucide-react";
import type { ProductCard } from "@/lib/catalog";
import { compareAtPrice, unitPrice } from "@/lib/pricing";
import { swatch } from "@/lib/colors";
import { Price } from "@/components/ui/price";
import { Button, ButtonLink } from "@/components/ui/button";
import { cart } from "@/components/cart/cart-store";

/** A large, editorial presentation of one product with quick-add and variant switching. */
export function Spotlight({ product, specs }: { product: ProductCard; specs: { label: string; value: string }[] }) {
  const [variant, setVariant] = useState(product.variants.find((v) => v.stock > 0) ?? product.variants[0]);
  const [added, setAdded] = useState(false);
  const img = product.images.find((i) => i.variant_id === variant?.id) ?? product.images[0];
  const price = unitPrice(product, variant);
  const was = compareAtPrice(product, variant);

  const add = () => {
    cart.add({ variantId: variant.id, sku: variant.sku, category: product.category?.name, productId: product.id, slug: product.slug, name: product.name, variantName: variant.name, image: img?.url ?? null, unitPrice: price, maxStock: variant.stock });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className="relative">
        <div aria-hidden className="absolute inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-electric to-sky blur-3xl opacity-25" />
        <AnimatePresence mode="wait">
          <m.div key={img?.url} initial={{ opacity: 0, rotate: -2, scale: 0.97 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 2, scale: 0.97 }} transition={{ duration: 0.35 }}
            className="tag-hole relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-[var(--shadow-float)]">
            {img && <Image src={img.url} alt={img.alt || product.name} fill sizes="(min-width:1024px) 28rem, 90vw" className="object-cover" />}
          </m.div>
        </AnimatePresence>
        <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white p-2 shadow-[var(--shadow-float)]">
          {product.variants.map((v) => (
            <button key={v.id} type="button" onClick={() => setVariant(v)} aria-pressed={v.id === variant.id} aria-label={v.name}
              className={`grid size-10 place-items-center rounded-full transition ${v.id === variant.id ? "ring-2 ring-electric" : ""}`}>
              <span className="size-6 rounded-full ring-1 ring-ink/10" style={{ background: swatch(v.options.Color ?? v.name) }} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="eyebrow text-tangerine">Spotlight · {product.category?.name}</p>
        <h3 className="display mt-3 text-5xl sm:text-6xl">{product.name}</h3>
        {product.name_bn && <p className="bn mt-2 text-lg text-slate" lang="bn">{product.name_bn}</p>}
        <p className="mt-5 max-w-lg text-lg text-slate">{product.short_description}</p>
        <dl className="mt-6 grid max-w-lg grid-cols-2 gap-2">
          {specs.slice(0, 4).map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-3 shadow-[var(--shadow-card)]">
              <dt className="text-xs text-mist">{s.label}</dt>
              <dd className="font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <Price value={price} compareAt={was} size="xl" />
          <span className={`text-sm font-semibold ${variant.stock > 0 ? "text-mint" : "text-flame"}`}>
            {variant.stock > 0 ? (variant.stock <= product.low_stock_threshold ? `Only ${variant.stock} left` : "In stock") : "Sold out"}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={add} disabled={variant.stock <= 0}>
            {added ? <><Check className="size-5" /> Added</> : <><ShoppingBag className="size-5" /> Add to bag</>}
          </Button>
          <ButtonLink href={`/shop/${product.slug}`} variant="ghost" size="lg">Full details <ArrowRight className="size-5" /></ButtonLink>
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-slate"><Truck className="size-4" /> Cash on Delivery available · <Link href="/help#returns" className="underline">7-day returns</Link></p>
      </div>
    </div>
  );
}
