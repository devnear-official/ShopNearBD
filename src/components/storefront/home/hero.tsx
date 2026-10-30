"use client";
import Image from "next/image";
import { IntentLink } from "@/components/ui/intent-link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, Clock3, Headphones, Headset, LayoutGrid, MapPin, Percent, Search, ShieldCheck, Shirt, Sofa, Sparkles, Tag, Truck, Watch, Heart } from "lucide-react";
import type { HomepageSettings, ProductCard } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Streaks, Swoosh } from "@/components/ui/streaks";
import { BagArt, CartArt, GiftBox, Parcel } from "./hero-art";

/**
 * Hero: the copy on the left, and on the right a drawn scene of a phone-first store with a
 * loaded cart that rolls in and keeps moving. On desktop the layers drift with the cursor.
 */
export function Hero({ copy, hero }: { copy: HomepageSettings; hero: ProductCard | null }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });

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
    <section ref={ref} className="relative isolate overflow-hidden px-4 pb-10 pt-6 sm:px-8 lg:pb-16 lg:pt-8">
      {/* the big blue wave behind the scene (desktop) */}
      <svg aria-hidden viewBox="0 0 800 700" preserveAspectRatio="none" className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[58%] lg:block">
        <defs>
          <linearGradient id="hero-wave" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dbe8ff" /><stop offset=".45" stopColor="#7fb0ff" /><stop offset="1" stopColor="#2f78ff" /></linearGradient>
          <linearGradient id="hero-wave2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#bfe9ff" stopOpacity=".7" /><stop offset="1" stopColor="#1e6bff" stopOpacity=".15" /></linearGradient>
        </defs>
        <path d="M230 0 C90 120 210 300 90 470 C40 540 20 620 0 700 H800 V0 Z" fill="url(#hero-wave)" />
        <path d="M330 0 C240 130 330 280 250 420 C210 500 240 600 200 700 H800 V0 Z" fill="url(#hero-wave2)" />
      </svg>
      <div aria-hidden className="absolute -left-40 top-60 -z-10 size-[30rem] rounded-full bg-[radial-gradient(closest-side,#d8f4ff,transparent)]" />

      <div className="mx-auto grid max-w-7xl items-center gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-2">
        <div className="relative z-10 pt-4 lg:pt-0">
          <p className="enter eyebrow inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-electric shadow-[var(--shadow-card)]">
            <MapPin className="size-3.5" /> {copy.hero_eyebrow}
          </p>
          <h1 className="display mt-6 t-hero">
            <span className="enter-move block">{copy.hero_title}</span>
            <span className="enter-move relative block [--d:80ms]">
              <span className="text-gradient pr-2">{copy.hero_title_accent}</span>
              <span aria-hidden className="swoosh-in absolute -bottom-3 left-0 block h-5 w-[min(100%,34rem)]">
                <Swoosh className="h-full w-full" />
              </span>
            </span>
          </h1>
          <p className="enter mt-8 max-w-lg [--d:200ms] text-base sm:text-lg leading-relaxed text-slate">
            {copy.hero_subtitle}
          </p>
          <div className="enter mt-8 flex flex-wrap items-center gap-3 [--d:280ms]">
            <ButtonLink href="/shop" size="lg">Shop now <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-1" /></ButtonLink>
            <ButtonLink href={`/shop?collection=${copy.campaign_collection}`} variant="ghost" size="lg">Explore {copy.campaign_title}</ButtonLink>
          </div>
          <Promises />
          <DispatchClock />
        </div>

        <Scene hero={hero} img={img} price={price} was={was} sx={sx} sy={sy} reduce={Boolean(reduce)} />
      </div>
    </section>
  );
}

const PROMISES = [
  { icon: Truck, label: "Fast delivery", tone: "from-electric to-sky" },
  { icon: ShieldCheck, label: "Quality products", tone: "from-tangerine to-sun" },
  { icon: Tag, label: "Best prices", tone: "from-rose to-flame" },
  { icon: Headset, label: "Reliable support", tone: "from-mint to-[#34d399]" },
];

