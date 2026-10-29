import type { Metadata } from "next";
import Link from "next/link";
import { SavedOrders } from "@/components/checkout/order-client";
import { Streaks } from "@/components/ui/streaks";

export const metadata: Metadata = { title: "Track my order", robots: { index: false } };

export default function OrdersIndex() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-8">
      <Streaks className="h-6 w-12" />
      <h1 className="display mt-4 t-page">Track my order</h1>
      <p className="bn mt-1 text-slate" lang="bn">আমার অর্ডার</p>
      <p className="mt-4 text-slate">Orders placed in this browser are listed below. Each opens with its own private link — we never show order details using only a phone number, so nobody else can look up your address.</p>
      <Link href="/account" className="mt-6 flex items-center justify-between gap-3 rounded-[1.5rem] bg-ink p-5 text-white">
        <span><b className="block">See all your orders</b><span className="text-sm text-white/70">Log in with your phone number — every order on it, from any device.</span></span>
        <span className="shrink-0 rounded-full bg-tangerine px-4 py-2 text-sm font-semibold text-ink">Log in</span>
      </Link>
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-slate">Saved on this device</h2>
      <div className="mt-3"><SavedOrders /></div>
      <p className="mt-8 text-sm text-slate">Ordered on another device or cleared your browser? Log in with your phone number above, or use the chat button and we&apos;ll help.</p>
    </div>
  );
}
