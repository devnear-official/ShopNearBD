import type { Metadata } from "next";
import { WishlistView } from "./wishlist-view";
import { Streaks } from "@/components/ui/streaks";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-8">
      <Streaks className="h-6 w-12" />
      <h1 className="display mt-4 t-page">Saved for later</h1>
      <p className="bn mt-1 text-slate" lang="bn">পছন্দের তালিকা</p>
      <p className="mt-3 max-w-xl text-slate">Your wishlist is kept on this device. Prices and stock below are live.</p>
      <div className="mt-10"><WishlistView /></div>
    </div>
  );
}
