"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Banknote, Check, ChevronDown, Loader2, Lock, MessageCircle, RotateCcw, ShieldCheck, ShoppingCart, Smartphone, Tag, Truck } from "lucide-react";
import clsx from "clsx";
import { cart, useCart } from "@/components/cart/cart-store";
import { deliverySchema, type DeliveryInput } from "@/lib/validation/checkout";
import { normalizeBdPhone } from "@/lib/validation/common";
import { DISTRICTS, zonesForDistrict, type ShippingSettings } from "@/lib/shipping";
import type { PaymentSettings } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { placeOrder, quoteCart, type Quote } from "@/actions/checkout";
import { ButtonLink } from "@/components/ui/button";
import { CapsuleFill, CapsuleShine, pressOrigin, type PressOrigin } from "@/components/ui/capsule";
import { Streaks } from "@/components/ui/streaks";
import { Field, ManualPayment, METHOD_TITLE, accountDelivery, couponMessage, newKeys, rememberOrder, validateManual, type Keys, type Method } from "./fields";
import { readAttribution, track } from "@/lib/tracking/client";

/**
 * One-page checkout: delivery details and payment together, one button. Fewer steps means
 * fewer people drop off, so everything needed to place the order is on this single screen.
 */
export function Checkout({ shipping, payments }: { shipping: ShippingSettings; payments: PaymentSettings }) {
  const router = useRouter();
  const state = useCart();
  // Keyed by what the server needs (variant + quantity), so price/stock refreshes don't re-quote.
  const itemsKey = state.items.map((i) => `${i.variantId}:${i.quantity}`).join(",");
  const items = useMemo(() => (itemsKey ? itemsKey.split(",").map((s) => { const [variantId, q] = s.split(":"); return { variantId, quantity: Number(q) }; }) : []), [itemsKey]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const available = useMemo(() => (["cod", "bkash_manual", "nagad_manual"] as Method[]).filter((m) => payments[m]?.enabled), [payments]);
  const [method, setMethod] = useState<Method | null>(() => available[0] ?? null);
  const [payLater, setPayLater] = useState(false);
  const [sender, setSender] = useState("");
  const [txid, setTxid] = useState("");
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null);
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [origin, setOrigin] = useState<PressOrigin>(null);
  const [quoting, startQuote] = useTransition();
  const keys = useRef<Keys | null>(null);
  const initiated = useRef(false);
  const payRef = useRef<HTMLElement>(null);

  const form = useForm<DeliveryInput>({ resolver: zodResolver(deliverySchema), mode: "onTouched", defaultValues: { name: "", phone: "", email: "", district: "", zone: "", area: "", address: "", note: "" } });
  const district = useWatch({ control: form.control, name: "district" });
  const zone = useWatch({ control: form.control, name: "zone" });
  const phone = useWatch({ control: form.control, name: "phone" });
  const name = useWatch({ control: form.control, name: "name" });
  const address = useWatch({ control: form.control, name: "address" });
  const zones = useMemo(() => (district ? zonesForDistrict(shipping, district) : []), [district, shipping]);

  // Idempotency key + order secret survive a refresh but not a completed order.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("sn_checkout") ?? "null") as Keys | null;
      keys.current = saved?.idempotencyKey && saved.accessToken ? saved : newKeys();
      sessionStorage.setItem("sn_checkout", JSON.stringify(keys.current));
      const d = JSON.parse(localStorage.getItem("sn_delivery") ?? "null");
      if (d) form.reset({ ...form.getValues(), ...d });
      else void accountDelivery().then((a) => { if (a && !form.formState.isDirty) form.reset({ ...form.getValues(), ...a }); });
    } catch {
      keys.current = newKeys();
    }
  }, [form]);

  useEffect(() => {
    if (zones.length && !zones.some((z) => z.id === zone)) form.setValue("zone", zones[0].id);
  }, [zones, zone, form]);

  const runQuote = useCallback(() => {
    if (!items.length) return;
    startQuote(async () => {
      const r = await quoteCart({ items, district: district || undefined, zone: zone || undefined, couponCode: appliedCoupon, phone });
      if (r.ok) {
        setQuote(r.quote);
        setQuoteError(null);
        cart.reconcile(r.quote.lines);
        if (!initiated.current && r.quote.lines.length) {
          initiated.current = true;
          track("InitiateCheckout", { value: r.quote.subtotal, items: r.quote.lines.map((l) => ({ id: l.sku ?? l.variant_id, name: l.name, quantity: l.quantity, price: l.unit_price })) });
        }
      } else setQuoteError(r.error);
    });
  }, [items, district, zone, appliedCoupon, phone]);

  useEffect(() => {
    const t = setTimeout(runQuote, 250);
    return () => clearTimeout(t);
  }, [runQuote]);

  const couponIssue = quote?.issues.find((i) => i.issue.startsWith("COUPON"))?.issue;
  const stockIssues = quote?.issues.filter((i) => i.variant_id) ?? [];
  const total = quote?.total ?? 0;

  // How much of the form is done — a little nudge to finish.
  const deliveryDone = name.trim().length > 1 && /^01[3-9]\d{8}$/.test(normalizeBdPhone(phone)) && Boolean(district) && address.trim().length > 5;
  const done = [name.trim().length > 1, /^01[3-9]\d{8}$/.test(normalizeBdPhone(phone)), Boolean(district), address.trim().length > 5, Boolean(method)].filter(Boolean).length;

  const scrollTo = (el: Element | null) => el?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });

  const place = async () => {
    if (placing || !keys.current || !method) return;
    setSubmitError(null);
    setPlacing(true);
    const d = form.getValues();
    const res = await placeOrder({
      items,
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
      try { sessionStorage.removeItem("sn_checkout"); } catch {}
      // Let the button finish its animation, then open the thank-you page (prefetched meanwhile).
      const next = `/order/${res.orderNumber}/thank-you?t=${encodeURIComponent(res.token)}`;
      router.prefetch(next);
      setPlaced(true);
      setTimeout(() => { cart.clear(); router.replace(next); }, 750);
      return;
    }
    setPlacing(false);
    setSubmitError(res.error);
    if (res.code === "OUT_OF_STOCK" || res.code === "PRODUCT_UNAVAILABLE") runQuote();
    if (res.fieldErrors && Object.keys(res.fieldErrors).some((k) => k.startsWith("delivery"))) scrollTo(document.getElementById("delivery"));
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) =>
    form.handleSubmit(
      (d) => {
        const errs = validateManual(method, payLater, sender, txid);
        setPayErrors(errs);
        if (Object.keys(errs).length) { scrollTo(payRef.current); return; }
        try { localStorage.setItem("sn_delivery", JSON.stringify({ ...d, note: "" })); } catch {}
        track("AddPaymentInfo", { value: quote?.total, items: quote?.lines.map((l) => ({ id: l.sku ?? l.variant_id, name: l.name, quantity: l.quantity, price: l.unit_price })) });
        void place();
      },
      () => scrollTo(document.querySelector("#delivery [aria-invalid='true']") ?? document.getElementById("delivery")),
    )(e);

  // The form does not depend on the bag, so it is in the first paint; only the empty-bag message waits for the bag to be read from this device.
  if (state.hydrated && state.items.length === 0 && !placing && !placed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <Streaks className="h-10 w-20" />
        <h1 className="display mt-6 t-section">Your bag is empty</h1>
        <p className="mt-3 text-slate">Add something you like and come back here to check out.</p>
        <ButtonLink href="/shop" className="mt-6">Browse the shop</ButtonLink>
      </div>
    );
  }

  const Summary = (
    <div className="overflow-hidden rounded-[2rem] bg-white shadow-[var(--shadow-card)]">
      <div className="h-1.5 bg-gradient-to-r from-electric via-sky to-tangerine" />
      <div className="p-5 sm:p-6">
        <ul className="space-y-3">
          {(quote?.lines ?? []).map((l) => {
            const issue = quote?.issues.find((i) => i.variant_id === l.variant_id);
            return (
              <li key={l.variant_id} className="flex gap-3">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cloud">
                  {l.image_url && <Image src={l.image_url} alt="" fill sizes="64px" className="object-cover" />}
                  <span className="absolute -right-0 -top-0 grid size-6 place-items-center rounded-bl-xl bg-ink text-xs font-bold text-white">{l.quantity}</span>
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="line-clamp-2 font-semibold">{l.name}</span>
                  {l.variant_name !== "Default" && <span className="text-slate">{l.variant_name}</span>}
                  {issue && <span className="mt-1 block font-semibold text-flame">{issue.issue === "insufficient_stock" ? (issue.available ? `Only ${issue.available} left — reduce quantity` : "Sold out — remove it") : "No longer available — remove it"}</span>}
                </span>
                <span className="text-sm font-bold tabular-nums">{formatTaka(l.line_total)}</span>
              </li>
            );
          })}
          {!quote && <li className="skeleton h-16 rounded-2xl" />}
        </ul>

        <form onSubmit={(e) => { e.preventDefault(); setAppliedCoupon(coupon.trim().toUpperCase() || undefined); }} className="mt-5 flex gap-2">
          <label htmlFor="coupon" className="sr-only">Coupon code</label>
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
            <input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" className="input pl-9 uppercase" autoCapitalize="characters" />
          </div>
          <button type="submit" className="h-12 rounded-full bg-ink px-5 text-sm font-semibold text-white transition active:scale-95">Apply</button>
        </form>
        {appliedCoupon && (couponIssue ? <p className="field-error">{couponMessage(couponIssue)}</p> : quote && quote.discount > 0 ? <p className="mt-2 text-sm font-semibold text-mint">✓ {appliedCoupon} applied</p> : null)}

        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <Row label="Subtotal" value={quote ? formatTaka(quote.subtotal) : "—"} />
          {quote && quote.discount > 0 && <Row label={`Discount (${appliedCoupon})`} value={`−${formatTaka(quote.discount)}`} accent />}
          <Row label={quote?.shipping ? `Delivery · ${quote.shipping.label}` : "Delivery"} value={quote?.shipping ? (quote.shipping.fee === 0 ? "Free" : formatTaka(quote.shipping.fee)) : "Choose district"} />
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-semibold">Total</dt>
            <dd key={total} className="animate-price font-display text-3xl font-bold tabular-nums">{quote?.shipping ? formatTaka(total) : "—"}</dd>
          </div>
        </dl>
        {quoting && <p className="mt-2 flex items-center gap-2 text-xs text-slate"><Loader2 className="size-3 animate-spin" /> Updating prices…</p>}
        {quoteError && <p className="field-error">{quoteError}</p>}
        <p className="mt-4 flex items-center gap-2 text-xs text-slate"><Lock className="size-3.5" /> Prices and stock are confirmed by our server when you place the order.</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 sm:mb-8">
        <p className="eyebrow inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-mint shadow-[var(--shadow-card)]"><Lock className="size-3.5" /> Secure checkout · one page</p>
        <h1 className="display mt-4 t-page">Almost <span className="text-gradient">yours.</span></h1>
        <p className="bn mt-1 text-base text-slate sm:text-lg" lang="bn">এক পেজেই অর্ডার সম্পন্ন করুন</p>
        <div className="mt-5 flex max-w-md items-center gap-3" role="progressbar" aria-label="Checkout progress" aria-valuemin={0} aria-valuemax={5} aria-valuenow={done}>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white shadow-inner">
            <div className="h-full rounded-full bg-gradient-to-r from-electric via-sky to-mint transition-[width] duration-700 ease-[var(--ease-snap)]" style={{ width: `${(done / 5) * 100}%` }} />
          </div>
          <span className="text-xs font-bold tabular-nums text-slate">{done === 5 ? "Ready ✓" : `${done}/5`}</span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <form onSubmit={submit} noValidate className="min-w-0 space-y-5">
          <button type="button" onClick={() => window.dispatchEvent(new Event("sn:open-chat"))} className="flex min-h-10 items-center gap-2 text-sm font-semibold text-electric sm:hidden">
            <MessageCircle className="size-4" /> Need help? Chat with us
          </button>
          <details className="rounded-[1.5rem] bg-white shadow-[var(--shadow-card)] lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold">
              <span>Order summary ({state.items.length})</span>
              <span className="flex items-center gap-1 font-display text-lg">{quote?.shipping ? formatTaka(total) : quote ? formatTaka(quote.subtotal) : "…"} <ChevronDown className="size-4" /></span>
            </summary>
            <div className="px-1 pb-1">{Summary}</div>
          </details>

          {/* 1 — Delivery */}
          <section id="delivery" aria-labelledby="h-delivery" className="scroll-mt-28 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
            <SectionTitle n={1} id="h-delivery" title="Where should we deliver?" bn="কোথায় পাঠাব?" done={deliveryDone} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={form.formState.errors.name?.message}>
                <input {...form.register("name")} autoComplete="name" className="input" aria-invalid={!!form.formState.errors.name} />
              </Field>
              <Field label="Mobile number" hint="We'll call this number to confirm" error={form.formState.errors.phone?.message}>
                <input {...form.register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" className="input" aria-invalid={!!form.formState.errors.phone} />
              </Field>
              <Field label="District" error={form.formState.errors.district?.message}>
                <select {...form.register("district")} autoComplete="address-level1" className="input" aria-invalid={!!form.formState.errors.district}>
                  <option value="">Choose district</option>
                  {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Area / Thana (optional)" error={form.formState.errors.area?.message}>
                <input {...form.register("area")} autoComplete="address-level2" placeholder="e.g. Mirpur 10" className="input" />
              </Field>
              {zones.length > 1 && (
                <fieldset className="sm:col-span-2">
                  <legend className="label">Delivery area</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {zones.map((z) => (
                      <label key={z.id} className={clsx("flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-4 ring-1 transition", zone === z.id ? "bg-electric/5 ring-2 ring-electric" : "ring-line")}>
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
              <Field label="Full address" hint="House, road, block, landmark" error={form.formState.errors.address?.message} className="sm:col-span-2">
                <textarea {...form.register("address")} rows={2} autoComplete="street-address" className="input" aria-invalid={!!form.formState.errors.address} />
              </Field>
              <Field label="Email (optional)" error={form.formState.errors.email?.message}>
                <input {...form.register("email")} type="email" autoComplete="email" className="input" />
              </Field>
              <Field label="Delivery instructions (optional)" error={form.formState.errors.note?.message}>
                <input {...form.register("note")} placeholder="e.g. call before coming" className="input" />
              </Field>
            </div>
          </section>

          {/* 2 — Payment */}
          <section ref={payRef} id="payment" aria-labelledby="h-payment" className="scroll-mt-28 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
            <SectionTitle n={2} id="h-payment" title="How would you like to pay?" bn="কীভাবে পেমেন্ট করবেন?" done={Boolean(method) && Object.keys(payErrors).length === 0} />
            <fieldset className="mt-6">
              <legend className="sr-only">Payment method</legend>
              <div className={clsx("grid gap-3", available.length > 2 ? "sm:grid-cols-3" : available.length === 2 ? "sm:grid-cols-2" : "")}>
                {available.map((m) => {
                  const on = method === m;
                  return (
                    <label key={m} className={clsx("group/pay relative flex cursor-pointer flex-col gap-2 rounded-2xl p-4 ring-1 transition-[box-shadow,background-color,transform] duration-300 active:scale-[0.98]", on ? "bg-electric/5 shadow-[var(--shadow-lift)] ring-2 ring-electric" : "ring-line hover:bg-paper")}>
                      <input type="radio" name="method" checked={on} onChange={() => { setMethod(m); setPayErrors({}); }} className="sr-only" />
                      <span className="flex items-center justify-between">
                        <span className={clsx("grid size-11 place-items-center rounded-2xl transition-colors duration-300", m === "cod" ? "bg-mint/15 text-mint" : m === "bkash_manual" ? "bg-[#e2136e]/10 text-[#e2136e]" : "bg-[#f6921e]/15 text-[#f6921e]")}>
                          {m === "cod" ? <Banknote className="size-6" /> : <Smartphone className="size-6" />}
                        </span>
                        <span aria-hidden className={clsx("grid size-6 place-items-center rounded-full ring-2 transition-all duration-300", on ? "bg-electric text-white ring-electric" : "ring-line")}>
                          {on && <Check className="animate-pop size-3.5" />}
                        </span>
                      </span>
                      <span className="font-semibold">{METHOD_TITLE[m]}</span>
                      <span className="text-sm leading-snug text-slate">{m === "cod" ? payments.cod.note ?? "Pay the delivery person when the parcel arrives." : "Pay in advance. Our team verifies it before dispatch."}</span>
                    </label>
                  );
                })}
              </div>
              {payErrors.method && <p className="field-error">{payErrors.method}</p>}
            </fieldset>

            {method && method !== "cod" && (
              <div key={method} className="animate-rise">
                <ManualPayment
                  cfg={payments[method]}
                  label={method === "bkash_manual" ? "bKash" : "Nagad"}
                  total={quote?.shipping ? total : null}
                  payLater={payLater} setPayLater={setPayLater}
                  sender={sender} setSender={setSender} txid={txid} setTxid={setTxid}
                  proof={proof} setProof={setProof} errors={payErrors}
                />
              </div>
            )}
          </section>

          {stockIssues.length > 0 && (
            <p className="flex items-start gap-2 rounded-2xl bg-flame/10 p-4 text-sm font-medium text-[#a3290f]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Some items changed since you added them. Please adjust your bag before placing the order.</p>
          )}
          {submitError && <p role="alert" className="flex items-start gap-2 rounded-2xl bg-flame/10 p-4 text-sm font-medium text-[#a3290f]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {submitError}</p>}

          {/* Place order — floats at the bottom of the screen on phones while the form is on screen */}
          <div className="sticky bottom-3 z-20 -mx-1 rounded-full bg-paper/80 p-1 backdrop-blur-md lg:static lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <button
              type="submit"
              onClick={(e) => { if (!placing && !placed) setOrigin(pressOrigin(e)); }}
              disabled={!placing && !placed && stockIssues.length > 0}
              aria-busy={placing}
              className="group/cap relative flex h-16 w-full select-none items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-electric via-electric to-electric-deep px-6 text-lg font-bold text-white shadow-[var(--shadow-lift)] transition-[transform,box-shadow] duration-200 hover:shadow-[0_22px_44px_-18px_rgb(30_107_255/0.75)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50"
            >
              <CapsuleFill on={placing || placed} origin={origin} className={placed ? "bg-mint" : undefined} />
              <CapsuleShine />
              <span className={clsx("relative flex items-center gap-3 transition-opacity duration-300", (placing || placed) && "opacity-0")}>
                <ShoppingCart className="size-6" />
                Place order
                {quote?.shipping && <span className="rounded-full bg-white/20 px-3 py-1 text-base tabular-nums">{formatTaka(total)}</span>}
              </span>
              {placing && !placed && (
                <>
                  <span aria-hidden className="pointer-events-none absolute inset-0">
                    <ShoppingCart className="animate-sweep absolute top-1/2 size-7 -translate-y-1/2 text-tangerine" />
                  </span>
                  <span className="absolute inset-0 grid place-items-center text-base font-semibold">Placing your order…</span>
                </>
              )}
              {placed && <span className="animate-pop absolute inset-0 flex items-center justify-center gap-2 text-base font-semibold"><Check className="size-5" /> Order placed!</span>}
            </button>
          </div>

          <ul className="grid gap-2 text-xs font-semibold text-slate sm:grid-cols-3">
            <li className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2.5"><ShieldCheck className="size-4 shrink-0 text-mint" /> Verified by our team</li>
            <li className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2.5"><Truck className="size-4 shrink-0 text-electric" /> Delivery across Bangladesh</li>
            <li className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2.5"><RotateCcw className="size-4 shrink-0 text-tangerine" /> 7-day returns</li>
          </ul>
          <p className="text-xs text-slate">By placing the order you agree to our <Link href="/help#returns" className="underline">returns & refund policy</Link>. {method === "cod" ? "You pay when the parcel arrives." : "Your order is confirmed once we verify the payment."}</p>
        </form>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <h2 className="display mb-4 t-card">Order summary</h2>
            {Summary}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ n, id, title, bn, done }: { n: number; id: string; title: string; bn: string; done: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className={clsx("grid size-11 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold text-white transition-colors duration-500", done ? "bg-mint" : "bg-gradient-to-br from-electric to-sky")}>
        {done ? <Check className="animate-pop size-5" /> : n}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="display t-sub">{title}</h2>
        <p className="bn text-sm text-slate" lang="bn">{bn}</p>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate">{label}</dt>
      <dd className={clsx("font-semibold tabular-nums", accent && "text-mint")}>{value}</dd>
    </div>
  );
}
