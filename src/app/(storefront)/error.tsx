"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Streaks } from "@/components/ui/streaks";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <Streaks tone="tangerine" className="h-10 w-20" />
      <h1 className="display mt-6 text-4xl">Something slipped</h1>
      <p className="mt-3 text-slate">We couldn&apos;t load this page. Your cart is safe. Please try again in a moment.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-electric px-6 py-3 font-semibold text-white">Try again</button>
        <Link href="/" className="rounded-full px-6 py-3 font-semibold ring-1 ring-line">Home</Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-mist">Reference: {error.digest}</p>}
    </div>
  );
}
