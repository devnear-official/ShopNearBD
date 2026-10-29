"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Banknote, ChevronDown, Loader2, Lock, MessageCircle, PhoneCall, Smartphone, Tag, Zap } from "lucide-react";
import clsx from "clsx";
import type { PaymentSettings, ProductDetail, Variant } from "@/lib/catalog";
import { deliverySchema, type DeliveryInput } from "@/lib/validation/checkout";
import { DISTRICTS, zonesForDistrict, type ShippingSettings } from "@/lib/shipping";
import { formatTaka } from "@/lib/format";
import { placeOrder, quoteCart, type Quote } from "@/actions/checkout";
import { Stepper } from "@/components/cart/cart-drawer";
import { Button } from "@/components/ui/button";
import { readAttribution, track } from "@/lib/tracking/client";
import { Field, ManualPayment, METHOD_TITLE, METHODS, accountDelivery, couponMessage, newKeys, rememberOrder, validateManual, type Keys, type Method } from "./fields";

type Props = {
  product: ProductDetail; variant: Variant | undefined; onVariant: (v: Variant) => void;
  qty: number; maxQty: number; onQty: (n: number) => void; price: number;
  shipping: ShippingSettings; payments: PaymentSettings;
};

/**
 * Single-product checkout on the product page: the customer orders this item
 * without visiting the cart or checkout. Prices, stock, delivery fee and the
 * total all come from the server (quote_cart / place_order), exactly like the
 * full checkout; the cart is left untouched.
 */
