"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import clsx from "clsx";

export type Slide = { id: string; title: string; description: string | null; button_text: string | null; image_url: string | null; href: string | null };

const INTERVAL = 6000;

function SlideLink({ href, children, className }: { href: string | null; children: React.ReactNode; className?: string }) {
  if (!href) return <div className={className}>{children}</div>;
  if (/^https?:\/\//.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  return <Link href={href} className={className}>{children}</Link>;
}

/** Admin-managed hero slides. Every slide links to its configured destination; autoplay stops for hover, focus, touch and reduced motion. */
export function HeroBanners({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userStopped, setUserStopped] = useState(false);
  const [reduce, setReduce] = useState(true); // assume reduced until known, so nothing animates before hydration
  const touchX = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const go = useCallback((d: number) => setI((c) => (c + d + n) % n), [n]);
  const playing = n > 1 && !paused && !userStopped && !reduce;
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => go(1), INTERVAL);
    return () => window.clearInterval(t);
  }, [playing, go, i]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured offers"
      className="mx-auto max-w-7xl px-4 pt-4 sm:px-8 sm:pt-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-ink sm:aspect-[16/7] sm:rounded-[2.5rem]" aria-live={playing ? "off" : "polite"}>
        {slides.map((s, k) => {
          const active = k === i;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${k + 1} of ${n}`}
              aria-hidden={!active}
              inert={!active}
              className={clsx("absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none", active ? "opacity-100" : "pointer-events-none opacity-0")}
            >
              <SlideLink href={s.href} className="group/slide absolute inset-0 block focus-visible:outline-offset-[-4px]">
                {s.image_url ? (
                  <Image src={s.image_url} alt="" fill priority={k === 0} sizes="(min-width: 1280px) 1216px, 100vw" quality={80} className="object-cover" />
                ) : (
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-br from-electric via-[#2f78ff] to-sky" />
                )}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-transparent sm:bg-gradient-to-r sm:from-ink/75 sm:via-ink/30 sm:to-transparent" />
                <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 pb-14 text-white sm:inset-y-0 sm:max-w-[34rem] sm:justify-center sm:gap-3 sm:p-12">
                  <span className="display text-balance text-2xl leading-tight sm:text-5xl">{s.title}</span>
                  {s.description && <span className="line-clamp-2 text-sm text-white/85 sm:line-clamp-3 sm:text-lg">{s.description}</span>}
                  {s.href && (
                    <span className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-ink transition group-hover/slide:bg-sun sm:h-12 sm:text-base">
                      {s.button_text || "Shop now"} <ArrowRight className="size-4" />
                    </span>
                  )}
                </span>
              </SlideLink>
            </div>
          );
        })}

        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-md hover:bg-white sm:grid">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next slide" className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-md hover:bg-white sm:grid">
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/40 px-2 backdrop-blur sm:bottom-4">
              {slides.map((s, k) => (
                <button key={s.id} type="button" onClick={() => setI(k)} aria-label={`Go to slide ${k + 1}`} aria-current={k === i} className="grid size-8 place-items-center">
                  <span className={clsx("block h-2 rounded-full transition-all", k === i ? "w-6 bg-white" : "w-2 bg-white/55")} />
                </button>
              ))}
              {!reduce && (
                <button type="button" onClick={() => setUserStopped((v) => !v)} aria-label={userStopped ? "Resume slideshow" : "Pause slideshow"} className="grid size-8 place-items-center text-white">
                  {userStopped ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
