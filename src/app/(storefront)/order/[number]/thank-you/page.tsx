import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, MapPin, PackageCheck, PhoneCall, Truck } from "lucide-react";
import { asAnon } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { formatTaka } from "@/lib/format";
import { getPublicSettings } from "@/lib/catalog";
import { METHOD_LABEL } from "@/lib/order-status";
import { Celebrate, TokenResolver } from "@/components/checkout/order-client";
import { PurchasePixel } from "@/components/tracking/purchase-pixel";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Thank you for your order", robots: { index: false, follow: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> };
type Order = {
  order_number: string; status: string; payment_status: string; payment_method: string; customer_name: string; phone_masked: string;
  address: string; district: string; area: string | null; subtotal: number; discount_total: number; shipping_fee: number; total: number;
  items: { product_id: string | null; sku: string; product_name: string; variant_name: string; quantity: number; unit_price: number; line_total: number; image_url: string | null }[];
};

export default function ThankYouPage(props: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8">
      <Suspense fallback={<div className="skeleton h-96 rounded-[2.5rem]" />}><ThankYou {...props} /></Suspense>
    </div>
  );
}

async function ThankYou({ params, searchParams }: Props) {
  const [{ number }, { t: token }] = await Promise.all([params, searchParams]);
  if (!token || !/^[A-Za-z0-9_-]{20,128}$/.test(token) || !/^SN\d{11}$/.test(number)) return <TokenResolver number={number} />;
  const [row] = await asAnon((tx) => tx<{ o: Order | null }[]>`select public.get_order_public(${number}, ${sha256(token)}) as o`);
  const o = row?.o;
  if (!o) return <TokenResolver number={number} />;
  const settings = await getPublicSettings();
  const trackHref = `/order/${o.order_number}?t=${encodeURIComponent(token)}`;
  const manual = o.payment_method !== "cod";
  const firstName = o.customer_name.split(/\s+/)[0];

  return (
    <>
      <Celebrate />
      <PurchasePixel
        orderNumber={o.order_number}
        enabled={(settings.tracking?.purchase_trigger ?? "placed") === "placed"}
        value={Number(o.total)}
        items={o.items.map((i) => ({ id: i.sku, name: i.product_name, quantity: i.quantity, price: Number(i.unit_price) }))}
      />
      <section className="relative overflow-hidden rounded-[2.5rem] bg-ink p-7 text-white sm:p-10">
        <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-electric/40 blur-[90px]" />
        <CheckCircle2 className="relative size-12 text-mint" />
        <h1 className="display relative mt-5 text-[clamp(2.6rem,8vw,4.6rem)]">Thank you, {firstName}!</h1>
        <p className="bn relative mt-1 text-lg text-white/70" lang="bn">ধন্যবাদ! আপনার অর্ডার আমরা পেয়েছি।</p>
        <dl className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4"><dt className="text-xs uppercase tracking-wider text-white/60">Order number</dt><dd className="mt-1 font-mono text-lg font-bold">{o.order_number}</dd></div>
          <div className="rounded-2xl bg-white/10 p-4"><dt className="text-xs uppercase tracking-wider text-white/60">Total</dt><dd className="mt-1 font-display text-2xl font-bold">{formatTaka(o.total)}</dd></div>
          <div className="rounded-2xl bg-white/10 p-4"><dt className="text-xs uppercase tracking-wider text-white/60">Payment</dt><dd className="mt-1 font-semibold">{METHOD_LABEL[o.payment_method]}</dd></div>
        </dl>
        <p className="relative mt-6 text-white/85">
          {manual
            ? o.payment_status === "pending_verification"
              ? "We've received your payment details. Our team will match them with our account and then confirm your order — the payment isn't marked verified yet."
              : `Please send ${formatTaka(o.total)} by ${METHOD_LABEL[o.payment_method]} and add the Transaction ID on your order page so we can confirm it.`
            : `You'll pay ${formatTaka(o.total)} in cash when the parcel arrives.`}
        </p>
        <div className="relative mt-7 flex flex-wrap gap-3">
          <ButtonLink href={trackHref} variant="tangerine" size="lg"><Truck className="size-5" /> Track your order</ButtonLink>
          <ButtonLink href="/shop" variant="light" size="lg">Continue shopping</ButtonLink>
        </div>
      </section>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="What happens next">
        {[
          { icon: PhoneCall, t: "We call to confirm", d: `We'll call ${o.phone_masked} shortly.` },
          { icon: PackageCheck, t: "Packed & dispatched", d: "Usually within 24 hours of confirmation." },
          { icon: Truck, t: "Delivered to you", d: settings.shipping.zones.map((z) => z.eta).filter(Boolean)[0] ? `Typically ${settings.shipping.zones.map((z) => z.eta).filter(Boolean).join(" / ")}.` : "We'll keep you posted." },
        ].map((s, i) => (
          <li key={s.t} className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)]">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-electric">Step {i + 1}</span>
            <s.icon className="mt-3 size-6 text-ink" />
            <p className="mt-2 font-semibold">{s.t}</p>
            <p className="text-sm text-slate">{s.d}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="ty-items" className="mt-6 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
        <h2 id="ty-items" className="display text-2xl">Your order</h2>
        <ul className="mt-3 divide-y divide-line">
          {o.items.map((i, k) => (
            <li key={k} className="flex items-center gap-3 py-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cloud">{i.image_url && <Image src={i.image_url} alt="" fill sizes="56px" className="object-cover" />}</span>
              <span className="min-w-0 flex-1 text-sm"><span className="font-semibold">{i.product_name}</span><span className="block text-slate">{i.variant_name !== "Default" ? `${i.variant_name} · ` : ""}{i.quantity} × {formatTaka(i.unit_price)}</span></span>
              <span className="font-semibold tabular-nums">{formatTaka(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd>{formatTaka(o.subtotal)}</dd></div>
          {o.discount_total > 0 && <div className="flex justify-between"><dt className="text-slate">Discount</dt><dd className="text-mint">−{formatTaka(o.discount_total)}</dd></div>}
          <div className="flex justify-between"><dt className="text-slate">Delivery</dt><dd>{o.shipping_fee === 0 ? "Free" : formatTaka(o.shipping_fee)}</dd></div>
          <div className="flex justify-between pt-1 text-base font-bold"><dt>Total</dt><dd>{formatTaka(o.total)}</dd></div>
        </dl>
        <p className="mt-4 flex gap-2 text-sm text-slate"><MapPin className="mt-0.5 size-4 shrink-0 text-tangerine" />{o.address}{o.area ? `, ${o.area}` : ""}, {o.district}</p>
      </section>
      <p className="mt-6 text-center text-sm text-slate">This page and your tracking link are private. They&apos;re saved on this device under <Link href="/order" className="font-semibold text-electric underline">Track my order</Link>.</p>
    </>
  );
}