export function QuickOrder({ product, variant, onVariant, qty, maxQty, onQty, price, shipping, payments }: Props) {
  const router = useRouter();
  const enabled = METHODS.filter((m) => payments[m]?.enabled);
  const [method, setMethod] = useState<Method | null>(enabled[0] ?? null);
  const [payLater, setPayLater] = useState(false);
  const [sender, setSender] = useState("");
  const [txid, setTxid] = useState("");
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null);
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [quoting, startQuote] = useTransition();
  const keys = useRef<Keys | null>(null);
  const initiated = useRef(false);

  const form = useForm<DeliveryInput>({ resolver: zodResolver(deliverySchema), mode: "onTouched", defaultValues: { name: "", phone: "", email: "", district: "", zone: "", area: "", address: "", note: "" } });
  const district = useWatch({ control: form.control, name: "district" });
  const zone = useWatch({ control: form.control, name: "zone" });
  const phone = useWatch({ control: form.control, name: "phone" });
  const zones = useMemo(() => (district ? zonesForDistrict(shipping, district) : []), [district, shipping]);
  const variantId = variant?.id;
  const soldOut = !variant || variant.stock <= 0;

  // Fresh keys per product page; prefill details saved from an earlier order on this device.
  useEffect(() => {
    keys.current = newKeys();
    try {
      const d = JSON.parse(localStorage.getItem("sn_delivery") ?? "null");
      const pickedDistrict = localStorage.getItem("sn_district");
      form.reset({ ...form.getValues(), ...(d ?? {}), ...(!d?.district && pickedDistrict && DISTRICTS.includes(pickedDistrict) ? { district: pickedDistrict } : {}) });
      if (!d) void accountDelivery().then((a) => { if (a && !form.formState.isDirty) form.reset({ ...form.getValues(), ...a }); });
    } catch {}
  }, [form]);

  useEffect(() => {
    if (zones.length && !zones.some((z) => z.id === zone)) form.setValue("zone", zones[0].id);
  }, [zones, zone, form]);

  // Live, server-priced quote for exactly this item.
  useEffect(() => {
    if (!variantId || soldOut) return;
    const t = setTimeout(() => {
      startQuote(async () => {
        const r = await quoteCart({ items: [{ variantId, quantity: qty }], district: district || undefined, zone: zone || undefined, couponCode: appliedCoupon, phone });
        if (r.ok) { setQuote(r.quote); setQuoteError(null); } else setQuoteError(r.error);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [variantId, qty, district, zone, appliedCoupon, phone, soldOut]);

  const line = quote?.lines.find((l) => l.variant_id === variantId);
  const issue = quote?.issues.find((i) => i.variant_id === variantId);
  const couponIssue = quote?.issues.find((i) => i.issue.startsWith("COUPON"))?.issue;
  const eventItems = () => [{ id: variant?.sku ?? product.sku, name: product.name, quantity: qty, price: line?.unit_price ?? price, category: product.category?.name }];

  const onFirstInteraction = () => {
    if (initiated.current || soldOut) return;
    initiated.current = true;
    track("InitiateCheckout", { value: (line?.unit_price ?? price) * qty, items: eventItems() });
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) =>
    form.handleSubmit(async (d) => {
      const errs = validateManual(method, payLater, sender, txid);
      setPayErrors(errs);
      if (Object.keys(errs).length || !variant || !method || !keys.current || placing) return;
      if (!quote?.shipping) { setSubmitError("Choose your district so we can add the delivery charge."); return; }
      setSubmitError(null);
      setPlacing(true);
      onFirstInteraction();
      track("AddPaymentInfo", { value: quote.total, items: eventItems() });
      try { localStorage.setItem("sn_delivery", JSON.stringify({ ...d, note: "" })); } catch {}
      const res = await placeOrder({
        items: [{ variantId: variant.id, quantity: qty }],
        delivery: d,
        payment: method === "cod" ? { method } : { method, payLater, senderNumber: sender, transactionId: txid },
        couponCode: appliedCoupon,
        idempotencyKey: keys.current.idempotencyKey,
        accessToken: keys.current.accessToken,
        proofPath: proof?.path,
        attribution: readAttribution(),
      });
      if (res.ok) {
        rememberOrder(res);
        router.push(`/order/${res.orderNumber}/thank-you?t=${encodeURIComponent(res.token)}`);
        return;
      }
      setPlacing(false);
      setSubmitError(res.error);
      if (res.code === "DUPLICATE") keys.current = newKeys();
    })(e);

  if (soldOut) {
    return (
      <section id="order-now" aria-labelledby="qo-title" className="mt-16 scroll-mt-24 rounded-[2rem] bg-white p-6 text-center shadow-[var(--shadow-card)]">
        <h2 id="qo-title" className="display t-sub">Order this now</h2>
        <p className="mt-2 text-slate">This option is sold out. Pick another {product.option_names[0]?.toLowerCase() ?? "option"} above, or ask us on chat when it&apos;s back.</p>
      </section>
    );
  }

  const errors = form.formState.errors;
  return (
    <section id="order-now" aria-labelledby="qo-title" className="mt-16 scroll-mt-24 overflow-hidden rounded-[2.25rem] bg-white shadow-[var(--shadow-float)]">
      <header className="relative overflow-hidden bg-ink px-5 py-6 text-white sm:px-8">
        <div aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full bg-electric/50 blur-[70px]" />
        <p className="eyebrow relative text-tangerine">Single-page checkout</p>
        <h2 id="qo-title" className="display relative mt-1 t-section">Order this now</h2>
        <p className="bn relative text-white/75" lang="bn">এখানেই নাম, ফোন আর ঠিকানা দিয়ে অর্ডার করুন — অন্য পেজে যেতে হবে না।</p>
      </header>

      <form onSubmit={submit} onFocusCapture={onFirstInteraction} noValidate className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" error={errors.name?.message}>
              <input {...form.register("name")} id="qo-name" autoComplete="name" className="input" aria-invalid={!!errors.name} />
            </Field>
            <Field label="Mobile number" hint="We'll call to confirm" error={errors.phone?.message}>
              <input {...form.register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" className="input" aria-invalid={!!errors.phone} />
            </Field>
            <Field label="District" error={errors.district?.message}>
              <select {...form.register("district")} autoComplete="address-level1" className="input" aria-invalid={!!errors.district}>
                <option value="">Choose district</option>
                {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Area / Thana (optional)" error={errors.area?.message}>
              <input {...form.register("area")} autoComplete="address-level2" placeholder="e.g. Mirpur 10" className="input" />
            </Field>
            {zones.length > 1 && (
              <fieldset className="sm:col-span-2">
                <legend className="label">Delivery area</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {zones.map((z) => (
                    <label key={z.id} className={clsx("flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-3.5 ring-1 transition", zone === z.id ? "bg-electric/5 ring-2 ring-electric" : "ring-line")}>
                      <span className="flex items-center gap-3">
                        <input type="radio" value={z.id} {...form.register("zone")} className="size-4 accent-electric" />
                        <span><span className="block font-semibold">{z.label}</span>{z.eta && <span className="text-sm text-slate">{z.eta}</span>}</span>
                      </span>
                      <span className="font-bold">{formatTaka(z.fee)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <Field label="Full address" hint="House, road, landmark" error={errors.address?.message} className="sm:col-span-2">
              <textarea {...form.register("address")} rows={2} autoComplete="street-address" className="input" aria-invalid={!!errors.address} />
            </Field>
            <Field label="Note for us (optional)" error={errors.note?.message} className="sm:col-span-2">
              <input {...form.register("note")} placeholder="e.g. call before coming" className="input" />
            </Field>
          </div>

          <fieldset className="mt-7">
            <legend className="label">Payment</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {enabled.map((m) => (
                <label key={m} className={clsx("flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 ring-1 transition", method === m ? "bg-electric/5 ring-2 ring-electric" : "ring-line hover:bg-paper")}>
                  <input type="radio" name="qo-method" checked={method === m} onChange={() => setMethod(m)} className="size-4 accent-electric" />
                  {m === "cod" ? <Banknote className="size-5 shrink-0 text-mint" /> : <Smartphone className={clsx("size-5 shrink-0", m === "bkash_manual" ? "text-[#e2136e]" : "text-[#f6921e]")} />}
                  <span className="text-sm font-semibold">{m === "cod" ? "Cash on Delivery" : METHOD_TITLE[m].replace(" (Send Money)", "")}</span>
                </label>
              ))}
            </div>
            {payErrors.method && <p className="field-error">{payErrors.method}</p>}
          </fieldset>
          {method && method !== "cod" && (
            <ManualPayment
              cfg={payments[method]} label={method === "bkash_manual" ? "bKash" : "Nagad"} total={quote?.shipping ? quote.total : null}
              payLater={payLater} setPayLater={setPayLater} sender={sender} setSender={setSender} txid={txid} setTxid={setTxid}
              proof={proof} setProof={setProof} errors={payErrors}
            />
          )}
        </div>

        <aside className="min-w-0 lg:border-l lg:border-line lg:pl-8">
          <h3 className="eyebrow text-mist">Your order</h3>
          <div className="mt-3 flex gap-3">
            <span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-cloud">
              {(line?.image_url ?? product.images[0]?.url) && <Image src={(line?.image_url ?? product.images[0]?.url)!} alt="" fill sizes="80px" className="object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold leading-snug">{product.name}</p>
              {product.variants.length > 1 ? (
                <label className="mt-1.5 block">
                  <span className="sr-only">Option</span>
                  <select value={variant?.id} onChange={(e) => { const v = product.variants.find((x) => x.id === e.target.value); if (v) onVariant(v); }} className="input h-10 py-0 text-sm">
                    {product.variants.map((v) => <option key={v.id} value={v.id} disabled={v.stock <= 0}>{v.name}{v.stock <= 0 ? " — sold out" : ""}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <Stepper value={qty} max={Math.max(1, maxQty)} onChange={onQty} label={product.name} />
                <span className="font-bold tabular-nums">{formatTaka(line?.line_total ?? price * qty)}</span>
              </div>
            </div>
          </div>
          {issue && <p className="mt-3 flex gap-2 text-sm font-semibold text-flame"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{issue.issue === "insufficient_stock" ? (issue.available ? `Only ${issue.available} left — lower the quantity` : "Just sold out") : "No longer available"}</p>}

          <button type="button" onClick={() => setCouponOpen((o) => !o)} aria-expanded={couponOpen} className="mt-4 flex min-h-10 items-center gap-1.5 text-sm font-semibold text-electric">
            <Tag className="size-4" /> Have a coupon? <ChevronDown className={clsx("size-4 transition", couponOpen && "rotate-180")} />
          </button>
          {couponOpen && (
            <div className="flex gap-2">
              <label htmlFor="qo-coupon" className="sr-only">Coupon code</label>
              <input id="qo-coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setAppliedCoupon(coupon.trim().toUpperCase() || undefined); } }} placeholder="Code" className="input uppercase" autoCapitalize="characters" />
              <button type="button" onClick={() => setAppliedCoupon(coupon.trim().toUpperCase() || undefined)} className="h-12 shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white">Apply</button>
            </div>
          )}
          {appliedCoupon && (couponIssue ? <p className="field-error">{couponMessage(couponIssue)}</p> : quote && quote.discount > 0 ? <p className="mt-2 text-sm font-semibold text-mint">✓ {appliedCoupon} applied</p> : null)}

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd className="font-semibold tabular-nums">{quote ? formatTaka(quote.subtotal) : "—"}</dd></div>
            {quote && quote.discount > 0 && <div className="flex justify-between"><dt className="text-slate">Discount</dt><dd className="font-semibold text-mint">−{formatTaka(quote.discount)}</dd></div>}
            <div className="flex justify-between gap-3"><dt className="text-slate">{quote?.shipping ? `Delivery · ${quote.shipping.label}` : "Delivery"}</dt><dd className="font-semibold tabular-nums">{quote?.shipping ? (quote.shipping.fee === 0 ? "Free" : formatTaka(quote.shipping.fee)) : "Choose district"}</dd></div>
            <div className="flex items-baseline justify-between border-t border-line pt-3"><dt className="font-semibold">Total</dt><dd className="font-display text-2xl font-bold tabular-nums">{quote?.shipping ? formatTaka(quote.total) : "—"}</dd></div>
          </dl>
          {quoting && <p className="mt-1 flex items-center gap-2 text-xs text-slate"><Loader2 className="size-3 animate-spin" /> Updating…</p>}
          {quoteError && <p className="field-error">{quoteError}</p>}
          {submitError && <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-flame/10 p-3 text-sm font-medium text-[#a3290f]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {submitError}</p>}

          <Button type="submit" size="lg" variant="tangerine" disabled={placing || Boolean(issue)} aria-busy={placing} className="mt-5 w-full" data-quick-order-submit>
            {placing ? <><Loader2 className="size-5 animate-spin" /> Placing order…</> : <><Zap className="size-5" /> Confirm order{quote?.shipping ? ` · ${formatTaka(quote.total)}` : ""}</>}
          </Button>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate"><PhoneCall className="size-3.5 shrink-0" /> We call to confirm before dispatch. {method === "cod" ? "Pay when the parcel arrives." : ""}</p>
          <button type="button" onClick={() => window.dispatchEvent(new Event("sn:open-chat"))} className="mt-2 flex min-h-10 items-center gap-2 text-sm font-semibold text-electric sm:hidden"><MessageCircle className="size-4" /> Questions? Chat with us</button>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate"><Lock className="size-3.5 shrink-0" /> Prices and stock are confirmed by our server. <Link href="/help#returns" className="inline-flex min-h-10 items-center underline">Returns policy</Link></p>
        </aside>
      </form>
    </section>
  );
}
