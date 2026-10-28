"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from "lucide-react";
import clsx from "clsx";
import type { ProductImage } from "@/lib/catalog";
import { useDialog } from "@/hooks/use-dialog";

/**
 * Desktop: a stacked "scroll-through" gallery with a sticky thumbnail rail.
 * Phones: a swipeable snap carousel. Any image opens a full-screen viewer with
 * zoom (click/tap to toggle, drag to pan), arrow keys and swipe.
 */
export function ProductGallery({ images, name, activeIndex }: { images: ProductImage[]; name: string; activeIndex: number }) {
  const [current, setCurrent] = useState(activeIndex);
  const [viewer, setViewer] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);

  // Variant change → bring its image into view.
  useEffect(() => {
    setCurrent(activeIndex);
    const s = strip.current;
    if (s) s.scrollTo({ left: s.clientWidth * activeIndex, behavior: "smooth" });
    const target = stack.current?.children[activeIndex] as HTMLElement | undefined;
    if (target && window.matchMedia("(min-width: 1024px)").matches) {
      const top = target.getBoundingClientRect().top + window.scrollY - 110;
      if (Math.abs(window.scrollY - top) > 40 && target.getBoundingClientRect().top < 0) window.scrollTo({ top, behavior: "smooth" });
    }
  }, [activeIndex]);

  const onStripScroll = () => {
    const s = strip.current;
    if (s) setCurrent(Math.round(s.scrollLeft / s.clientWidth));
  };

  if (!images.length) return <div className="aspect-[4/5] rounded-[2rem] bg-cloud" />;

  return (
    <>
      {/* Phones / tablets */}
      <div className="relative lg:hidden">
        <div ref={strip} onScroll={onStripScroll} className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto rounded-[2rem]" aria-roledescription="carousel" aria-label={`${name} images`}>
          {images.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setViewer(i)} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-cloud" aria-label={`Open image ${i + 1} of ${images.length} full screen`}>
              <Image src={img.url} alt={img.alt || name} fill priority={i === 0} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/80 px-2.5 py-1.5 backdrop-blur" aria-hidden>
          {images.map((_, i) => <span key={i} className={clsx("h-1.5 rounded-full transition-all", i === current ? "w-5 bg-ink" : "w-1.5 bg-ink/25")} />)}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[4.5rem_1fr]">
        <div className="sticky top-28 flex h-max flex-col gap-3" role="list" aria-label="Image thumbnails">
          {images.map((img, i) => (
            <button key={img.url} type="button" role="listitem" onClick={() => (stack.current?.children[i] as HTMLElement)?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className={clsx("relative aspect-[4/5] overflow-hidden rounded-xl bg-cloud transition", i === current ? "ring-2 ring-electric ring-offset-2" : "opacity-70 hover:opacity-100")} aria-label={`Show image ${i + 1}`}>
              <Image src={img.url} alt="" fill sizes="72px" className="object-cover" />
            </button>
          ))}
        </div>
        <div ref={stack} className="flex flex-col gap-4">
          {images.map((img, i) => (
            <m.button key={img.url} type="button" onClick={() => setViewer(i)} onViewportEnter={() => setCurrent(i)} viewport={{ amount: 0.6 }}
              className={clsx("group relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-[2.25rem] bg-cloud", i === 0 && "tag-hole")} aria-label={`Open image ${i + 1} full screen`}>
              <Image src={img.url} alt={img.alt || name} fill priority={i === 0} sizes="(min-width:1280px) 640px, 55vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
              <span className="absolute bottom-4 right-4 grid size-11 place-items-center rounded-full bg-white/85 opacity-0 backdrop-blur transition group-hover:opacity-100"><Expand className="size-5" /></span>
            </m.button>
          ))}
        </div>
      </div>

      <Viewer images={images} name={name} index={viewer} onIndex={setViewer} />
    </>
  );
}

function Viewer({ images, name, index, onIndex }: { images: ProductImage[]; name: string; index: number | null; onIndex: (i: number | null) => void }) {
  const open = index !== null;
  const ref = useDialog<HTMLDivElement>(open, () => onIndex(null));
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => { setZoom(false); onIndex(index === null ? null : (index + d + images.length) % images.length); }, [index, images.length, onIndex]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, go]);

  const img = index !== null ? images[index] : null;
  return (
    <AnimatePresence>
      {open && img && (
        <m.div ref={ref} role="dialog" aria-modal="true" aria-label={`${name} image viewer`} className="fixed inset-0 z-[70] flex flex-col bg-ink/95 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex items-center justify-between p-4">
            <p className="text-sm text-white/70">{index! + 1} / {images.length}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setZoom((z) => !z)} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label={zoom ? "Zoom out" : "Zoom in"}>{zoom ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}</button>
              <button type="button" onClick={() => onIndex(null)} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Close viewer" data-autofocus><X className="size-5" /></button>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => { if (touch.current === null || zoom) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}
            onMouseMove={(e) => { if (!zoom) return; const r = e.currentTarget.getBoundingClientRect(); setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`); }}>
            <button type="button" className={clsx("relative mx-auto block h-full w-full max-w-3xl", zoom ? "cursor-zoom-out" : "cursor-zoom-in")} onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
              setZoom((z) => !z);
            }} aria-label={zoom ? "Zoom out" : "Zoom in"}>
              <Image src={img.url} alt={img.alt || name} fill sizes="100vw" quality={80} className="object-contain transition-transform duration-300" style={{ transform: zoom ? "scale(2.2)" : "scale(1)", transformOrigin: origin }} />
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Previous image"><ChevronLeft /></button>
                <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Next image"><ChevronRight /></button>
              </>
            )}
          </div>
          <p className="p-4 text-center text-sm text-white/60">{img.alt}</p>
        </m.div>
      )}
    </AnimatePresence>
  );
}
