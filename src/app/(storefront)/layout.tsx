import { Suspense } from "react";
import { getCategories, getPublicSettings } from "@/lib/catalog";
import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { MotionProvider } from "@/components/ui/motion-provider";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Pixels } from "@/components/tracking/pixels";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getPublicSettings(), getCategories()]);
  return (
    <MotionProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header categories={categories.map((c) => ({ slug: c.slug, name: c.name, name_bn: c.name_bn, accent: c.accent }))} />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} categories={categories} />
      <CartDrawer freeShippingThreshold={settings.shipping.free_shipping_threshold} />
      <Suspense>
        <Pixels metaPixelId={process.env.META_PIXEL_ID || settings.tracking?.meta_pixel_id || null} tiktokPixelId={process.env.TIKTOK_PIXEL_ID || settings.tracking?.tiktok_pixel_id || null} server={settings.tracking?.server_events !== false} tiktokPurchase={settings.tracking?.tiktok_purchase_event === "CompletePayment" ? "CompletePayment" : "Purchase"} />
      </Suspense>
      <Suspense>
        <ChatWidget greeting="Hi! আমি ShopNear-এর সহকারী। Product, delivery বা order নিয়ে জিজ্ঞেস করুন।" />
      </Suspense>
    </MotionProvider>
  );
}
