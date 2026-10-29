import Link from "next/link";
import { Streaks } from "@/components/ui/streaks";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <Streaks className="h-10 w-20" />
      <p className="display mt-8 text-[clamp(4.5rem,16vw,8rem)] text-gradient">404</p>
      <h1 className="display t-section">This page took a wrong turn</h1>
      <p className="bn mt-2 text-slate" lang="bn">পেজটি খুঁজে পাওয়া যায়নি</p>
      <p className="mt-4 max-w-sm text-slate">The product may have been moved or is no longer available.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/shop" className="rounded-full bg-electric px-6 py-3 font-semibold text-white">Browse the shop</Link>
        <Link href="/" className="rounded-full px-6 py-3 font-semibold ring-1 ring-line">Home</Link>
      </div>
    </main>
  );
}
