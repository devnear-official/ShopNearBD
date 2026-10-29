import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, LogOut, PackageCheck, ShoppingBag, Truck, Wallet } from "lucide-react";
import clsx from "clsx";
import { currentCustomer } from "@/lib/customer/auth";
import { customerOrders } from "@/lib/customer/orders";
import { CUSTOMER_STATUS, METHOD_LABEL } from "@/lib/order-status";
import { formatDate, formatTaka } from "@/lib/format";
import { logout } from "@/actions/account";
import { ProfileForm } from "@/components/account/profile-form";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

const TONE: Record<string, string> = {
  pending: "bg-sun/20 text-[#7a4d05]", confirmed: "bg-electric/10 text-electric-deep", packed: "bg-electric/10 text-electric-deep", shipped: "bg-electric/10 text-electric-deep",
  delivered: "bg-mint/15 text-[#0b7a55]", cancelled: "bg-cloud text-slate", returned: "bg-flame/10 text-[#a3290f]",
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-8">
      <Suspense fallback={<div className="skeleton h-96 rounded-[2rem]" />}><Account /></Suspense>
    </div>
  );
}

async function Account() {
  const me = await currentCustomer();
  if (!me) redirect("/account/login?next=/account");
  const { orders, stats, last } = await customerOrders(me.phone);
  const name = me.name || last?.name || "there";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-electric">My account</p>
          <h1 className="display mt-1 text-[clamp(2rem,6vw,3.2rem)]">Hi, {name.split(/\s+/)[0]}</h1>
          <p className="mt-1 font-mono text-slate">{me.phone}</p>
        </div>
        <form action={logout}><button type="submit" className="flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-line hover:bg-cloud"><LogOut className="size-4" /> Log out</button></form>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: ShoppingBag, label: "Orders", value: String(stats.orders) },
          { icon: Truck, label: "In progress", value: String(stats.active) },
          { icon: PackageCheck, label: "Delivered", value: String(stats.delivered) },
          { icon: Wallet, label: "Total ordered", value: formatTaka(stats.spent), hint: "excludes cancelled & returned" },
        ].map((s) => (
          <div key={s.label} className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
            <s.icon className="size-5 text-electric" />
            <dt className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate">{s.label}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{s.value}</dd>
            {s.hint && <p className="text-[0.7rem] text-mist">{s.hint}</p>}
          </div>
        ))}
      </dl>

      <section aria-labelledby="my-orders" className="mt-8">
        <h2 id="my-orders" className="display text-2xl">Your orders</h2>
        {orders.length === 0 ? (
          <div className="mt-3 rounded-[1.5rem] bg-white p-6 text-center shadow-[var(--shadow-card)]">
            <p className="text-slate">No orders on this number yet.</p>
            <ButtonLink href="/shop" className="mt-4">Start shopping</ButtonLink>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {orders.map((o) => (
              <li key={o.order_number}>
                <Link href={`/order/${o.order_number}`} className="flex items-center gap-3 rounded-[1.5rem] bg-white p-3 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 sm:gap-4 sm:p-4">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cloud">{o.image_url && <Image src={o.image_url} alt="" fill sizes="56px" className="object-cover" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-sm font-bold">{o.order_number}</span>
                      <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", TONE[o.status])}>{CUSTOMER_STATUS[o.status]?.label ?? o.status}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm">{o.first_item}{o.item_count > 1 ? ` + ${o.item_count - 1} more` : ""}</span>
                    <span className="block text-xs text-slate">{formatDate(o.created_at)} · {METHOD_LABEL[o.payment_method]}</span>
                  </span>
                  <span className="shrink-0 text-right font-display font-bold tabular-nums">{formatTaka(o.total)}</span>
                  <ChevronRight className="size-4 shrink-0 text-mist" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="profile" className="mt-8 rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <h2 id="profile" className="display text-2xl">Your details</h2>
        <p className="mt-1 text-sm text-slate">Used to fill in checkout faster. Your phone number is your login.</p>
        <ProfileForm name={me.name ?? last?.name ?? ""} email={me.email ?? last?.email ?? ""} />
        {last && <p className="mt-4 text-sm text-slate">Last delivery address: {last.address}{last.area ? `, ${last.area}` : ""}, {last.district}</p>}
      </section>
    </>
  );
}
