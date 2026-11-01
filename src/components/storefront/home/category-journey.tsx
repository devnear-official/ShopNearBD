"use client";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, ArrowUpRight, ShoppingBag } from "lucide-react";
import clsx from "clsx";
import type { Category, ProductCard as Product } from "@/lib/catalog";
import { ProductCard } from "@/components/products/product-card";
import { ButtonLink } from "@/components/ui/button";

/**
 * Category journey, set inside a shopping mall: the ShopNear atrium in the middle,
 * a winding tiled walkway to every category "shop front", and everyday shoppers —
 * people with bags, a person pushing a trolley, couples, families, friends — strolling
 * along the real curved paths, in and out of the shops. Click a shop and a loaded
 * shopping cart rolls back along its walkway to the atrium, then that category's
 * products arrive in the showcase below.
 *
 * Data-driven: positions and walkways are recomputed from the category list, so any
 * number of categories stays balanced around the hub.
 */

type Kind = "bag" | "couple" | "cart" | "family" | "friends";
const KINDS: Kind[] = ["bag", "couple", "cart", "family", "friends", "bag", "cart"];
const SECONDS: Record<Kind, number> = { bag: 11, couple: 14, cart: 13, family: 16, friends: 13 };

type Pt = [number, number];
type Deco = { x: number; y: number; kind: "plant" | "lamp" };
type Geo = { W: number; H: number; cx: number; cy: number; routes: { x: number; y: number; out: string; back: string; flip: 1 | -1; deco: Deco[] }[] };

const f = (v: number) => Math.round(v * 100) / 100; // fixed precision so server and browser render identical markup

/** Smooth curve through the points (Catmull-Rom converted to cubic Béziers). */
function smooth(pts: Pt[]) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Evenly spaced shops on an ellipse around the atrium, each joined by a meandering walkway. */
function layout(n: number, compact: boolean): Geo {
  const W = compact ? 420 : 1200, H = compact ? 600 : 640;
  const cx = W / 2, cy = H / 2;
  const rx = W * (compact ? 0.34 : 0.385), ry = H * (compact ? 0.365 : 0.345);
  const routes = Array.from({ length: n }, (_, i) => {
    const a = ((-90 + 180 / n + (i * 360) / n) * Math.PI) / 180;
    const x = f(cx + rx * Math.cos(a)), y = f(cy + ry * Math.sin(a));
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const amp = len * (compact ? 0.05 : 0.055) * (i % 2 ? 1 : -1);
    // three waypoints that swing left, right, left again: a path people would really walk
    const wiggle = [1.0, -1.15, 0.8];
    const ts = [0.24, 0.5, 0.74];
    const mid: Pt[] = ts.map((t, k) => [f(cx + dx * t + px * amp * wiggle[k]), f(cy + dy * t + py * amp * wiggle[k])]);
    const pts: Pt[] = [[cx, cy], ...mid, [x, y]];
    const side = (i % 2 ? 1 : -1) * 1;
    const deco: Deco[] = [
      { x: f(mid[0][0] - px * 30 * side), y: f(mid[0][1] - py * 30 * side), kind: "plant" },
      { x: f(mid[2][0] + px * 30 * side), y: f(mid[2][1] + py * 30 * side), kind: "lamp" },
    ];
    return { x, y, out: smooth(pts), back: smooth([...pts].reverse()), flip: (dx < 0 ? -1 : 1) as 1 | -1, deco };
  });
  return { W, H, cx, cy, routes };
}

