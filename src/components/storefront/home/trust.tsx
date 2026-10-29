import Link from "next/link";
import { Banknote, PackageCheck, RotateCcw, Smartphone, Headphones } from "lucide-react";
import type { PublicSettings } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { Reveal } from "@/components/ui/reveal";

/** Purchase confidence — every figure here comes from the admin-configured settings. */
export function Trust({ settings }: { settings: PublicSettings }) {
  const { shipping, payments, policies, store } = settings;
  const methods = [
    payments.cod?.enabled && "Cash on Delivery",
    payments.bkash_manual?.enabled && "bKash",
    payments.nagad_manual?.enabled && "Nagad",
  ].filter(Boolean) as string[];
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Reveal className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] md:col-span-4 sm:p-8">
        <PackageCheck className="size-7 text-electric" />
        <h3 className="display mt-4 t-sub">Delivery charges</h3>
        <ul className="mt-5 divide-y divide-line">
          {shipping.zones.map((z) => (
            <li key={z.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span>
                <span className="font-semibold">{z.label}</span>
                {z.label_bn && <span className="bn ml-2 text-sm text-slate" lang="bn">{z.label_bn}</span>}
              </span>
              <span className="flex items-baseline gap-3">
                {z.eta && <span className="text-sm text-slate">{z.eta}</span>}
                <span className="font-display text-xl font-bold">{formatTaka(z.fee)}</span>
              </span>
            </li>
          ))}
        </ul>
        {shipping.free_shipping_threshold ? <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-sm font-medium">Free delivery anywhere on orders of {formatTaka(shipping.free_shipping_threshold)} or more.</p> : null}
      </Reveal>
      <Reveal delay={0.08} className="flex flex-col rounded-[2rem] bg-electric p-6 text-white md:col-span-2 sm:p-8">
        <Banknote className="size-7" />
        <h3 className="display mt-4 t-sub">Pay your way</h3>
        <div className="mt-5 flex flex-wrap gap-2">{methods.map((m) => <span key={m} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">{m}</span>)}</div>
        <p className="mt-auto pt-6 text-sm text-white/80">
          <Smartphone className="mr-1 inline size-4" /> Advance bKash/Nagad payments are checked by our team before shipping. We will never ask for your PIN or OTP.
        </p>
      </Reveal>
      <Reveal delay={0.04} className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] md:col-span-3 sm:p-8">
        <RotateCcw className="size-7 text-tangerine" />
        <h3 className="display mt-4 t-sub">Easy returns</h3>
        <p className="mt-3 text-slate">{policies.returns}</p>
        <Link href="/help#returns" className="mt-4 inline-block font-semibold text-electric underline underline-offset-4">Refund & cancellation policy</Link>
      </Reveal>
      <Reveal delay={0.1} className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] md:col-span-3 sm:p-8">
        <Headphones className="size-7 text-mint" />
        <h3 className="display mt-4 t-sub">Real people, real fast</h3>
        <p className="mt-3 text-slate">Call {store.phone} or message us — {store.hours}. Or ask our assistant in Bangla, Banglish or English any time.</p>
        <Link href="/help#contact" className="mt-4 inline-block font-semibold text-electric underline underline-offset-4">Contact & FAQ</Link>
      </Reveal>
    </div>
  );
}
