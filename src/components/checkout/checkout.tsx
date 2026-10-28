"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Banknote, Check, ChevronDown, ChevronLeft, Loader2, Lock, ShieldAlert, Smartphone, Tag, Upload } from "lucide-react";
import clsx from "clsx";
import { cart, useCart } from "@/components/cart/cart-store";
import { deliverySchema, type DeliveryInput } from "@/lib/validation/checkout";
import { normalizeBdPhone } from "@/lib/validation/common";
import { DISTRICTS, zonesForDistrict, type ShippingSettings } from "@/lib/shipping";
import type { PaymentSettings } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { placeOrder, quoteCart, uploadPaymentProof, type Quote } from "@/actions/checkout";
import { Button, ButtonLink } from "@/components/ui/button";
import { Streaks } from "@/components/ui/streaks";

type Method = "cod" | "bkash_manual" | "nagad_manual";
type Keys = { idempotencyKey: string; accessToken: string };

function newKeys(): Keys {
  const b = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { idempotencyKey: crypto.randomUUID() + "-" + Date.now().toString(36), accessToken: token };
}

export function Checkout({ shipping, payments }: { shipping: ShippingSettings; payments: PaymentSettings }) {
  const router = useRouter();
  const state = useCart();
  const items = useMemo(() => state.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), [state.items]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const [method, setMethod] = useState<Method | null>(null);
  const [payLater, setPayLater] = useState(false);
  const [sender, setSender] = useState("");
  const [txid, setTxid] = useState("");
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null);
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [quoting, startQuote] = useTransition();
  const keys = useRef<Keys | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const form = useForm<DeliveryInput>({ resolver: zodResolver(deliverySchema), mode: "onTouched", defaultValues: { name: "", phone: "", email: "", district: "", zone: "", area: "", address: "", note: "" } });
  const district = useWatch({ control: form.control, name: "district" });
  const zone = useWatch({ control: form.control, name: "zone" });
  const phone = useWatch({ control: form.control, name: "phone" });
  const zones = district ? zonesForDistrict(shipping, district) : [];

  // Idempotency key + order secret survive a refresh but not a completed order.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("sn_checkout") ?? "null") as Keys | null;
      keys.current = saved?.idempotencyKey && saved.accessToken ? saved : newKeys();
      sessionStorage.setItem("sn_checkout", JSON.stringify(keys.current));
      const d = JSON.parse(localStorage.getItem("sn_delivery") ?? "null");
      if (d) form.reset({ ...form.getValues(), ...d });
    } catch {
      keys.current = newKeys();
    }
    const firstMethod = (["cod", "bkash_manual", "nagad_manual"] as Method[]).find((m) => payments[m]?.enabled) ?? null;
    setMethod(firstMethod);
  }, [form, payments]);

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
  const ready = Boolean(quote) && stockIssues.length === 0 && !quoting;

  const goTo = (s: 1 | 2 | 3) => {
    setStep(s);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const submitDelivery = form.handleSubmit((d) => {
    try { localStorage.setItem("sn_delivery", JSON.stringify({ ...d, note: "" })); } catch {}
    goTo(2);
  });

  const validatePayment = () => {
    const errs: Record<string, string> = {};
    if (!method) errs.method = "Choose a payment method";
    if (method && method !== "cod" && !payLater) {
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(sender.replace(/[\s-]/g, ""))) errs.sender = "Enter the number you paid from";
      if (!/^[A-Za-z0-9]{6,20}$/.test(txid.trim())) errs.txid = "Enter the Transaction ID from the SMS";
    }
    setPayErrors(errs);
    return Object.keys(errs).length === 0;
  };

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
    });
    if (res.ok) {
      try {
        const saved = JSON.parse(localStorage.getItem("sn_orders") ?? "[]");
        localStorage.setItem("sn_orders", JSON.stringify([{ number: res.orderNumber, token: res.token, total: res.total, at: new Date().toISOString() }, ...saved].slice(0, 20)));
        sessionStorage.removeItem("sn_checkout");
      } catch {}
      cart.clear();
      router.replace(`/order/${res.orderNumber}?t=${encodeURIComponent(res.token)}&new=1`);
      return;
    }
    setPlacing(false);
    setSubmitError(res.error);
    if (res.code === "OUT_OF_STOCK" || res.code === "PRODUCT_UNAVAILABLE") runQuote();
    if (res.fieldErrors && Object.keys(res.fieldErrors).some((k) => k.startsWith("delivery"))) goTo(1);
  };

  if (state.hydrated && state.items.length === 0 && !placing) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <Streaks className="h-10 w-20" />
        <h1 className="display mt-6 text-4xl">Your bag is empty</h1>
        <p className="mt-3 text-slate">Add something you like and come back here to check out.</p>
        <ButtonLink href="/shop" className="mt-6">Browse the shop</ButtonLink>
      </div>
    );
  }

  const Summary = (
    <div className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
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
        <button type="submit" className="h-12 rounded-xl bg-ink px-4 text-sm font-semibold text-white">Apply</button>
      </form>
      {appliedCoupon && (couponIssue ? <p className="field-error">{couponMessage(couponIssue)}</p> : quote && quote.discount > 0 ? <p className="mt-2 text-sm font-semibold text-mint">✓ {appliedCoupon} applied</p> : null)}

      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        <Row label="Subtotal" value={quote ? formatTaka(quote.subtotal) : "—"} />
        {quote && quote.discount > 0 && <Row label={`Discount (${appliedCoupon})`} value={`−${formatTaka(quote.discount)}`} accent />}
        <Row label={quote?.shipping ? `Delivery · ${quote.shipping.label}` : "Delivery"} value={quote?.shipping ? (quote.shipping.fee === 0 ? "Free" : formatTaka(quote.shipping.fee)) : "Choose district"} />
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-2xl font-bold tabular-nums">{quote?.shipping ? formatTaka(total) : "—"}</dd>
        </div>
      </dl>
      {quoting && <p className="mt-2 flex items-center gap-2 text-xs text-slate"><Loader2 className="size-3 animate-spin" /> Updating prices…</p>}
      {quoteError && <p className="field-error">{quoteError}</p>}
      <p className="mt-4 flex items-center gap-2 text-xs text-slate"><Lock className="size-3.5" /> Prices and stock are confirmed by our server when you place the order.</p>
    </div>
  );

  return (
    <div ref={top} className="mx-auto grid max-w-6xl scroll-mt-28 gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="min-w-0">
        <ol className="mb-6 flex items-center gap-2 text-sm font-semibold" aria-label="Checkout steps">
          {["Delivery", "Payment", "Review"].map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            return (
              <li key={label} className="flex items-center gap-2">
                <button type="button" disabled={n >= step} onClick={() => goTo(n)} aria-current={n === step ? "step" : undefined}
                  className={clsx("flex h-10 items-center gap-2 rounded-full px-2.5 sm:px-4", n === step ? "bg-ink text-white" : n < step ? "bg-mint/15 text-[#0b7a55]" : "bg-white text-mist")}>
                  <span className="grid size-6 place-items-center rounded-full bg-white/20 text-xs">{n < step ? <Check className="size-3.5" /> : n}</span><span className={clsx(n !== step && "sr-only sm:not-sr-only")}>{label}</span>
                </button>
                {i < 2 && <span className="h-px w-3 bg-line sm:w-6" />}
              </li>
            );
          })}
        </ol>

        <details className="mb-6 rounded-[1.5rem] bg-white shadow-[var(--shadow-card)] lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold">
            <span>Order summary ({state.items.length})</span>
            <span className="flex items-center gap-1 font-display text-lg">{quote?.shipping ? formatTaka(total) : quote ? formatTaka(quote.subtotal) : "…"} <ChevronDown className="size-4" /></span>
          </summary>
          <div className="px-1 pb-1">{Summary}</div>
        </details>

        {step === 1 && (
          <form onSubmit={submitDelivery} noValidate className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
            <h1 className="display text-3xl sm:text-4xl">Where should we deliver?</h1>
            <p className="bn mt-1 text-slate" lang="bn">কোথায় পাঠাব?</p>
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
            <Button type="submit" size="lg" className="mt-8 w-full sm:w-auto">Continue to payment</Button>
          </form>
        )}

        {step === 2 && (
          <div className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
            <h1 className="display text-3xl sm:text-4xl">How would you like to pay?</h1>
            <fieldset className="mt-6 space-y-3">
              <legend className="sr-only">Payment method</legend>
              {(["cod", "bkash_manual", "nagad_manual"] as Method[]).filter((m) => payments[m]?.enabled).map((m) => (
                <label key={m} className={clsx("flex cursor-pointer items-start gap-4 rounded-2xl p-4 ring-1 transition", method === m ? "bg-electric/5 ring-2 ring-electric" : "ring-line hover:bg-paper")}>
                  <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="mt-1 size-4 accent-electric" />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      {m === "cod" ? <Banknote className="size-5 text-mint" /> : <Smartphone className={clsx("size-5", m === "bkash_manual" ? "text-[#e2136e]" : "text-[#f6921e]")} />}
                      {m === "cod" ? "Cash on Delivery" : m === "bkash_manual" ? "bKash (Send Money)" : "Nagad (Send Money)"}
                    </span>
                    <span className="mt-1 block text-sm text-slate">{m === "cod" ? payments.cod.note ?? "Pay the delivery person when the parcel arrives." : "Pay in advance. Our team verifies the payment before dispatch."}</span>
                  </span>
                </label>
              ))}
              {payErrors.method && <p className="field-error">{payErrors.method}</p>}
            </fieldset>

            {method && method !== "cod" && (
              <ManualPayment
                cfg={payments[method]}
                label={method === "bkash_manual" ? "bKash" : "Nagad"}
                total={quote?.shipping ? total : null}
                payLater={payLater} setPayLater={setPayLater}
                sender={sender} setSender={setSender} txid={txid} setTxid={setTxid}
                proof={proof} setProof={setProof} errors={payErrors}
              />
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Button type="button" variant="ghost" size="lg" onClick={() => goTo(1)}><ChevronLeft className="size-5" /> Back</Button>
              <Button type="button" size="lg" onClick={() => validatePayment() && goTo(3)}>Review order</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
            <h1 className="display text-3xl sm:text-4xl">Check and place your order</h1>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ReviewBlock title="Deliver to" onEdit={() => goTo(1)}>
                <p className="font-semibold">{form.getValues("name")} · {normalizeBdPhone(form.getValues("phone"))}</p>
                <p>{form.getValues("address")}{form.getValues("area") ? `, ${form.getValues("area")}` : ""}, {form.getValues("district")}</p>
                {quote?.shipping && <p className="text-slate">{quote.shipping.label}{quote.shipping.eta ? ` · ${quote.shipping.eta}` : ""}</p>}
                {form.getValues("note") && <p className="text-slate">Note: {form.getValues("note")}</p>}
              </ReviewBlock>
              <ReviewBlock title="Payment" onEdit={() => goTo(2)}>
                <p className="font-semibold">{method === "cod" ? "Cash on Delivery" : method === "bkash_manual" ? "bKash" : "Nagad"}</p>
                {method !== "cod" && (payLater ? <p className="text-slate">You&apos;ll pay from the order page after placing the order.</p> : <p className="text-slate">TrxID {txid.toUpperCase()} from {sender}{proof ? " · screenshot attached" : ""}</p>)}
              </ReviewBlock>
            </div>
            {stockIssues.length > 0 && (
              <p className="mt-6 flex items-start gap-2 rounded-2xl bg-flame/10 p-4 text-sm font-medium text-[#a3290f]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Some items changed since you added them. Please adjust your bag before placing the order.</p>
            )}
            {submitError && <p role="alert" className="mt-6 flex items-start gap-2 rounded-2xl bg-flame/10 p-4 text-sm font-medium text-[#a3290f]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {submitError}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" size="lg" onClick={() => goTo(2)} disabled={placing}><ChevronLeft className="size-5" /> Back</Button>
              <Button type="button" size="lg" onClick={place} disabled={!ready || placing || !quote?.shipping} className="min-w-56 flex-1 sm:flex-none" aria-busy={placing}>
                {placing ? <><Loader2 className="size-5 animate-spin" /> Placing order…</> : <>Place order · {formatTaka(total)}</>}
              </Button>
            </div>
            <p className="mt-4 text-xs text-slate">By placing the order you agree to our <Link href="/help#returns" className="underline">returns & refund policy</Link>. {method === "cod" ? "You pay when the parcel arrives." : "Your order is confirmed once we verify the payment."}</p>
          </div>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <h2 className="display mb-4 text-2xl">Order summary</h2>
          {Summary}
        </div>
      </aside>
    </div>
  );
}

function ManualPayment(props: {
  cfg: PaymentSettings["bkash_manual"]; label: string; total: number | null;
  payLater: boolean; setPayLater: (v: boolean) => void; sender: string; setSender: (v: string) => void; txid: string; setTxid: (v: string) => void;
  proof: { path: string; name: string } | null; setProof: (v: { path: string; name: string } | null) => void; errors: Record<string, string>;
}) {
  const { cfg, label, total, payLater, setPayLater, sender, setSender, txid, setTxid, proof, setProof, errors } = props;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  return (
    <div className="mt-6 rounded-[1.5rem] bg-paper p-5">
      <p className="flex items-start gap-2 rounded-xl bg-sun/20 p-3 text-sm font-medium text-[#7a4d05]">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" /> We will never ask for your {label} PIN or OTP. Never share them with anyone, including us.
      </p>
      <ol className="mt-4 space-y-2 text-sm">
        <li>1. {cfg.instructions}</li>
        <li>2. Our {label} number ({cfg.account_type}): <b className="font-mono text-base tracking-wide">{cfg.number}</b></li>
        <li>3. Amount: <b>{total !== null ? formatTaka(total) : "shown after you choose your district"}</b></li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="When will you pay?">
        <button type="button" role="radio" aria-checked={!payLater} onClick={() => setPayLater(false)} className={clsx("h-10 rounded-full px-4 text-sm font-semibold", !payLater ? "bg-ink text-white" : "bg-white ring-1 ring-line")}>I&apos;ve paid — enter details</button>
        <button type="button" role="radio" aria-checked={payLater} onClick={() => setPayLater(true)} className={clsx("h-10 rounded-full px-4 text-sm font-semibold", payLater ? "bg-ink text-white" : "bg-white ring-1 ring-line")}>I&apos;ll pay after ordering</button>
      </div>
      {!payLater && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={`Your ${label} number`} error={errors.sender}>
            <input value={sender} onChange={(e) => setSender(e.target.value)} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" className="input" aria-invalid={!!errors.sender} />
          </Field>
          <Field label="Transaction ID (TrxID)" error={errors.txid}>
            <input value={txid} onChange={(e) => setTxid(e.target.value.replace(/\s/g, ""))} placeholder="e.g. 9JK4L2M8QA" className="input font-mono uppercase" autoCapitalize="characters" aria-invalid={!!errors.txid} />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex w-max cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-line">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {proof ? `Screenshot: ${proof.name}` : "Attach screenshot (optional)"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                setUploadError(null);
                const fd = new FormData();
                fd.set("file", f);
                const r = await uploadPaymentProof(fd);
                setUploading(false);
                if (r.ok) setProof({ path: r.path, name: f.name });
                else setUploadError(r.error);
              }} />
            </label>
            {uploadError && <p className="field-error">{uploadError}</p>}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-slate">A Transaction ID or screenshot is not proof of payment on its own — our team checks it against our {label} account and then confirms your order.</p>
    </div>
  );
}

function Field({ label, hint, error, className, children }: { label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {hint && <span className="ml-1 font-normal text-mist">· {hint}</span>}
        <span className="mt-1.5 block font-normal">{children}</span>
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
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

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-paper p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="eyebrow text-mist">{title}</h2>
        <button type="button" onClick={onEdit} className="text-sm font-semibold text-electric underline">Edit</button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function couponMessage(code: string) {
  const m: Record<string, string> = {
    COUPON_INVALID: "That coupon code isn't valid.", COUPON_EXPIRED: "That coupon has expired.", COUPON_NOT_STARTED: "That coupon isn't active yet.",
    COUPON_EXHAUSTED: "That coupon has been fully used.", COUPON_MIN_SUBTOTAL: "Your subtotal is below this coupon's minimum.", COUPON_PHONE_LIMIT: "This coupon was already used with this phone number.",
  };
  return m[code] ?? "This coupon can't be applied.";
}