function Promises() {
  return (
    <ul className="enter mt-9 grid max-w-xl grid-cols-4 gap-2 [--d:360ms] sm:gap-4">
      {PROMISES.map(({ icon: Icon, label, tone }) => (
        <li key={label} className="flex flex-col items-center gap-2 text-center">
          <span className={`grid size-12 place-items-center rounded-full bg-gradient-to-br text-white shadow-[0_10px_18px_-8px_rgb(11_21_48/0.5)] sm:size-14 ${tone}`}><Icon className="size-5 sm:size-6" /></span>
          <span className="text-xs font-semibold leading-tight text-ink-2 sm:text-sm">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/** A layer that drifts with the pointer; `depth` is how far (px) at the screen edge. */
function Layer({ sx, sy, depth, reduce, className, children }: { sx: MotionValue<number>; sy: MotionValue<number>; depth: number; reduce: boolean; className?: string; children: React.ReactNode }) {
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth * 0.7);
  return <m.div style={reduce ? undefined : { x, y }} className={className}>{children}</m.div>;
}

const CATS = [
  { icon: Headphones, label: "Electronics", c: "#1e6bff" },
  { icon: Shirt, label: "Fashion", c: "#ef4444" },
  { icon: Sofa, label: "Home & Living", c: "#ff7a1a" },
  { icon: Sparkles, label: "Beauty", c: "#e11d74" },
  { icon: Watch, label: "Accessories", c: "#0f172a" },
  { icon: LayoutGrid, label: "More", c: "#3b82f6" },
];

/**
 * Sizes inside the scene are in `cqw` (1% of the scene's width) so the whole composition
 * scales as one picture from a 360 px phone to a wide desktop.
 */
function Scene({ hero, img, price, was, sx, sy, reduce }: { hero: ProductCard | null; img?: ProductCard["images"][number]; price?: number; was: number | null; sx: MotionValue<number>; sy: MotionValue<number>; reduce: boolean }) {
  return (
    <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[38rem] [container-type:inline-size]">
      {/* mobile backdrop; on desktop the page-wide wave does this job */}
      <div aria-hidden className="absolute inset-x-[-3%] bottom-[2%] top-[14%] rounded-[3rem] bg-gradient-to-br from-[#cfe0ff] via-[#8db8ff] to-[#2f78ff] lg:hidden" />

      <Layer sx={sx} sy={sy} depth={10} reduce={reduce} className="absolute inset-0">
        <Phone />
      </Layer>

      {/* parcels floating behind */}
      <Layer sx={sx} sy={sy} depth={26} reduce={reduce} className="absolute inset-0">
        <div className="hero-float absolute right-[-3%] top-[38%] w-[15%] rotate-[22deg] blur-[1px]" style={{ "--fd": "1.2s" } as CSSProperties}><Parcel /></div>
        <div className="hero-float absolute left-[66%] top-[-3%] w-[10%] rotate-[28deg] blur-[2px]" style={{ "--fd": "2s" } as CSSProperties}><Parcel /></div>
      </Layer>

      {/* the cart: drives in, then idles; its goods hop */}
      <Layer sx={sx} sy={sy} depth={18} reduce={reduce} className="absolute bottom-[1%] left-[-1%] z-10 w-[74%]">
        <div className="hero-streaks absolute -left-[12%] top-[42%] hidden w-[16%] flex-col gap-[0.7cqw] sm:flex" aria-hidden>
          <span className="h-[0.9cqw] w-full rounded-full bg-white/80" /><span className="ml-[30%] h-[0.9cqw] w-[70%] rounded-full bg-white/60" /><span className="h-[0.9cqw] w-[85%] rounded-full bg-white/70" />
        </div>
        <div className="hero-cart-in"><div className="hero-cart-bob"><CartArt className="block w-full" /></div></div>
      </Layer>

      {/* branded bag + small bag */}
      <Layer sx={sx} sy={sy} depth={22} reduce={reduce} className="absolute bottom-[1%] right-[-1%] z-20 w-[34%]">
        <div className="hero-bag-in"><div className="hero-float" style={{ "--fd": "0.6s", "--fa": "5px" } as CSSProperties}><BagArt className="block w-full drop-shadow-[0_18px_18px_rgb(11_21_48/0.3)]" /></div></div>
      </Layer>
      <Layer sx={sx} sy={sy} depth={14} reduce={reduce} className="absolute bottom-[18%] left-[-3%] z-0 w-[17%]">
        <div className="hero-bag-in [--d:0.5s] [animation-delay:0.5s]"><BagArt small className="block w-full -rotate-6 opacity-95 drop-shadow-[0_12px_12px_rgb(11_21_48/0.25)]" /></div>
      </Layer>
      <Layer sx={sx} sy={sy} depth={24} reduce={reduce} className="absolute bottom-[-1%] left-[-2%] z-20 w-[22%]">
        <div className="flex items-end gap-[6%]"><div className="hero-float w-[62%] -rotate-6" style={{ "--fd": "0.3s", "--fa": "4px" } as CSSProperties}><Parcel /></div><div className="hero-float w-[48%] rotate-6" style={{ "--fd": "1.1s", "--fa": "4px" } as CSSProperties}><GiftBox /></div></div>
      </Layer>

      {/* floating chips */}
      <Layer sx={sx} sy={sy} depth={34} reduce={reduce} className="absolute inset-0 z-30">
        <Chip className="left-[1%] top-[19%]" delay="0s" tint="bg-electric" icon={<Truck className="size-[55%]" />}>Wide Range<br />of Products</Chip>
        <Chip className="right-[-2%] top-[7%]" delay="0.9s" tint="bg-tangerine" icon={<Percent className="size-[55%]" />}>Great<br />Deals</Chip>
        <Chip className="right-[-3%] top-[58%]" delay="1.6s" tint="bg-mint" icon={<ShieldCheck className="size-[55%]" />}>Trusted<br />Shopping</Chip>
        <span aria-hidden className="hero-float absolute right-[8%] top-[40%] grid size-[9cqw] place-items-center rounded-[2.2cqw] rounded-bl-[0.6cqw] bg-gradient-to-br from-rose to-flame text-white shadow-[0_1.5cqw_3cqw_-1cqw_rgb(244_63_94/0.7)]" style={{ "--fd": "0.4s" } as CSSProperties}><Heart className="size-[5.4cqw] fill-white" /></span>

        {hero && img && (
          <IntentLink href={`/shop/${hero.slug}`} className="pop-in absolute left-[0%] top-[1%] flex max-w-[43%] items-center gap-[1.6cqw] rounded-[2.4cqw] bg-white p-[1.2cqw] pr-[2.2cqw] shadow-[var(--shadow-float)] transition hover:scale-105 [--d:900ms]" aria-label={`Featured: ${hero.name}`}>
            <span className="relative block size-[9cqw] shrink-0 overflow-hidden rounded-[1.6cqw] bg-cloud"><Image src={img.url} alt="" fill priority sizes="64px" className="object-cover" /></span>
            <span className="min-w-0">
              <span className="block text-[2.1cqw] font-bold uppercase tracking-wider text-electric">Featured</span>
              <span className="block truncate text-[2.8cqw] font-semibold leading-tight">{hero.name}</span>
              <span className="flex items-baseline gap-[1cqw] text-[3cqw] font-extrabold leading-tight text-tangerine">{formatTaka(price)}{was ? <s className="text-[2.2cqw] font-medium text-mist">{formatTaka(was)}</s> : null}</span>
            </span>
          </IntentLink>
        )}
      </Layer>
    </div>
  );
}

function Chip({ children, icon, tint, className, delay }: { children: React.ReactNode; icon: React.ReactNode; tint: string; className: string; delay: string }) {
  return (
    <div className={`absolute ${className}`}>
      <div className="hero-float flex items-center gap-[1.8cqw] rounded-full bg-white py-[1.3cqw] pl-[1.3cqw] pr-[3.2cqw] shadow-[0_2cqw_4cqw_-2cqw_rgb(11_21_48/0.35)]" style={{ "--fd": delay } as CSSProperties}>
        <span className={`grid size-[8.4cqw] shrink-0 place-items-center rounded-full text-white ${tint}`}>{icon}</span>
        <span className="text-[3.3cqw] font-bold leading-[1.15] text-ink">{children}</span>
      </div>
    </div>
  );
}

/** Phone showing a store home screen. */
function Phone() {
  return (
    <div aria-hidden className="hero-phone absolute left-[36%] top-[1%] w-[42%] rotate-[3deg] rounded-[5.4cqw] bg-gradient-to-b from-[#e7ecf6] via-[#aeb8cf] to-[#e7ecf6] p-[0.9cqw] shadow-[0_5cqw_8cqw_-3cqw_rgb(11_21_48/0.5)]">
      <div className="relative overflow-hidden rounded-[4.6cqw] bg-gradient-to-b from-[#f3f7ff] to-[#dfeaff] px-[2.6cqw] pb-[3cqw] pt-[2.4cqw]" style={{ aspectRatio: "9 / 17.5" }}>
        <span className="mx-auto block h-[2.4cqw] w-[11cqw] rounded-full bg-ink" />
        <div className="mt-[3cqw] flex items-center gap-[1.4cqw] rounded-[2cqw] bg-white px-[2cqw] py-[1.8cqw] shadow-[0_0.6cqw_1.4cqw_-0.6cqw_rgb(11_21_48/0.25)]">
          <span className="min-w-0 flex-1 truncate text-[2.2cqw] text-mist">Search products…</span>
          <span className="grid size-[4.4cqw] place-items-center rounded-[1.2cqw] bg-electric text-white"><Search className="size-[2.6cqw]" /></span>
        </div>
        <div className="mt-[3.4cqw] grid grid-cols-3 gap-x-[1cqw] gap-y-[2.6cqw]">
          {CATS.map(({ icon: Icon, label, c }, i) => (
            <div key={label} className="hero-tile flex flex-col items-center gap-[0.9cqw]" style={{ "--td": `${0.6 + i * 0.12}s` } as CSSProperties}>
              <span className="grid size-[8cqw] place-items-center rounded-full bg-white shadow-[0_0.8cqw_1.6cqw_-0.8cqw_rgb(11_21_48/0.3)]" style={{ color: c }}><Icon className="size-[4.2cqw]" /></span>
              <span className="text-[1.7cqw] font-medium text-ink-2">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-[3.6cqw] h-[8cqw] rounded-[2cqw] bg-gradient-to-r from-electric to-sky" />
      </div>
    </div>
  );
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
