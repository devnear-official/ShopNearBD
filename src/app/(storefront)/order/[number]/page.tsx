import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, MapPin, Package, Truck } from "lucide-react";
import clsx from "clsx";
import { asAnon } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { ownOrderHash } from "@/lib/customer/auth";
import { formatDateTime, formatTaka } from "@/lib/format";
import { CUSTOMER_STATUS, METHOD_LABEL, PAYMENT_STATUS, PROGRESS } from "@/lib/order-status";
import { getPublicSettings } from "@/lib/catalog";
import { TokenResolver, PayLaterForm, ReviewForms, Celebrate } from "@/components/checkout/order-client";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

type Params = { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | undefined>> };

type PublicOrder = {
  order_number: string; status: string; payment_status: string; payment_method: string; customer_name: string; phone_masked: string;
  address: string; district: string; area: string | null; zone: string; subtotal: number; discount_total: number; shipping_fee: number; total: number;
  coupon_code: string | null; created_at: string; delivered_at: string | null;
  items: { product_id: string | null; product_name: string; variant_name: string; quantity: number; unit_price: number; line_total: number; image_url: string | null; slug: string | null }[];
  history: { status: string; at: string }[];
  payments: { method: string; status: string; amount: number; transaction_id: string | null; at: string }[];
  shipment: { provider: string; status: string; tracking_code: string | null; tracking_url: string | null; consignment_id: string | null } | null;
};

export default function OrderPage(props: Params) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-8">
      <Suspense fallback={<div className="skeleton h-96 rounded-[2rem]" />}>
        <OrderView {...props} />
      </Suspense>
    </div>
  );
}

