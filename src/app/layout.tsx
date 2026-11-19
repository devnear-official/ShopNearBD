import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted, Latin-only variable fonts: preloaded, swapped in without layout shift.
// Bengali text uses self-hosted Hind Siliguri for crisp, beautiful Bangla typography.
const figtree = localFont({ src: "../../node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2", weight: "300 900", variable: "--font-figtree", display: "swap" });
const bricolage = localFont({ src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2", weight: "200 800", variable: "--font-bricolage", display: "swap" });
const hindSiliguri = localFont({
  src: [
    { path: "../../node_modules/@fontsource/hind-siliguri/files/hind-siliguri-bengali-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../../node_modules/@fontsource/hind-siliguri/files/hind-siliguri-bengali-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/hind-siliguri/files/hind-siliguri-bengali-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/hind-siliguri/files/hind-siliguri-bengali-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/hind-siliguri/files/hind-siliguri-bengali-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-hind-siliguri",
  display: "swap",
});

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "ShopNear BD — Shop near. Get it faster.", template: "%s · ShopNear BD" },
  description: "Gadgets, home and lifestyle essentials delivered across Bangladesh. Cash on Delivery, bKash and Nagad accepted.",
  applicationName: "ShopNear BD",
  openGraph: { type: "website", siteName: "ShopNear BD", locale: "en_BD", images: [{ url: "/brand/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F7FC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${bricolage.variable} ${hindSiliguri.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