function useMedia(query: string, server: boolean) {
  return useSyncExternalStore(
    (cb) => { const mq = window.matchMedia(query); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => server,
  );
}

export function CategoryJourney({ categories, products }: { categories: Category[]; products: Record<string, Product[]> }) {
  const uid = useId().replace(/:/g, "");
  const compact = useMedia("(max-width: 767px)", false);
  const reduced = useMedia("(prefers-reduced-motion: reduce)", false);
  const geo = layout(categories.length, compact);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null); // the showcase appears once the cart has reached the atrium
  const [shown, setShown] = useState(false);
  const [trip, setTrip] = useState<{ slug: string; n: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cartAnim = useRef<SVGAnimateMotionElement>(null);
  const cartFade = useRef<SVGAnimateElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const choose = useCallback((slug: string) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSelected(slug);
    setTrip((t) => ({ slug, n: (t?.n ?? 0) + 1 }));
    if (!reduced) later(() => setPulse((p) => p + 1), 1900);
    later(() => {
      setRevealed(slug);
      requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }));
    }, reduced ? 0 : 2000);
  }, [reduced]);

  // Start the one-shot cart ride whenever a (new) category is chosen.
  useEffect(() => {
    if (!trip || reduced) return;
    cartAnim.current?.beginElement?.();
    cartFade.current?.beginElement?.();
  }, [trip, reduced]);

  const back = () => { timers.current.forEach(clearTimeout); setSelected(null); setRevealed(null); setTrip(null); };
  const focus = selected ?? hover;
  const current = categories.find((c) => c.slug === revealed) ?? null;
  const list = current ? products[current.slug] ?? [] : [];
  const tripIndex = trip ? categories.findIndex((c) => c.slug === trip.slug) : -1;
  const lane = compact ? 17 : 26; // walkway width

  return (
    <div>
      <div ref={root} className="relative mx-auto w-full max-w-[75rem]" style={{ aspectRatio: `${geo.W} / ${geo.H}` }}>
        {/* mall interior: tiled floor, skylight glow, ceiling lights, plants */}
        <span aria-hidden className="pointer-events-none absolute inset-x-[3%] inset-y-[5%] overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#e3eeff] via-[#f4f8ff] to-[#e9f1ff] ring-1 ring-electric/10 sm:rounded-[3.5rem]">
          <span className="absolute inset-0 opacity-80 [background-image:linear-gradient(rgba(22,119,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(22,119,255,.07)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_95%)]" />
          <span className="absolute -top-16 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-white/90 blur-3xl" />
          <span className="absolute left-[18%] top-[5%] h-1.5 w-[12%] rounded-full bg-white shadow-[0_0_28px_8px_rgba(255,255,255,.95)]" />
          <span className="absolute right-[18%] top-[5%] h-1.5 w-[12%] rounded-full bg-white shadow-[0_0_28px_8px_rgba(255,255,255,.95)]" />
          <span className="absolute left-1/2 top-[3%] h-1.5 w-[10%] -translate-x-1/2 rounded-full bg-white shadow-[0_0_28px_8px_rgba(255,255,255,.95)]" />
        </span>
        <CornerPlant className="pointer-events-none absolute bottom-[5%] left-[3.5%] z-[5] w-[8%] max-w-24" />
        <CornerPlant className="pointer-events-none absolute bottom-[5%] right-[3.5%] z-[5] w-[8%] max-w-24 -scale-x-100" />

        <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={`${uid}-glow`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#72B6FF" /><stop offset="1" stopColor="#1677FF" />
            </linearGradient>
            {geo.routes.map((r, i) => (
              <g key={i}>
                <path id={`${uid}-o${i}`} d={r.out} />
                <path id={`${uid}-b${i}`} d={r.back} />
              </g>
            ))}
          </defs>

          {/* tiled walkways */}
          {geo.routes.map((r, i) => {
            const slug = categories[i].slug;
            const on = focus === slug;
            const dim = focus !== null && !on;
            return (
              <g key={slug} className="transition-opacity duration-500" opacity={dim ? 0.4 : 1}>
                <path d={r.out} fill="none" stroke="#bcd3f5" strokeWidth={lane + 5} strokeLinecap="round" pathLength={1} className="sn-draw" data-on={shown ? "1" : "0"} style={{ transitionDelay: `${i * 120}ms` }} />
                <path d={r.out} fill="none" stroke="#f6faff" strokeWidth={lane} strokeLinecap="round" pathLength={1} className="sn-draw" data-on={shown ? "1" : "0"} style={{ transitionDelay: `${i * 120 + 80}ms` }} />
                <path d={r.out} fill="none" stroke="#cfe0fb" strokeWidth={lane} strokeDasharray="1.2 15" className="transition-opacity duration-700" opacity={shown ? 0.9 : 0} style={{ transitionDelay: "1.1s" }} />
                <path d={r.out} fill="none" stroke={`url(#${uid}-glow)`} strokeWidth={lane} strokeLinecap="round" opacity={on ? 0.55 : 0} className="transition-opacity duration-300" style={{ filter: on ? "drop-shadow(0 0 9px rgba(22,119,255,.7))" : undefined }} />
              </g>
            );
          })}

          {/* greenery and lamps beside the walkways */}
          {geo.routes.map((r, i) => (
            <g key={i} opacity={shown ? 1 : 0} className="transition-opacity duration-700" style={{ transitionDelay: "1.2s" }}>
              {r.deco.map((d, k) => (d.kind === "plant" ? <Plant key={k} x={d.x} y={d.y} s={compact ? 0.7 : 1} /> : <Lamp key={k} x={d.x} y={d.y} s={compact ? 0.7 : 1} />))}
            </g>
          ))}

          {/* shoppers strolling both ways, staggered, never all at once */}
          {shown && !reduced && geo.routes.map((r, i) => {
            const slug = categories[i].slug;
            const dim = focus !== null && focus !== slug;
            const riders = compact ? 1 : 2;
            const sc = compact ? 1.05 : 1.5;
            return (
              <g key={slug} opacity={dim ? 0.25 : 1} className="transition-opacity duration-500">
                {Array.from({ length: riders }, (_, k) => {
                  const kind = KINDS[(i + k * 3) % KINDS.length];
                  const dur = SECONDS[kind] / 0.64;
                  const begin = 1.4 + ((i * 1.9 + k * 4.7) % 8);
                  const inbound = k === 1;
                  return (
                    <g key={k} opacity="0">
                      <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.64;1">
                        <mpath href={`#${uid}-${inbound ? "b" : "o"}${i}`} />
                      </animateMotion>
                      <animate attributeName="opacity" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.04;0.58;0.64;1" />
                      <g transform={`scale(${(inbound ? -r.flip : r.flip) * sc} ${sc})`}><Shoppers kind={kind} seed={i + k} /></g>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* the loaded shopping cart that rolls from the clicked shop back to the atrium */}
          {trip && tripIndex >= 0 && !reduced && (
            <g key={trip.n} opacity="0">
              <animateMotion ref={cartAnim} dur="1.9s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.45 0 0.3 1">
                <mpath href={`#${uid}-b${tripIndex}`} />
              </animateMotion>
              <animate ref={cartFade} attributeName="opacity" dur="1.9s" begin="indefinite" fill="freeze" values="0;1;1;1;0" keyTimes="0;0.08;0.5;0.92;1" />
              <g transform={`scale(${geo.routes[tripIndex].flip * -1 * (compact ? 1.2 : 1.6)} ${compact ? 1.2 : 1.6})`}><LoadedCart color={categories[tripIndex].accent ?? "#1677FF"} /></g>
            </g>
          )}
        </svg>

        {/* atrium hub */}
        <div key={pulse} className={clsx("absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2", compact ? "w-[44%]" : "w-[22%]", pulse > 0 && "sn-hub-pulse")}>
          <div className="sn-float relative aspect-square">
            <span aria-hidden className="absolute -inset-[16%] rounded-full bg-electric/20 blur-2xl" />
            <span aria-hidden className="sn-spin absolute -inset-[13%] rounded-full border-2 border-dashed border-electric/30" />
            <span aria-hidden className="absolute -inset-[7%] rounded-full bg-gradient-to-b from-[#8ec3ff] to-electric/70 shadow-[0_18px_40px_-12px_rgba(22,119,255,.55)]" />
            <span aria-hidden className="absolute -inset-[2%] rounded-full bg-gradient-to-b from-white to-[#dcebff] ring-2 ring-white/80" />
            <div className="absolute inset-[6%] flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-white to-[#f1f7ff] text-center shadow-inner">
              <Image src="/brand/mark-512.png" alt="" width={96} height={96} className={clsx("object-contain", compact ? "size-9" : "size-[34%]")} />
              <span className={clsx("font-display font-bold leading-none text-ink", compact ? "mt-0.5 text-[0.95rem]" : "mt-1 text-[clamp(1rem,2.1vw,1.7rem)]")}>ShopNear</span>
              <span className={clsx("rounded-full bg-electric/10 font-bold uppercase tracking-[0.18em] text-electric", compact ? "mt-1 px-2 py-0.5 text-[0.5rem]" : "mt-1.5 px-3 py-1 text-[clamp(0.5rem,0.85vw,0.7rem)]")}>Mall · Categories</span>
            </div>
          </div>
        </div>

        {/* shop fronts */}
        {categories.map((c, i) => {
          const r = geo.routes[i];
          const on = focus === c.slug;
          const dim = focus !== null && !on;
          const pic = c.cover ?? c.image_url;
          const accent = c.accent ?? "#1677FF";
          return (
            <div key={c.slug} className={clsx("pop-in absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500", compact ? "w-[30%]" : "w-[14%]", dim && "opacity-45")}
              style={{ left: `${f((r.x / geo.W) * 100)}%`, top: `${f((r.y / geo.H) * 100)}%`, ["--d" as string]: `${300 + i * 90}ms` }}>
              <button type="button" onClick={() => choose(c.slug)} onPointerEnter={() => setHover(c.slug)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(c.slug)} onBlur={() => setHover(null)}
                aria-pressed={selected === c.slug} aria-label={`${c.name}, ${c.product_count} products. Show products`}
                className={clsx("sn-float group relative block w-full text-left outline-none transition-transform duration-300 ease-[var(--ease-snap)]", on ? "-translate-y-1.5 scale-105" : "hover:-translate-y-1.5 hover:scale-105", "focus-visible:-translate-y-1.5")}
                style={{ ["--fd" as string]: `${i * -0.7}s`, ["--c" as string]: accent }}>
                <span aria-hidden className="absolute inset-x-[6%] -bottom-[7%] h-[16%] rounded-[50%] bg-ink/15 blur-md" />
                {/* striped shop awning with scalloped edge */}
                <span aria-hidden className={clsx("relative z-10 block rounded-t-[0.9rem] shadow-[0_6px_10px_-6px_rgba(11,21,48,.5)]", compact ? "h-3" : "h-4")}
                  style={{ backgroundImage: `repeating-linear-gradient(90deg, ${accent} 0 ${compact ? 10 : 14}px, #fff ${compact ? 10 : 14}px ${compact ? 20 : 28}px)` }} />
                <span aria-hidden className="relative z-10 -mt-px block h-2" style={{ backgroundImage: `radial-gradient(circle at ${compact ? 5 : 7}px 0, ${accent} ${compact ? 5 : 7}px, transparent ${compact ? 5.5 : 7.5}px), radial-gradient(circle at ${compact ? 15 : 21}px 0, #fff ${compact ? 5 : 7}px, transparent ${compact ? 5.5 : 7.5}px)`, backgroundSize: `${compact ? 20 : 28}px 100%`, backgroundRepeat: "repeat-x", filter: "drop-shadow(0 2px 1px rgba(11,21,48,.12))" }} />
                {/* shop window */}
                <span className={clsx("relative -mt-2 block overflow-hidden rounded-b-[1.1rem] bg-white shadow-[0_16px_30px_-14px_rgba(22,119,255,.55)] ring-1 transition group-focus-visible:ring-2 group-focus-visible:ring-electric", compact ? "px-1.5 pb-1.5 pt-3" : "px-2 pb-2 pt-3.5", on ? "ring-electric" : "ring-electric/10")}>
                  <span className="relative block aspect-[16/11] overflow-hidden rounded-xl" style={{ background: `${accent}1f` }}>
                    {pic ? <Image src={pic} alt="" fill sizes="(min-width:768px) 10vw, 22vw" className="object-cover transition-transform duration-700 group-hover:scale-110" /> : <ShoppingBag className="absolute inset-0 m-auto size-1/2" style={{ color: accent }} />}
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent" />
                  </span>
                  <span className={clsx("mt-1.5 flex items-center justify-between gap-1", compact ? "" : "mt-2")}>
                    <span className={clsx("truncate font-bold text-ink", compact ? "text-[0.68rem]" : "text-[clamp(0.75rem,1vw,0.92rem)]")}>{c.name}</span>
                    <span className={clsx("grid shrink-0 place-items-center rounded-full bg-electric text-white transition-transform duration-300 group-hover:rotate-45", compact ? "size-4" : "size-6")}><ArrowUpRight className={compact ? "size-2.5" : "size-3.5"} /></span>
                  </span>
                </span>
                <span className={clsx("pointer-events-none absolute -bottom-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[0.7rem] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100", !compact && "sm:block")}>Step inside</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* showcase */}
      <div ref={panel} className="scroll-mt-28">
        <AnimatePresence mode="wait">
          {current && (
            <m.section key={current.slug} aria-label={`${current.name} products`}
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: "spring", stiffness: 220, damping: 28 }}
              className="relative mx-auto mt-6 max-w-[75rem] rounded-[2rem] bg-white/80 p-4 shadow-[0_30px_60px_-30px_rgba(22,119,255,.4)] ring-1 ring-electric/10 backdrop-blur sm:rounded-[2.5rem] sm:p-8">
              <span aria-hidden className="absolute -top-3 left-1/2 size-6 -translate-x-1/2 rotate-45 rounded-sm bg-white/80 ring-1 ring-electric/10" />
              <header className="flex flex-wrap items-center gap-3 sm:gap-4">
                <button type="button" onClick={back} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-cloud px-4 text-sm font-semibold text-ink transition hover:bg-line">← All categories</button>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-bold sm:text-2xl">{current.name}{current.name_bn && <span className="bn ml-2 text-base font-semibold text-slate" lang="bn">{current.name_bn}</span>}</h3>
                  {current.description && <p className="line-clamp-1 text-sm text-slate">{current.description}</p>}
                </div>
                <ButtonLink href={`/shop?category=${current.slug}`} size="md">View all {current.name} <ArrowRight className="size-4" /></ButtonLink>
              </header>
              {list.length ? (
                <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                  {list.slice(0, 4).map((p, i) => (
                    <m.li key={p.id} initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 240, damping: 24, delay: 0.25 + i * 0.09 }}>
                      <ProductCard product={p} />
                    </m.li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 rounded-2xl bg-paper p-6 text-center text-slate">Products for {current.name} are on their way.</p>
              )}
            </m.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────── mall scenery ───────── */

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="9" ry="3" fill="#0b1530" opacity=".12" />
      <path d="M-6 -9 H6 L4.6 1 H-4.6 Z" fill="#fff" stroke="#bcd3f5" strokeWidth="1" strokeLinejoin="round" />
      <path d="M0 -9 C-9 -13 -9 -23 -3 -26 C-2 -19 -1 -14 0 -9 Z" fill="#22b573" />
      <path d="M0 -9 C9 -13 9 -23 3 -26 C2 -19 1 -14 0 -9 Z" fill="#17935c" />
      <path d="M0 -9 C-2 -17 2 -24 0 -30 C4 -24 3 -15 0 -9 Z" fill="#34d399" />
    </g>
  );
}

function Lamp({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-32" r="13" fill="#fff6d6" opacity=".6" />
      <rect x="-1" y="-30" width="2" height="31" rx="1" fill="#8d97b0" />
      <ellipse cx="0" cy="1" rx="5" ry="1.8" fill="#8d97b0" />
      <circle cx="0" cy="-32" r="4.6" fill="#fff3bf" stroke="#ffd36b" strokeWidth="1" />
    </g>
  );
}

function CornerPlant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 110" className={className} aria-hidden>
      <ellipse cx="40" cy="104" rx="26" ry="5" fill="#0b1530" opacity=".1" />
      <path d="M18 66 H62 L56 104 H24 Z" fill="#fff" stroke="#bcd3f5" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 66 C10 58 6 28 22 12 C30 32 36 50 40 66 Z" fill="#22b573" />
      <path d="M40 66 C70 58 74 28 58 12 C50 32 44 50 40 66 Z" fill="#17935c" />
      <path d="M40 66 C30 44 44 24 40 2 C56 24 52 50 40 66 Z" fill="#34d399" />
    </svg>
  );
}

/* ───────── people. Drawn facing right, feet on y = 0, ~30 units tall. ───────── */

type PersonProps = { x?: number; s?: number; top: string; bottom: string; skin?: string; hair?: string; dress?: boolean; long?: boolean; bag?: string; delay?: number };

function Person({ x = 0, s = 1, top, bottom, skin = "#f1c7a1", hair = "#1b2440", dress, long, bag, delay = 0 }: PersonProps) {
  const d = { animationDelay: `${delay}s` };
  return (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <g className="sn-bob" style={d}>
        <rect x="-1.9" y="-10" width="3.8" height="10.4" rx="1.9" fill={bottom} className="sn-leg-a" style={d} />
        <rect x="-1.9" y="-10" width="3.8" height="10.4" rx="1.9" fill={bottom} opacity=".78" className="sn-leg-b" style={d} />
        {long && <rect x="-4.6" y="-28.5" width="3.6" height="10" rx="1.8" fill={hair} />}
        {dress ? <path d="M-3.6 -22 H3.6 L6 -9 H-6 Z" fill={top} /> : <rect x="-4.3" y="-22" width="8.6" height="13" rx="4" fill={top} />}
        <circle cx="0.4" cy="-26" r="4.2" fill={skin} />
        <path d="M-3.9 -26.4a4.3 4.3 0 0 1 8.6 -0.4c0 .9 -.6 1.6 -1.4 1.4c-1.6 -1 -4.4 -1.6 -7.2 -1z" fill={hair} />
        {bag && (
          <g transform="translate(3.4 -15)">
            <path d="M1.5 0V-2.6a2.1 2.1 0 0 1 4.2 0V0" fill="none" stroke="#10264A" strokeWidth=".9" />
            <rect x="0" y="0" width="7.2" height="9" rx="1.4" fill={bag} />
            <rect x="0" y="3" width="7.2" height="1.4" fill="#fff" opacity=".55" />
          </g>
        )}
      </g>
    </g>
  );
}

const hands = (d: string) => <path d={d} fill="none" stroke="#f1c7a1" strokeWidth="1.9" strokeLinecap="round" />;

function Shoppers({ kind, seed }: { kind: Kind; seed: number }) {
  const v = seed % 3;
  if (kind === "bag") {
    return (
      <>
        <Person x={-5} top={["#1677FF", "#f43f5e", "#10b981"][v]} bottom="#26324f" bag="#FF9F43" />
        {v === 1 && <Person x={11} s={0.95} top="#8b5cf6" bottom="#26324f" dress long bag="#22b8cf" delay={0.35} />}
      </>
    );
  }
  if (kind === "couple") {
    return (
      <>
        <Person x={-9} top="#1677FF" bottom="#1d2a49" delay={0.2} />
        <Person x={9} top="#f472b6" bottom="#f472b6" dress long bag="#FF9F43" delay={0.5} s={0.96} />
        {hands("M-5 -15 Q0 -11.5 5.5 -15")}
      </>
    );
  }
  if (kind === "cart") {
    return (
      <>
        <Person x={-9} top={["#10b981", "#8b5cf6", "#f43f5e"][v]} bottom="#26324f" long={v === 1} dress={v === 1} />
        {hands("M-5 -16 L5.5 -21")}
        <Cart x={13} />
      </>
    );
  }
  if (kind === "family") {
    return (
      <>
        <Person x={-17} top="#26324f" bottom="#3b4a6b" bag="#10b981" delay={0.1} />
        <Person x={0} s={0.6} top="#ffb020" bottom="#1677FF" delay={0.4} hair="#3a2a1e" />
        <Person x={17} top="#14b8a6" bottom="#14b8a6" dress long bag="#f472b6" delay={0.7} s={0.97} />
        {hands("M-13 -15 Q-8 -12 -3.5 -9.5")}
        {hands("M3.5 -9.5 Q9 -12 13 -15")}
      </>
    );
  }
  return (
    <>
      <Person x={-9} top="#8b5cf6" bottom="#8b5cf6" dress long bag="#FF9F43" delay={0.2} />
      <Person x={9} top="#22b8cf" bottom="#26324f" long bag="#f43f5e" delay={0.55} />
    </>
  );
}

/** A trolley with the shopping in it. */
function Cart({ x = 0 }: { x?: number }) {
  return (
    <g transform={`translate(${x} 0)`} className="sn-bob">
      <rect x="-5" y="-30" width="6.4" height="5.6" rx="1" fill="#FF9F43" />
      <rect x="1.8" y="-29" width="5.6" height="4.6" rx="1" fill="#1677FF" />
      <circle cx="-1.6" cy="-32" r="2.4" fill="#ef4444" />
      <path d="M-9 -24 H10 L7.2 -10.5 H-6 Z" fill="#eef5ff" stroke="#10264A" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M-4.6 -24 L-3.8 -10.5 M0.5 -24 V-10.5 M5.4 -24 L4.6 -10.5 M-8 -17.5 H8.8" stroke="#10264A" strokeWidth=".7" opacity=".4" />
      <path d="M-9 -24 L-11.6 -27.5 H-14.5" stroke="#10264A" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-5.6 -10.5 L-5 -6 M6.2 -10.5 L6.2 -6" stroke="#10264A" strokeWidth="1.2" />
      <circle cx="-4.4" cy="-3.2" r="2.8" fill="#10264A" /><circle cx="6.4" cy="-3.2" r="2.8" fill="#10264A" />
    </g>
  );
}

/** The loaded cart that rolls back to the atrium when a shop is chosen. */
function LoadedCart({ color }: { color: string }) {
  return (
    <g className="sn-bob">
      <path d="M-24 -20 h9 M-28 -14 h13 M-24 -8 h9" stroke="#72B6FF" strokeWidth="2" strokeLinecap="round" opacity=".85" />
      <rect x="-10" y="-31" width="9" height="8" rx="1.5" fill="#FF9F43" />
      <rect x="0" y="-34" width="8.5" height="11" rx="1.5" fill={color} />
      <circle cx="12" cy="-27" r="3.2" fill="#ef4444" />
      <path d="M-15 -37 h5 l3 23 h20 l3.6 -16 h-25" fill="#eef5ff" stroke="#10264A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="-3" cy="-7" r="3.2" fill="#10264A" /><circle cx="14" cy="-7" r="3.2" fill="#10264A" />
    </g>
  );
}
