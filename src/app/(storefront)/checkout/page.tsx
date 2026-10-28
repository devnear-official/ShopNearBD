import type { Metadata } from "next";
import { getPublicSettings } from "@/lib/catalog";
import { Checkout } from "@/components/checkout/checkout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const settings = await getPublicSettings();
  return (
    <div className="px-4 pt-8 sm:px-8">
      <Checkout shipping={settings.shipping} payments={settings.payments} />
    </div>
  );
}
