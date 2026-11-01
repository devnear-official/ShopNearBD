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
 * Category journey: a ShopNear hub in the middle, one road per category, and the
 * roads are never empty — shoppers, cyclists, bikes and vans keep travelling along
 * the real curved paths. Click a category and a cart rides from it back to the hub,
 * then that category's products arrive in the showcase below.
 *
 * Everything is data-driven: node positions and roads are recomputed from the
 * category list, so any number of categories stays balanced around the hub.
 */

type Kind = "walker" | "cyclist" | "bike" | "van";
const KINDS: Kind[] = ["walker", "cyclist", "bike", "van", "walker", "bike", "cyclist"];
const SPEED: Record<Kind, number> = { walker: 13, cyclist: 9.5, bike: 6.5, van: 5.5 };
const PALETTE = ["#1677FF", "#FF9F43", "#10B981", "#8B5CF6", "#F43F5E", "#0EA5E9"];

type Geo = { W: number; H: number; cx: number; cy: number; routes: { x: number; y: number; out: string; back: string; flip: 1 | -1 }[] };

/** Evenly spaced nodes on an ellipse around the hub, each joined by an S-shaped road. */
const f = (v: number) => Math.round(v * 100) / 100; // fixed precision so server and browser render identical markup

function layout(n: number, compact: boolean): Geo {
  const W = compact ? 420 : 1200, H = compact ? 600 : 640;
  const cx = W / 2, cy = H / 2;
  const rx = W * (compact ? 0.335 : 0.37), ry = H * (compact ? 0.36 : 0.335);
  const routes = Array.from({ length: n }, (_, i) => {
    const a = ((-90 + 180 / n + (i * 360) / n) * Math.PI) / 180;
    const x = f(cx + rx * Math.cos(a)), y = f(cy + ry * Math.sin(a));
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len, bend = (i % 2 ? 1 : -1) * len * 0.13;
    const c1 = `${f(cx + dx * 0.33 + px * bend)} ${f(cy + dy * 0.33 + py * bend)}`;
    const c2 = `${f(cx + dx * 0.66 - px * bend)} ${f(cy + dy * 0.66 - py * bend)}`;
    return { x, y, out: `M${cx} ${cy} C${c1} ${c2} ${x} ${y}`, back: `M${x} ${y} C${c2} ${c1} ${cx} ${cy}`, flip: (dx < 0 ? -1 : 1) as 1 | -1 };
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
  const [revealed, setRevealed] = useState<string | null>(null); // the showcase appears once the cart has reached the hub
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
    if (!reduced) later(() => setPulse((p) => p + 1), 1650);
    later(() => {
      setRevealed(slug);
      requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }));
    }, reduced ? 0 : 1750);
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

  return (
    <div>
      <div ref={root} className="relative mx-auto w-full max-w-[75rem]" style={{ aspectRatio: `${geo.W} / ${geo.H}` }}>
        {/* soft backdrop */}
        <span aria-hidden className="pointer-events-none absolute inset-x-[4%] inset-y-[6%] rounded-[3rem] bg-gradient-to-b from-[#eaf2ff] via-[#f3f8ff] to-[#e6f0ff]" />
        <span aria-hidden className="pointer-events-none absolute left-[8%] top-[12%] size-24 rounded-full bg-sky/20 blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute bottom-[10%] right-[8%] size-32 rounded-full bg-electric/15 blur-3xl" />

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

          {/* roads */}
          {geo.routes.map((r, i) => {
            const slug = categories[i].slug;
            const on = focus === slug;
            const dim = focus !== null && !on;
            return (
              <g key={slug} className="transition-opacity duration-500" opacity={dim ? 0.35 : 1}>
                <path d={r.out} fill="none" stroke="#cfe0fb" strokeWidth={compact ? 15 : 22} strokeLinecap="round" pathLength={1} className="sn-draw" data-on={shown ? "1" : "0"} style={{ transitionDelay: `${i * 120}ms` }} />
                <path d={r.out} fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth={compact ? 1.6 : 2.2} strokeDasharray="7 11" strokeLinecap="round" className="sn-road-dash" opacity={shown ? 1 : 0} />
                <path d={r.out} fill="none" stroke={`url(#${uid}-glow)`} strokeWidth={compact ? 15 : 22} strokeLinecap="round" opacity={on ? 0.9 : 0} className="transition-opacity duration-300" style={{ filter: on ? "drop-shadow(0 0 8px rgba(22,119,255,.65))" : undefined }} />
              </g>
            );
          })}

          {/* people and vehicles travelling the roads, both ways, staggered, never all at once */}
          {shown && !reduced && geo.routes.map((r, i) => {
            const slug = categories[i].slug;
            const dim = focus !== null && focus !== slug;
            const riders = compact ? 1 : 2;
            return (
              <g key={slug} opacity={dim ? 0.25 : 1} className="transition-opacity duration-500">
                {Array.from({ length: riders }, (_, k) => {
                  const kind = KINDS[(i + k * 3) % KINDS.length];
                  const dur = SPEED[kind] / 0.62;
                  const begin = 1.4 + ((i * 1.9 + k * 4.3) % 7);
                  const inbound = k === 1;
                  return (
                    <g key={k}>
                      <g opacity="0">
                        <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.62;1">
                          <mpath href={`#${uid}-${inbound ? "b" : "o"}${i}`} />
                        </animateMotion>
                        <animate attributeName="opacity" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.04;0.56;0.62;1" />
                        <g transform={`scale(${(inbound ? -r.flip : r.flip) * (compact ? 0.8 : 1)} ${compact ? 0.8 : 1})`}><Traveler kind={kind} color={PALETTE[(i + k) % PALETTE.length]} /></g>
                      </g>
                    </g>
                  );
                })}
                {/* glowing parcel of light heading to the category */}
                <circle r={compact ? 2.4 : 3.2} fill="#72B6FF" opacity="0" style={{ filter: "drop-shadow(0 0 5px #1677FF)" }}>
                  <animateMotion dur={`${5 + (i % 3)}s`} begin={`${0.8 + i * 0.6}s`} repeatCount="indefinite" calcMode="linear"><mpath href={`#${uid}-o${i}`} /></animateMotion>
                  <animate attributeName="opacity" dur={`${5 + (i % 3)}s`} begin={`${0.8 + i * 0.6}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.1;0.85;1" />
                </circle>
              </g>
            );
          })}

          {/* the cart that rides from the clicked category to ShopNear */}
          {trip && tripIndex >= 0 && !reduced && (
            <g key={trip.n} opacity="0">
              <animateMotion ref={cartAnim} dur="1.7s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.45 0 0.3 1">
                <mpath href={`#${uid}-b${tripIndex}`} />
              </animateMotion>
              <animate ref={cartFade} attributeName="opacity" dur="1.7s" begin="indefinite" fill="freeze" values="0;1;1;1;0" keyTimes="0;0.08;0.5;0.92;1" />
              <g transform={`scale(${geo.routes[tripIndex].flip * -1 * (compact ? 1.1 : 1.45)} ${compact ? 1.1 : 1.45})`}><CartRider color={categories[tripIndex].accent ?? "#1677FF"} /></g>
            </g>
          )}
        </svg>

        {/* hub */}
        <div key={pulse} className={clsx("absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2", compact ? "w-[44%]" : "w-[22%]", pulse > 0 && "sn-hub-pulse")}>
          <div className="sn-float relative aspect-square">
            <span aria-hidden className="absolute -inset-[12%] rounded-full bg-electric/25 blur-2xl" />
            <span aria-hidden className="absolute -inset-[7%] rounded-full bg-gradient-to-b from-[#8ec3ff] to-electric/70 shadow-[0_18px_40px_-12px_rgba(22,119,255,.55)]" />
            <span aria-hidden className="absolute -inset-[2%] rounded-full bg-gradient-to-b from-white to-[#dcebff] ring-2 ring-white/80" />
            <div className="absolute inset-[6%] flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-white to-[#f1f7ff] text-center shadow-inner">
              <Image src="/brand/mark-512.png" alt="" width={96} height={96} className={clsx("object-contain", compact ? "size-9" : "size-[34%]")} />
              <span className={clsx("font-display font-bold leading-none text-ink", compact ? "mt-0.5 text-[0.95rem]" : "mt-1 text-[clamp(1rem,2.1vw,1.7rem)]")}>ShopNear</span>
              <span className={clsx("rounded-full bg-electric/10 font-bold uppercase tracking-[0.18em] text-electric", compact ? "mt-1 px-2 py-0.5 text-[0.5rem]" : "mt-1.5 px-3 py-1 text-[clamp(0.5rem,0.85vw,0.7rem)]")}>Categories</span>
            </div>
          </div>
        </div>

        {/* category nodes */}
        {categories.map((c, i) => {
          const r = geo.routes[i];
          const on = focus === c.slug;
          const dim = focus !== null && !on;
          const pic = c.cover ?? c.image_url;
          const accent = c.accent ?? "#1677FF";
          return (
            <div key={c.slug} className={clsx("pop-in absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500", compact ? "w-[31%]" : "w-[17%]", dim && "opacity-45")}
              style={{ left: `${f((r.x / geo.W) * 100)}%`, top: `${f((r.y / geo.H) * 100)}%`, ["--d" as string]: `${300 + i * 90}ms` }}>
              <button type="button" onClick={() => choose(c.slug)} onPointerEnter={() => setHover(c.slug)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(c.slug)} onBlur={() => setHover(null)}
                aria-pressed={selected === c.slug} aria-label={`${c.name}, ${c.product_count} products. Show products`}
                className={clsx("sn-float group relative flex w-full flex-col items-center outline-none transition-transform duration-300 ease-[var(--ease-snap)]", on ? "-translate-y-1.5 scale-105" : "hover:-translate-y-1.5 hover:scale-105", "focus-visible:-translate-y-1.5")}
                style={{ ["--fd" as string]: `${i * -0.7}s` }}>
                <span aria-hidden className="absolute inset-x-[4%] bottom-[-6%] top-[40%] rounded-[50%] bg-electric/15 blur-[2px] ring-1 ring-electric/15" />
                <span className={clsx("relative z-10 -mb-[18%] block overflow-hidden rounded-2xl bg-white shadow-[0_14px_28px_-12px_rgba(22,119,255,.5)] ring-2 transition", "aspect-square w-[52%]", on ? "ring-electric" : "ring-white")} style={{ background: `${accent}22` }}>
                  {pic ? <Image src={pic} alt="" fill sizes="(min-width:768px) 9vw, 16vw" className="object-cover" /> : <ShoppingBag className="absolute inset-0 m-auto size-1/2" style={{ color: accent }} />}
                </span>
                <span className={clsx("relative z-20 flex w-full items-center justify-between gap-1 rounded-full bg-white shadow-[0_12px_26px_-10px_rgba(22,119,255,.45)] ring-1 transition group-focus-visible:ring-2 group-focus-visible:ring-electric", compact ? "px-2 pb-1.5 pt-[0.9rem]" : "px-3.5 pb-2 pt-[1.35rem]", on ? "ring-electric" : "ring-electric/10")}>
                  <span className={clsx("truncate font-bold text-ink", compact ? "text-[0.7rem]" : "text-[clamp(0.8rem,1.15vw,1rem)]")}>{c.name}</span>
                  <span className={clsx("grid shrink-0 place-items-center rounded-full bg-electric text-white transition-transform duration-300 group-hover:rotate-45", compact ? "size-4" : "size-6")}><ArrowUpRight className={compact ? "size-2.5" : "size-3.5"} /></span>
                </span>
                <span className={clsx("pointer-events-none absolute -bottom-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[0.7rem] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100", !compact && "sm:block")}>Explore category</span>
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
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: "spring", stiffness: 220, damping: 28, }}
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

/* ───────── tiny SVG travellers. Drawn facing right, feet/wheels on y = 0. ───────── */

function Traveler({ kind, color }: { kind: Kind; color: string }) {
  if (kind === "walker") return <Walker color={color} />;
  if (kind === "cyclist") return <Cyclist color={color} />;
  if (kind === "bike") return <Bike color={color} />;
  return <Van color={color} />;
}

function Walker({ color }: { color: string }) {
  return (
    <g transform="translate(0 -2)">
      <g className="sn-bob">
        <rect x="-1.7" y="-9" width="3.4" height="9.5" rx="1.7" fill="#10264A" className="sn-leg-a" />
        <rect x="-1.7" y="-9" width="3.4" height="9.5" rx="1.7" fill="#2b4a82" className="sn-leg-b" />
        <rect x="-4.2" y="-20" width="8.4" height="12.5" rx="4" fill={color} />
        <circle cx="0.4" cy="-24.2" r="4" fill="#f3c9a0" />
        <path d="M-3.6 -25.5a4 4 0 0 1 8 -0.8v1.4h-8z" fill="#10264A" />
        <rect x="3.4" y="-14" width="6" height="7" rx="1.2" fill="#FF9F43" />
        <path d="M4.6 -14v-2.4a1.8 1.8 0 0 1 3.6 0V-14" fill="none" stroke="#10264A" strokeWidth=".9" />
      </g>
    </g>
  );
}

function Cyclist({ color }: { color: string }) {
  return (
    <g className="sn-bob">
      <circle cx="-10" cy="-6.5" r="6.5" fill="none" stroke="#10264A" strokeWidth="1.7" />
      <circle cx="10" cy="-6.5" r="6.5" fill="none" stroke="#10264A" strokeWidth="1.7" />
      <path d="M-10 -6.5 L-2 -6.5 L3 -15 L8.5 -15 M-2 -6.5 L-5 -15 M10 -6.5 L7.5 -15.5" fill="none" stroke="#1677FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="-6.5" y="-27" width="7.5" height="12" rx="3.5" fill={color} transform="rotate(14 -3 -21)" />
      <path d="M-1 -17 L4 -11 L1 -6.5" fill="none" stroke="#10264A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="1.6" cy="-30" r="3.8" fill="#f3c9a0" />
      <path d="M-2 -31.2a3.9 3.9 0 0 1 7.6 -0.6v1.3h-7.6z" fill="#10264A" />
    </g>
  );
}

function Bike({ color }: { color: string }) {
  return (
    <g className="sn-bob">
      <circle cx="-12" cy="-6" r="6" fill="#10264A" /><circle cx="-12" cy="-6" r="2.4" fill="#cfe0fb" />
      <circle cx="12" cy="-6" r="6" fill="#10264A" /><circle cx="12" cy="-6" r="2.4" fill="#cfe0fb" />
      <path d="M-13 -8 H4 L10 -16 L14 -16 L11 -8 Z" fill={color} />
      <rect x="-9" y="-13" width="12" height="4" rx="2" fill="#10264A" />
      <rect x="-5" y="-27" width="8.5" height="13" rx="4" fill="#10264A" transform="rotate(10 -1 -20)" />
      <path d="M2 -21 L9 -17" stroke="#10264A" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="0.5" cy="-30.5" r="4" fill="#f3c9a0" />
      <path d="M-3.6 -30.6a4.2 4.2 0 0 1 8.2 0v1.2h-8.2z" fill="#FF9F43" />
    </g>
  );
}

function Van({ color }: { color: string }) {
  return (
    <g className="sn-bob">
      <rect x="-19" y="-21" width="24" height="16" rx="3" fill={color} />
      <path d="M5 -21 H12 L19 -13 V-5 H5 Z" fill="#fff" stroke="#10264A" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7.5 -18.5 H11.5 L15.5 -13.5 H7.5 Z" fill="#9fd0ff" />
      <rect x="-15" y="-16" width="10" height="2.2" rx="1.1" fill="#fff" opacity=".85" />
      <rect x="-15" y="-11.5" width="6" height="2.2" rx="1.1" fill="#fff" opacity=".6" />
      <circle cx="-10" cy="-4.5" r="4.5" fill="#10264A" /><circle cx="-10" cy="-4.5" r="1.7" fill="#cfe0fb" />
      <circle cx="11" cy="-4.5" r="4.5" fill="#10264A" /><circle cx="11" cy="-4.5" r="1.7" fill="#cfe0fb" />
    </g>
  );
}

/** The delivery cart that rushes back to the hub when a category is picked. */
function CartRider({ color }: { color: string }) {
  return (
    <g className="sn-bob">
      <path d="M-26 -18 h9 M-30 -12 h13 M-26 -6 h9" stroke="#72B6FF" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      <rect x="-12" y="-27" width="9" height="8" rx="1.5" fill="#FF9F43" />
      <rect x="-1" y="-30" width="8" height="11" rx="1.5" fill={color} />
      <path d="M-15 -34 h5 l3 22 h19 l3.5 -15 h-24" fill="none" stroke="#10264A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="-3" cy="-6" r="3.2" fill="#10264A" /><circle cx="14" cy="-6" r="3.2" fill="#10264A" />
    </g>
  );
}
