import type { Metadata } from "next";
import { SavedOrders } from "@/components/checkout/order-client";
import { Streaks } from "@/components/ui/streaks";

export const metadata: Metadata = { title: "Track my order", robots: { index: false } };

export default function OrdersIndex() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-8">
      <Streaks className="h-6 w-12" />
      <h1 className="display mt-4 text-5xl">Track my order</h1>
      <p className="bn mt-1 text-slate" lang="bn">আমার অর্ডার</p>
      <p className="mt-4 text-slate">Orders placed in this browser are listed below. Each opens with its own private link — we never show order details using only a phone number, so nobody else can look up your address.</p>
      <div className="mt-8"><SavedOrders /></div>
      <p className="mt-8 text-sm text-slate">Ordered on another device or cleared your browser? Use the chat button and we&apos;ll help you after confirming a few details.</p>
    </div>
  );
}
