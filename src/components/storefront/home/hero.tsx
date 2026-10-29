"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import type { HomepageSettings, ProductCard } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Streaks, Swoosh } from "@/components/ui/streaks";

/**
 * Hero concept — "the radar": the featured product sits at the centre of
 * distance rings (2 km, Dhaka, 64 districts), the brand idea of nearness made
 * literal. Rings drift slowly; the product follows the cursor on desktop.
 */
export function Hero({ copy, hero, orbit }: { copy: HomepageSettings; hero: ProductCard | null; orbit: ProductCard[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const px = useTransform(sx, (v) => v * 18);
  const py = useTransform(sy, (v) => v * 18);
  const rx = useTransform(sy, (v) => v * -6);
  const ry = useTransform(sx, (v) => v * 8);

  useEffect(() => {
    if (reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;
    const on = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mx.set((e.clientX - r.left) / r.width - 0.5);
      my.set((e.clientY - r.top) / r.height - 0.5);
    };
    const off = () => (mx.set(0), my.set(0));
    el.addEventListener("pointermove", on);
    el.addEventListener("pointerleave", off);
    return () => {
      el.removeEventListener("pointermove", on);
      el.removeEventListener("pointerleave", off);
    };
  }, [reduce, mx, my]);

  const img = hero?.images[0];
  const price = hero?.min_price;
  const was = hero && hero.sale_price ? hero.price : null;

  return (
    <section ref={ref} className="relative isolate overflow-hidden px-4 pb-10 pt-6 sm:px-8 lg:pb-20 lg:pt-10">
      {/* soft light field */}
      <div aria-hidden className="absolute -right-40 -top-40 -z-10 size-[44rem] rounded-full bg-[radial-gradient(closest-side,#cfe2ff,transparent)]" />
      <div aria-hidden className="absolute -left-40 top-60 -z-10 size-[30rem] rounded-full bg-[radial-gradient(closest-side,#d8f4ff,transparent)]" />

      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.08fr_1fr] lg:gap-4">
        <div className="relative z-10 pt-4 lg:pt-0">
          <m.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="eyebrow inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-electric shadow-[var(--shadow-card)]">
            <MapPin className="size-3.5" /> {copy.hero_eyebrow}
          </m.p>
          <h1 className="display mt-6 text-[clamp(2.8rem,13vw,8.6rem)]">
            <m.span className="block" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.9, 0.1, 1] }}>
              {copy.hero_title}
            </m.span>
            <m.span className="relative block" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.2, 0.9, 0.1, 1] }}>
              <span className="text-gradient pr-2">{copy.hero_title_accent}</span>
              <m.span aria-hidden className="absolute -bottom-3 left-0 block h-5 w-[min(100%,34rem)] origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 0.45, ease: [0.2, 0.9, 0.1, 1] }}>
                <Swoosh className="h-full w-full" />
              </m.span>
            </m.span>
          </h1>
          <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-8 max-w-lg text-lg leading-relaxed text-slate">
            {copy.hero_subtitle}
          </m.p>
          <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/shop" size="lg">Shop now <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-1" /></ButtonLink>
            <ButtonLink href={`/shop?collection=${copy.campaign_collection}`} variant="ghost" size="lg">Explore {copy.campaign_title}</ButtonLink>
          </m.div>
          <DispatchClock />
        </div>

        {/* Radar */}
        <div className="relative mx-auto aspect-square w-full max-w-[36rem] [perspective:1200px]">
          <svg viewBox="0 0 600 600" aria-hidden className="absolute inset-0 h-full w-full">
            <defs>
              <radialGradient id="rg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#1E6BFF" stopOpacity=".16" /><stop offset="1" stopColor="#1E6BFF" stopOpacity="0" /></radialGradient>
            </defs>
            <circle cx="300" cy="300" r="290" fill="url(#rg)" />
            {[110, 190, 270].map((r, i) => (
              <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="#1E6BFF" strokeOpacity={0.4 - i * 0.08} strokeWidth="2" strokeDasharray={i === 2 ? "3 9" : undefined} />
            ))}
          </svg>
          <div aria-hidden className={reduce ? "absolute inset-0" : "absolute inset-0 animate-orbit"}>
            <div className="absolute left-1/2 top-[5%] h-[45%] w-px origin-bottom bg-gradient-to-t from-electric/0 via-electric/40 to-electric/0" />
          </div>
          <RingLabel className="left-[63%] top-[29%]" text="2 km" />
          <RingLabel className="left-[78%] top-[16%]" text="Dhaka" />
          <RingLabel className="left-[4%] top-[70%]" text="64 districts" />

          {orbit.slice(0, 3).map((p, i) => (
            <m.div key={p.slug} className="absolute size-[17%]" style={{ left: ["4%", "80%", "70%"][i], top: ["26%", "52%", "80%"][i] }}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.12, type: "spring", stiffness: 140, damping: 14 }}>
              <Link href={`/shop/${p.slug}`} className="relative block size-full overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-float)] ring-4 ring-white transition hover:scale-110" aria-label={p.name}>
                {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="96px" className="object-cover" />}
              </Link>
            </m.div>
          ))}

          {hero && img && (
            <m.div style={reduce ? undefined : { x: px, y: py, rotateX: rx, rotateY: ry }} className="absolute left-[24%] top-[18%] w-[52%] [transform-style:preserve-3d]">
              <m.div initial={{ opacity: 0, y: 40, rotate: -6 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: 0.9, ease: [0.2, 0.9, 0.1, 1] }}>
                <Link href={`/shop/${hero.slug}`} className="tag-hole relative block aspect-[4/5] overflow-hidden rounded-[2.2rem] bg-white shadow-[0_50px_80px_-30px_rgba(11,21,48,.45)]">
                  <Image src={img.url} alt={img.alt || hero.name} fill priority sizes="(min-width:1024px) 300px, 52vw" className="object-cover" />
                  <span className="sr-only">{hero.name}</span>
                </Link>
              </m.div>
              <m.div initial={{ opacity: 0, scale: 0.5, rotate: 20 }} animate={{ opacity: 1, scale: 1, rotate: 8 }} transition={{ delay: 0.7, type: "spring", stiffness: 160, damping: 12 }}
                className="absolute -right-10 -top-6 rounded-2xl rounded-tr-sm bg-tangerine px-4 py-2.5 text-ink shadow-xl sm:-right-14">
                <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-70">Now</p>
                <p className="font-display text-2xl font-extrabold leading-none">{formatTaka(price)}</p>
                {was ? <s className="text-xs opacity-60">{formatTaka(was)}</s> : null}
              </m.div>
              <m.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.85 }}
                className="absolute -bottom-6 -left-8 max-w-[15rem] rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-xl">
                <span className="block text-xs text-white/60">Featured</span>
                <span className="font-semibold">{hero.name}</span>
              </m.p>
            </m.div>
          )}
        </div>
      </div>
    </section>
  );
}

function RingLabel({ text, className }: { text: string; className: string }) {
  return <span aria-hidden className={`absolute rounded-full bg-white/80 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-electric backdrop-blur ${className}`}>{text}</span>;
}

/** "Order in 2h 14m for same-day dispatch" — computed in Dhaka time on the client. */
function DispatchClock() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const dhaka = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
      const cutoff = new Date(dhaka);
      cutoff.setHours(17, 0, 0, 0);
      const friday = dhaka.getDay() === 5;
      const diff = cutoff.getTime() - dhaka.getTime();
      if (friday) setText("Orders placed today are dispatched on Saturday");
      else if (diff > 0) {
        const h = Math.floor(diff / 3.6e6), mm = Math.floor((diff % 3.6e6) / 6e4);
        setText(`Order in ${h ? `${h}h ` : ""}${mm}m for same-day dispatch in Dhaka`);
      } else setText("Order now — dispatched first thing tomorrow");
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="mt-8 flex min-h-6 items-center gap-2 text-sm font-medium text-ink-2" aria-live="off">
      <Streaks className="h-4 w-8" />
      {text ? <><Clock3 className="size-4 text-tangerine" /> {text}</> : null}
    </p>
  );
}
