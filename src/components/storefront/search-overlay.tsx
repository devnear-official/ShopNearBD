"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import { useDialog } from "@/hooks/use-dialog";
import { formatTaka } from "@/lib/format";

type Hit = { slug: string; name: string; name_bn: string | null; price: number; image: string | null; category: string | null };
const SUGGESTIONS = ["earbuds", "power bank", "fan", "smart watch", "backpack", "ব্যাগ"];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useDialog<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setHits((await res.json()).items);
      } catch {}
      setLoading(false);
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const submit = (term: string) => {
    onClose();
    router.push(`/shop?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div ref={ref} role="dialog" aria-modal="true" aria-label="Search" className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close search" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} tabIndex={-1} />
          <m.div initial={{ y: -16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -10, scale: 0.98 }} transition={{ duration: 0.2 }}
            className="relative mt-[8vh] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-[var(--shadow-float)]">
            <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) submit(q); }} className="flex items-center gap-3 border-b border-line px-5">
              <Search className="size-5 shrink-0 text-slate" aria-hidden />
              <label htmlFor="site-search" className="sr-only">Search products</label>
              <input id="site-search" data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search earbuds, fan, ব্যাগ…"
                className="h-16 w-full bg-transparent text-lg outline-none placeholder:text-mist" autoComplete="off" enterKeyHint="search" />
              {loading ? <Loader2 className="size-5 animate-spin text-mist" aria-label="Searching" /> : null}
              <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-cloud" aria-label="Close search"><X className="size-5" /></button>
            </form>
            <div className="max-h-[60vh] overflow-y-auto p-3" aria-live="polite">
              {q.trim().length < 2 ? (
                <div className="p-3">
                  <p className="eyebrow mb-3 text-mist">Popular searches</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full bg-paper px-4 py-2 text-sm font-medium hover:bg-cloud">{s}</button>
                    ))}
                  </div>
                </div>
              ) : hits.length ? (
                <ul>
                  {hits.map((h) => (
                    <li key={h.slug}>
                      <Link href={`/shop/${h.slug}`} onClick={onClose} className="flex items-center gap-4 rounded-2xl p-2.5 hover:bg-paper">
                        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cloud">
                          {h.image && <Image src={h.image} alt="" fill sizes="56px" className="object-cover" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{h.name}</span>
                          <span className="block truncate text-sm text-slate">{h.category}</span>
                        </span>
                        <span className="font-display font-bold">{formatTaka(h.price)}</span>
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button type="button" onClick={() => submit(q)} className="mt-1 flex w-full items-center justify-between rounded-2xl bg-ink px-4 py-3 text-left text-sm font-semibold text-white">
                      See all results for “{q.trim()}” <ArrowRight className="size-4" />
                    </button>
                  </li>
                </ul>
              ) : !loading ? (
                <p className="p-4 text-slate">No products match “{q.trim()}”. Try a shorter word, or <Link href="/shop" onClick={onClose} className="font-semibold text-electric underline">browse everything</Link>.</p>
              ) : null}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