async function OrderView({ params, searchParams }: Params) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  if (!/^SN\d{11}$/.test(number)) return <TokenResolver number={number} />;
  const linkToken = sp.t && /^[A-Za-z0-9_-]{20,128}$/.test(sp.t) ? sp.t : null;
  // Without the private link, a signed-in customer can open orders placed with their own phone number.
  const hash = linkToken ? sha256(linkToken) : await ownOrderHash(number);
  if (!hash) return <TokenResolver number={number} />;
  const token = linkToken ?? "";
  const [row] = await asAnon((tx) => tx<{ o: PublicOrder | null; reviews: { product_id: string; status: string }[] }[]>`
    select public.get_order_public(${number}, ${hash}) as o, public.order_reviews(${number}, ${hash}) as reviews`);
  const o = row?.o;
  if (!o) {
    return (
      <div className="rounded-[2rem] bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <h1 className="display text-4xl">We couldn&apos;t open this order</h1>
        <p className="mx-auto mt-3 max-w-md text-slate">The link may be incomplete. For your privacy, orders open only with the private link from your confirmation page. Message us on chat or call support and we&apos;ll help.</p>
        <Link href="/order" className="mt-6 inline-block font-semibold text-electric underline">See orders saved on this device</Link>
      </div>
    );
  }
  const settings = await getPublicSettings();
  const status = CUSTOMER_STATUS[o.status] ?? CUSTOMER_STATUS.pending;
  const pay = PAYMENT_STATUS[o.payment_status] ?? PAYMENT_STATUS.unpaid;
  const stepIndex = PROGRESS.indexOf(o.status as (typeof PROGRESS)[number]);
  const closed = o.status === "cancelled" || o.status === "returned";
  const manual = o.payment_method !== "cod";
  const canPayLater = manual && ["unpaid", "failed"].includes(o.payment_status) && !closed;
  const payCfg = manual ? settings.payments[o.payment_method as "bkash_manual" | "nagad_manual"] : null;
  const fresh = sp.new === "1";

  return (
    <>
      {fresh && <Celebrate />}
      <header className={clsx("relative overflow-hidden rounded-[2.5rem] p-6 sm:p-10", fresh ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)]")}>
        <p className={clsx("eyebrow", fresh ? "text-sky" : "text-electric")}>Order {o.order_number}</p>
        <h1 className="display mt-3 text-[clamp(2.2rem,7vw,4.8rem)]">{fresh ? "Thank you! Order received." : status.label}</h1>
        <p className={clsx("bn mt-1 text-lg", fresh ? "text-white/70" : "text-slate")} lang="bn">{fresh ? "আপনার অর্ডার আমরা পেয়েছি" : status.bn}</p>
        <p className={clsx("mt-4 max-w-2xl text-lg", fresh ? "text-white/85" : "text-ink-2")}>
          {fresh
            ? manual
              ? o.payment_status === "pending_verification"
                ? "Your order is submitted. We've received your payment details and will verify them with our account before confirming — this isn't a confirmation that the payment was received yet."
                : `Your order is submitted. Please pay ${formatTaka(o.total)} by ${METHOD_LABEL[o.payment_method]} and add the Transaction ID below so we can verify it.`
              : `Your order is submitted. We'll call ${o.phone_masked} to confirm, and you'll pay ${formatTaka(o.total)} when it arrives.`
            : status.detail}
        </p>
        {fresh && <p className="mt-4 text-sm text-white/60">Bookmark this page — it&apos;s your private link to track the order. It&apos;s also saved on this device under “Track my order”.</p>}
      </header>

      {!closed ? (
        <ol className="mt-6 grid grid-cols-5 gap-1.5 sm:gap-3" aria-label="Order progress">
          {PROGRESS.map((s, i) => {
            const done = i <= stepIndex;
            const at = o.history.find((h) => h.status === s)?.at;
            return (
              <li key={s} className="min-w-0">
                <div className={clsx("h-2 rounded-full", done ? "bg-gradient-to-r from-electric to-sky" : "bg-line")} />
                <p className={clsx("mt-2 text-[0.62rem] font-semibold leading-tight sm:text-sm", done ? "text-ink" : "text-mist")}>{done && <Check className="mr-1 inline size-3.5 text-mint" />}{CUSTOMER_STATUS[s].label}</p>
                {at && <p className="hidden text-xs text-slate sm:block">{formatDateTime(at)}</p>}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-6 rounded-2xl bg-flame/10 p-4 font-semibold text-[#a3290f]">{status.detail}</p>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="items" className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
          <h2 id="items" className="display text-2xl">Items</h2>
          <ul className="mt-4 divide-y divide-line">
            {o.items.map((i, k) => (
              <li key={k} className="flex gap-3 py-3">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cloud">{i.image_url && <Image src={i.image_url} alt="" fill sizes="64px" className="object-cover" />}</span>
                <span className="min-w-0 flex-1">
                  {i.slug ? <Link href={`/shop/${i.slug}`} className="font-semibold hover:underline">{i.product_name}</Link> : <span className="font-semibold">{i.product_name}</span>}
                  <span className="block text-sm text-slate">{i.variant_name !== "Default" ? `${i.variant_name} · ` : ""}{i.quantity} × {formatTaka(i.unit_price)}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatTaka(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd>{formatTaka(o.subtotal)}</dd></div>
            {o.discount_total > 0 && <div className="flex justify-between"><dt className="text-slate">Discount {o.coupon_code ? `(${o.coupon_code})` : ""}</dt><dd className="text-mint">−{formatTaka(o.discount_total)}</dd></div>}
            <div className="flex justify-between"><dt className="text-slate">Delivery</dt><dd>{o.shipping_fee === 0 ? "Free" : formatTaka(o.shipping_fee)}</dd></div>
            <div className="flex justify-between pt-2 text-base"><dt className="font-semibold">Total</dt><dd className="font-display text-xl font-bold">{formatTaka(o.total)}</dd></div>
          </dl>
        </section>

        <div className="space-y-4">
          <section aria-labelledby="payment" className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
            <h2 id="payment" className="display text-2xl">Payment</h2>
            <p className="mt-2 font-semibold">{METHOD_LABEL[o.payment_method]}</p>
            <p className={clsx("mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold", { neutral: "bg-cloud text-ink-2", warn: "bg-sun/20 text-[#7a4d05]", good: "bg-mint/15 text-[#0b7a55]", bad: "bg-flame/10 text-[#a3290f]" }[pay.tone])}>{pay.label}</p>
            {o.payments.filter((p) => p.transaction_id).map((p) => <p key={p.transaction_id} className="mt-2 text-sm text-slate">TrxID <span className="font-mono">{p.transaction_id}</span> · {p.status === "pending" ? "being checked" : p.status}</p>)}
            {canPayLater && payCfg && <PayLaterForm orderNumber={o.order_number} token={token} label={METHOD_LABEL[o.payment_method]} number={payCfg.number} accountType={payCfg.account_type} instructions={payCfg.instructions} amount={o.total} />}
          </section>
          <section aria-labelledby="delivery" className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
            <h2 id="delivery" className="display text-2xl">Delivery</h2>
            <p className="mt-3 flex gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-tangerine" /><span><b>{o.customer_name}</b> · {o.phone_masked}<br />{o.address}{o.area ? `, ${o.area}` : ""}, {o.district}</span></p>
            {o.shipment ? (
              <div className="mt-4 rounded-2xl bg-paper p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold"><Truck className="size-4" /> {o.shipment.provider === "sandbox" ? "Courier (test mode)" : o.shipment.provider[0].toUpperCase() + o.shipment.provider.slice(1)}</p>
                {o.shipment.consignment_id && <p className="mt-1 text-slate">Consignment {o.shipment.consignment_id}</p>}
                {o.shipment.tracking_url && <a href={o.shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-electric underline">Track with courier <ExternalLink className="size-3.5" /></a>}
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm text-slate"><Package className="size-4" /> Courier details appear here once the parcel is handed over.</p>
            )}
          </section>
        </div>
      </div>

      {o.status === "delivered" && (
        <ReviewForms orderNumber={o.order_number} token={token} reviewed={row.reviews.map((r) => r.product_id)} items={[...new Map(o.items.filter((i) => i.product_id).map((i) => [i.product_id!, { id: i.product_id!, name: i.product_name }])).values()]} />
      )}

      <p className="mt-10 text-center text-sm text-slate">Questions? Call {settings.store.phone} or use the chat button. Mention order <b>{o.order_number}</b>.</p>
    </>
  );
}
