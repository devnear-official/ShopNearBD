"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Banknote, Check, MapPin, ShieldCheck, ShoppingBag, Smartphone, Truck, Zap } from "lucide-react";
import clsx from "clsx";
import type { PaymentSettings, ProductDetail, Variant } from "@/lib/catalog";
import { compareAtPrice, unitPrice } from "@/lib/pricing";
import { formatTaka } from "@/lib/format";
import { swatch, isLight } from "@/lib/colors";
import { DISTRICTS, zonesForDistrict, type ShippingSettings } from "@/lib/shipping";
import { parseJsonArray, useStoredValue, writeStored } from "@/hooks/use-stored-value";
import { cart } from "@/components/cart/cart-store";
import { Stepper } from "@/components/cart/cart-drawer";
import { Price } from "@/components/ui/price";
import { Button } from "@/components/ui/button";
import { ProductGallery } from "./product-gallery";
import { WishlistButton } from "./wishlist";
import { track } from "@/lib/tracking/client";
import { QuickOrder } from "@/components/checkout/quick-order";

export function ProductExperience({ product, shipping, payments, children }: { product: ProductDetail; shipping: ShippingSettings; payments: PaymentSettings; children?: React.ReactNode }) {
  const options = product.option_names.filter((n) => product.variants.some((v) => v.options[n]));
  const initial = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() => ({ ...(initial?.options ?? {}) }));
  const [qtyInput, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const buttons = useRef<HTMLDivElement>(null);
  const [pastButtons, setPastButtons] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const showBar = pastButtons && !formVisible;

  const variant: Variant | undefined = useMemo(
    () => (options.length ? product.variants.find((v) => options.every((o) => v.options[o] === selected[o])) : product.variants[0]) ?? initial,
    [options, product.variants, selected, initial],
  );
  const price = variant ? unitPrice(product, variant) : product.min_price;
  const was = variant ? compareAtPrice(product, variant) : null;
  const stock = variant?.stock ?? 0;
  const imageIndex = Math.max(0, product.images.findIndex((i) => i.variant_id && i.variant_id === variant?.id));
  const maxQty = Math.min(20, stock);
  // Derived, so switching to a variant with less stock never leaves an impossible quantity.
  const qty = Math.max(1, Math.min(qtyInput, Math.max(1, maxQty)));

  // Ads: one ViewContent per product page view.
  useEffect(() => {
    track("ViewContent", { value: price, items: [{ id: variant?.sku ?? product.sku, name: product.name, quantity: 1, price, category: product.category?.name }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per product, not per variant change
  }, [product.id]);

  // Remember for "recently viewed".
  useEffect(() => {
    try {
      const key = "sn_recent";
      const list = JSON.parse(localStorage.getItem(key) ?? "[]") as { slug: string }[];
      const entry = { slug: product.slug, name: product.name, image: product.images[0]?.url ?? null };
      writeStored(key, JSON.stringify([entry, ...list.filter((x) => x.slug !== product.slug)].slice(0, 10)));
    } catch {}
  }, [product.slug, product.name, product.images]);

  // Sticky purchase bar on phones once the main buttons scroll away.
  useEffect(() => {
    const el = buttons.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPastButtons(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    const form = document.getElementById("order-now");
    const io2 = new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting), { threshold: 0 });
    if (form) io2.observe(form);
    return () => { io.disconnect(); io2.disconnect(); };
  }, []);
  // While the order form is on a phone screen, the floating chat button would cover fields.
  useEffect(() => {
    document.documentElement.dataset.quickOrder = formVisible ? "1" : "";
    return () => { document.documentElement.dataset.quickOrder = ""; };
  }, [formVisible]);
  useEffect(() => {
    document.documentElement.style.setProperty("--sticky-bar", showBar ? "84px" : "0px");
    return () => document.documentElement.style.setProperty("--sticky-bar", "0px");
  }, [showBar]);

  const add = () => {
    if (!variant || stock <= 0) return;
    const img = product.images.find((i) => i.variant_id === variant.id) ?? product.images[0];
    cart.add({ variantId: variant.id, sku: variant.sku, category: product.category?.name, productId: product.id, slug: product.slug, name: product.name, variantName: variant.name, image: img?.url ?? null, unitPrice: price, maxStock: stock }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  /** "Buy now" opens the single-page checkout right here instead of leaving the page. */
  const buyNow = () => {
    const el = document.getElementById("order-now");
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setTimeout(() => (document.getElementById("qo-name") as HTMLInputElement | null)?.focus({ preventScroll: true }), 450);
  };

  const valueState = (name: string, value: string) => {
    const candidate = product.variants.find((v) => v.options[name] === value && options.every((o) => o === name || v.options[o] === selected[o]))
      ?? product.variants.find((v) => v.options[name] === value);
    return { exists: Boolean(candidate), inStock: (candidate?.stock ?? 0) > 0 };
  };

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery images={product.images} name={product.name} activeIndex={imageIndex} />

        <div className="lg:sticky lg:top-28 lg:h-max">
          {product.category && <Link href={`/shop?category=${product.category.slug}`} className="eyebrow -my-3 inline-flex min-h-10 items-center text-electric hover:underline">{product.category.name}</Link>}
          <h1 className="display mt-3 text-[clamp(2.4rem,6vw,4.2rem)]">{product.name}</h1>
          {product.name_bn && <p className="bn mt-2 text-lg text-slate" lang="bn">{product.name_bn}</p>}
          <p className="mt-4 text-lg text-slate">{product.short_description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span key={price} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
                <Price value={price} compareAt={was} size="xl" />
              </m.span>
            </AnimatePresence>
            <StockBadge stock={stock} threshold={product.low_stock_threshold} />
          </div>

          {options.map((name) => {
            const values = [...new Set(product.variants.map((v) => v.options[name]).filter(Boolean))];
            const isColor = name.toLowerCase() === "color" || name.toLowerCase() === "colour";
            return (
              <fieldset key={name} className="mt-7">
                <legend className="mb-3 text-sm font-semibold">{name}: <span className="font-normal text-slate">{selected[name]}</span></legend>
                <div className="flex flex-wrap gap-2">
                  {values.map((val) => {
                    const st = valueState(name, val);
                    const on = selected[name] === val;
                    if (isColor) {
                      const c = swatch(val);
                      return (
                        <button key={val} type="button" onClick={() => setSelected((s) => ({ ...s, [name]: val }))} aria-pressed={on} aria-label={`${val}${st.inStock ? "" : " — sold out"}`}
                          className={clsx("relative flex h-12 items-center gap-2 rounded-full pl-1.5 pr-4 text-sm font-semibold transition", on ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)] hover:bg-cloud", !st.inStock && "opacity-60")}>
                          <span className="size-9 rounded-full" style={{ background: c, boxShadow: isLight(c) ? "inset 0 0 0 1px rgba(11,21,48,.18)" : undefined }} />
                          <span className={clsx(!st.inStock && "line-through")}>{val}</span>
                        </button>
                      );
                    }
                    return (
                      <button key={val} type="button" onClick={() => setSelected((s) => ({ ...s, [name]: val }))} aria-pressed={on}
                        className={clsx("h-12 min-w-16 rounded-full px-5 text-sm font-semibold transition", on ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)] hover:bg-cloud", !st.inStock && "line-through opacity-60")}>
                        {val}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div ref={buttons} className="mt-8 flex flex-wrap items-center gap-3">
            <Stepper value={qty} max={Math.max(1, maxQty)} onChange={setQty} label={product.name} />
            <Button size="lg" onClick={() => add()} disabled={stock <= 0} className="flex-1 sm:flex-none">
              {added ? <><Check className="size-5" /> Added to bag</> : <><ShoppingBag className="size-5" /> Add to bag</>}
            </Button>
            <Button size="lg" variant="dark" onClick={buyNow} disabled={stock <= 0} className="flex-1 sm:flex-none" aria-controls="order-now">
              <Zap className="size-5" /> Buy now
            </Button>
            <WishlistButton slug={product.slug} name={product.name} withLabel />
          </div>
          {stock <= 0 && <p className="mt-3 text-sm text-slate">This option is sold out. Try another option or ask us on chat when it&apos;s back.</p>}

          <DeliveryEstimator shipping={shipping} subtotal={price * qty} />

          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {payments.cod?.enabled && <Perk icon={Banknote}>Cash on Delivery</Perk>}
            {(payments.bkash_manual?.enabled || payments.nagad_manual?.enabled) && <Perk icon={Smartphone}>bKash / Nagad advance</Perk>}
            <Perk icon={ShieldCheck}>Check before you pay</Perk>
            <Perk icon={Truck}>Dispatch within 24h</Perk>
          </ul>

          {children}
        </div>
      </div>

      <QuickOrder
        product={product} variant={variant} onVariant={(v) => setSelected({ ...v.options })}
        qty={qty} maxQty={maxQty} onQty={setQty} price={price} shipping={shipping} payments={payments}
      />

      <AnimatePresence>
        {showBar && (
          <m.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              {product.images[imageIndex] && <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-cloud"><Image src={product.images[imageIndex].url} alt="" fill sizes="48px" className="object-cover" /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{product.name}{variant && variant.name !== "Default" ? ` · ${variant.name}` : ""}</p>
                <p className="font-display font-bold">{formatTaka(price)}</p>
              </div>
              <Button size="md" onClick={() => add()} disabled={stock <= 0}>{added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}<span className="sr-only sm:not-sr-only">Add</span></Button>
              <Button size="md" variant="dark" onClick={buyNow} disabled={stock <= 0} aria-controls="order-now">Buy now</Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock <= 0) return <span className="rounded-full bg-flame/10 px-3 py-1 text-sm font-semibold text-flame">Sold out</span>;
  if (stock <= threshold) return <span className="rounded-full bg-sun/20 px-3 py-1 text-sm font-semibold text-[#94600a]">Only {stock} left</span>;
  return <span className="flex items-center gap-1.5 text-sm font-semibold text-mint"><span className="size-2 rounded-full bg-mint" /> In stock</span>;
}

function Perk({ icon: Icon, children }: { icon: typeof Truck; children: React.ReactNode }) {
  return <li className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-[var(--shadow-card)]"><Icon className="size-4 text-electric" /> {children}</li>;
}

function DeliveryEstimator({ shipping, subtotal }: { shipping: ShippingSettings; subtotal: number }) {
  const [district, setDistrict] = useStoredValue("sn_district", (r) => r ?? "", "");
  const zones = district ? zonesForDistrict(shipping, district) : [];
  const free = shipping.free_shipping_threshold !== null && subtotal >= (shipping.free_shipping_threshold ?? Infinity);
  return (
    <div className="mt-8 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
      <label htmlFor="pdp-district" className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-tangerine" /> Delivery to</label>
      <select id="pdp-district" value={district} onChange={(e) => setDistrict(e.target.value)} className="input mt-2">
        <option value="">Choose your district</option>
        {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
      </select>
      {zones.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {zones.map((z) => (
            <li key={z.id} className="flex justify-between gap-2">
              <span>{z.label}{z.eta ? <span className="text-slate"> · {z.eta}</span> : null}</span>
              <span className="font-semibold">{free ? <><s className="mr-1 text-mist">{formatTaka(z.fee)}</s>Free</> : formatTaka(z.fee)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecentlyViewed({ exclude }: { exclude: string }) {
  const [recent] = useStoredValue<{ slug: string; name: string; image: string | null }[]>("sn_recent", parseJsonArray, []);
  const items = recent.filter((x) => x.slug !== exclude).slice(0, 6);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent" className="mx-auto mt-20 max-w-7xl px-4 sm:px-8">
      <h2 id="recent" className="display text-3xl">Recently viewed</h2>
      <div className="scrollbar-none -mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-2">
        {items.map((i) => (
          <Link key={i.slug} href={`/shop/${i.slug}`} className="w-36 shrink-0">
            <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-cloud">{i.image && <Image src={i.image} alt="" fill sizes="144px" className="object-cover" />}</span>
            <span className="mt-2 line-clamp-2 block text-sm font-semibold">{i.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
