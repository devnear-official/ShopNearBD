"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Camera, Loader2, Mic, Search, Square, X } from "lucide-react";
import clsx from "clsx";
import { useDialog } from "@/hooks/use-dialog";
import { useStoredValue } from "@/hooks/use-stored-value";
import { formatTaka } from "@/lib/format";
import { track } from "@/lib/tracking/client";
import { useImageSearch, useVoiceSearch, voiceSupport, type MediaResult } from "@/components/search/media-search";

type Hit = { slug: string; name: string; name_bn: string | null; price: number; image: string | null; category: string | null };
const SUGGESTIONS = ["earbuds", "power bank", "fan", "smart watch", "backpack", "ব্যাগ"];
const LANGS = [{ id: "bn-BD", label: "বাংলা" }, { id: "en-US", label: "English" }];
const parseLang = (r: string | null) => (r === "en-US" ? "en-US" : "bn-BD");

export function SearchOverlay({ open, onClose, mode = "text", file }: { open: boolean; onClose: () => void; mode?: "text" | "voice" | "image"; file?: File | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaResult | null>(null);
  const [lang, setLang] = useStoredValue("sn_voice_lang", parseLang, "bn-BD");
  const fileRef = useRef<HTMLInputElement>(null);
  const ref = useDialog<HTMLDivElement>(open, onClose);

  const onMedia = useCallback((r: MediaResult) => {
    setMedia(r);
    if (r.kind === "voice") setQ(r.label);
    if (r.query) track("Search", { search: r.query });
  }, []);
  const voice = useVoiceSearch(onMedia);
  const photo = useImageSearch(onMedia);
  const canVoice = voiceSupport() !== "none";

  // Opened from a "search by voice / photo" button elsewhere.
  const started = useRef(false);
  useEffect(() => {
    if (!open) { started.current = false; return; }
    if (started.current) return;
    started.current = true;
    if (mode === "voice" && canVoice) void voice.start(lang);
    // A photo picked elsewhere arrives as a file (a file picker can't be opened without a tap).
    if (mode === "image" && file) void photo.search(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the overlay opens
  }, [open, mode, file]);

  useEffect(() => {
    if (!open || media) return;
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setHits((await res.json()).items);
      } catch {}
      setLoading(false);
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
      setLoading(false);
    };
  }, [q, open, media]);

  const visibleHits = media ? media.items : q.trim().length >= 2 ? hits : [];
  const submit = (term: string) => {
    onClose();
    router.push(`/shop?q=${encodeURIComponent(term.trim())}`);
  };
  const listening = voice.state === "listening";
  const working = voice.state === "working" || photo.state === "working";
  const mediaError = voice.state === "error" ? voice.error : photo.state === "error" ? photo.error : null;

  const startVoice = () => {
    setMedia(null);
    photo.reset();
    if (listening) voice.stop(); else void voice.start(lang);
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div ref={ref} role="dialog" aria-modal="true" aria-label="Search" className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close search" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} tabIndex={-1} />
          <m.div initial={{ y: -16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -10, scale: 0.98 }} transition={{ duration: 0.2 }}
            className="relative mt-[8vh] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-[var(--shadow-float)]">
            <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) submit(media?.query ?? q); }} className="flex items-center gap-1.5 border-b border-line pl-5 pr-2 sm:gap-2">
              <Search className="size-5 shrink-0 text-slate" aria-hidden />
              <label htmlFor="site-search" className="sr-only">Search products</label>
              <input id="site-search" data-autofocus={mode === "text" ? true : undefined} value={q} onChange={(e) => { setQ(e.target.value); setMedia(null); }} placeholder={listening ? "Listening…" : "Search earbuds, fan, ব্যাগ…"}
                className="h-16 w-full min-w-0 bg-transparent text-lg outline-none placeholder:text-mist" autoComplete="off" enterKeyHint="search" />
              {loading || working ? <Loader2 className="size-5 shrink-0 animate-spin text-mist" aria-label="Searching" /> : null}
              {canVoice && (
                <button type="button" onClick={startVoice} aria-pressed={listening} aria-label={listening ? "Stop voice search" : "Search by voice"} title="Search by voice" data-voice-search
                  className={clsx("relative grid size-10 shrink-0 place-items-center rounded-full transition", listening ? "bg-flame text-white" : "text-ink hover:bg-cloud")}>
                  {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-flame/40" />}
                  {listening ? <Square className="relative size-4 fill-current" /> : <Mic className="size-5" />}
                </button>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="Search with a photo" title="Search with a photo" data-image-search
                className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-cloud">
                <Camera className="size-5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden data-image-input
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { voice.reset(); setMedia(null); void photo.search(f); } }} />
              <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-cloud" aria-label="Close search"><X className="size-5" /></button>
            </form>

            <div className="max-h-[60vh] overflow-y-auto p-3" aria-live="polite">
              {listening ? (
                <div className="flex flex-col items-center px-4 py-8 text-center">
                  <span className="relative grid size-20 place-items-center rounded-full bg-electric text-white">
                    <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-electric/30" />
                    <Mic className="relative size-8" />
                  </span>
                  <p className="mt-5 font-display text-2xl font-bold">{voice.interim || (lang === "bn-BD" ? "বলুন, কী খুঁজছেন…" : "Say what you're looking for…")}</p>
                  <p className="mt-1 text-sm text-slate">e.g. “ব্লুটুথ ইয়ারবাড” or “power bank 10000”</p>
                  <div className="mt-5 flex gap-2" role="radiogroup" aria-label="Voice language">
                    {LANGS.map((l) => (
                      <button key={l.id} type="button" role="radio" aria-checked={lang === l.id} onClick={() => { setLang(l.id); voice.stop(); setTimeout(() => void voice.start(l.id), 250); }}
                        className={clsx("h-10 rounded-full px-4 text-sm font-semibold", lang === l.id ? "bg-ink text-white" : "bg-paper")}>{l.label}</button>
                    ))}
                  </div>
                  <button type="button" onClick={voice.stop} className="mt-3 min-h-10 text-sm font-semibold text-electric underline">Done</button>
                </div>
              ) : working ? (
                <div className="flex items-center gap-4 p-4">
                  {photo.state === "working" && photo.preview ? <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cloud"><Image src={photo.preview} alt="Your photo" fill unoptimized className="object-cover" /></span> : <Loader2 className="size-6 animate-spin text-electric" />}
                  <p className="text-slate">{photo.state === "working" ? "Looking for matching products…" : "Finding products…"}</p>
                </div>
              ) : mediaError ? (
                <p role="alert" className="m-2 rounded-2xl bg-flame/10 p-4 text-sm font-medium text-[#a3290f]">{mediaError}</p>
              ) : null}

              {!listening && !working && (
                <>
                  {media && (
                    <div className="mb-2 flex items-center gap-3 rounded-2xl bg-paper p-3">
                      {media.kind === "image" && media.preview ? (
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-cloud"><Image src={media.preview} alt="Your photo" fill unoptimized className="object-cover" /></span>
                      ) : <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-electric text-white"><Mic className="size-5" /></span>}
                      <p className="min-w-0 text-sm"><span className="block text-slate">{media.kind === "image" ? "Looks like" : "You said"}</span><span className="block truncate font-semibold">“{media.label}”</span></p>
                    </div>
                  )}
                  {!media && q.trim().length < 2 ? (
                    <div className="p-3">
                      <p className="eyebrow mb-3 text-mist">Popular searches</p>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((s) => (
                          <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full bg-paper px-4 py-2 text-sm font-medium hover:bg-cloud">{s}</button>
                        ))}
                      </div>
                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        {canVoice && <button type="button" onClick={startVoice} className="flex items-center gap-3 rounded-2xl bg-paper p-3 text-left text-sm hover:bg-cloud"><Mic className="size-5 text-electric" /><span><b className="block">Search by voice</b><span className="text-slate">বাংলা বা English-এ বলুন</span></span></button>}
                        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-3 rounded-2xl bg-paper p-3 text-left text-sm hover:bg-cloud"><Camera className="size-5 text-tangerine" /><span><b className="block">Search with a photo</b><span className="text-slate">Snap or upload a picture</span></span></button>
                      </div>
                    </div>
                  ) : visibleHits.length ? (
                    <ul>
                      {visibleHits.map((h) => (
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
                      {(media?.query ?? q.trim()) && (
                        <li>
                          <button type="button" onClick={() => submit(media?.query ?? q)} className="mt-1 flex w-full items-center justify-between rounded-2xl bg-ink px-4 py-3 text-left text-sm font-semibold text-white">
                            See all results for “{(media?.query ?? q).trim()}” <ArrowRight className="size-4" />
                          </button>
                        </li>
                      )}
                    </ul>
                  ) : !loading && !mediaError ? (
                    <p className="p-4 text-slate">{media ? "We couldn't find a matching product." : `No products match “${q.trim()}”.`} Try {media?.kind === "image" ? "another photo, " : ""}a shorter word, or <Link href="/shop" onClick={onClose} className="font-semibold text-electric underline">browse everything</Link>.</p>
                  ) : null}
                </>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
