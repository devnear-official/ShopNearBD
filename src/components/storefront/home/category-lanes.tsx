"use client";
import Image from "next/image";
import { IntentLink } from "@/components/ui/intent-link";
import { ArrowUpRight, Gem, Headphones, LayoutGrid, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Watch } from "lucide-react";
import clsx from "clsx";
import type { Category } from "@/lib/catalog";

const ICONS: [RegExp, typeof Watch][] = [
  [/wear|watch/i, Watch], [/audio|head|earb|sound/i, Headphones], [/fashion|cloth|shirt|bag/i, Shirt],
  [/home|living|kitchen|furni/i, Sofa], [/beauty|care|skin/i, Sparkles], [/phone|mobile|gadget|electr/i, Smartphone], [/access|jewel/i, Gem],
];
const iconFor = (name: string) => ICONS.find(([re]) => re.test(name))?.[1] ?? ShoppingBag;

/** Darkens a hex colour so each card gets a two-tone gradient from the category's accent. */
function shade(hex: string, amt: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  return `rgb(${ch(n >> 16)} ${ch((n >> 8) & 255)} ${ch(n & 255)})`;
}

/**
 * Category bento: bold gradient tiles, the first one large. Each tile shows a product photo
 * that lifts on hover, a count pill and an arrow that slides. Same layout on phones (2 columns).
 */
export function CategoryLanes({ categories }: { categories: Category[] }) {
  return (
    <ul className="grid auto-rows-[11.5rem] grid-cols-2 gap-3 sm:auto-rows-[14rem] sm:gap-4 lg:grid-cols-4">
      {categories.map((c, i) => {
        const accent = c.accent ?? "#1E6BFF";
        const Icon = iconFor(c.name);
        const big = i === 0;
        return (
          <li key={c.slug} className={clsx("pop-in", big && "col-span-2 row-span-2")} style={{ ["--d" as string]: `${i * 70}ms` }}>
            <IntentLink href={`/shop?category=${c.slug}`} className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[1.75rem] p-4 text-white shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-float)] sm:rounded-[2.25rem] sm:p-6"
              style={{ background: `linear-gradient(150deg, ${accent} 0%, ${shade(accent, 0.38)} 100%)` }}>
              {/* decorative rings and glow */}
              <span aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full border-[18px] border-white/10 transition-transform duration-700 group-hover:scale-125 sm:size-56" />
              <span aria-hidden className="absolute -bottom-16 -left-10 size-48 rounded-full bg-white/10 blur-2xl" />
              <Icon aria-hidden className="absolute right-4 top-4 size-16 text-white/15 sm:size-24" strokeWidth={1.2} />

              {c.cover && (
                <span className={clsx("absolute bottom-0 right-0 block overflow-hidden rounded-tl-[2.5rem] bg-white/15 shadow-[-0.5rem_-0.5rem_2rem_rgb(0_0_0/0.15)] transition-transform duration-700 ease-[var(--ease-snap)] group-hover:-translate-x-1 group-hover:-translate-y-2 group-hover:scale-105", big ? "size-[56%]" : "size-[42%]")}>
                  <Image src={c.cover} alt="" fill sizes={big ? "(min-width:1024px) 22vw, 60vw" : "(min-width:1024px) 14vw, 28vw"} className="object-cover" />
                </span>
              )}

              <span className="relative flex items-center justify-between">
                <span className="font-display text-sm font-bold tabular-nums text-white/70 sm:text-base">{String(i + 1).padStart(2, "0")}</span>
              </span>
              <span className={clsx("relative", big ? "max-w-[44%]" : "max-w-[62%] sm:max-w-[60%]")}>
                <span className={clsx("block font-display font-bold leading-[1.05] drop-shadow-sm", big ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl")}>{c.name}</span>
                {c.name_bn && <span className="bn mt-0.5 block text-sm font-semibold text-white/85 sm:text-base" lang="bn">{c.name_bn}</span>}
                {big && c.description && <span className="mt-3 hidden max-w-xs text-sm text-white/80 sm:block">{c.description}</span>}
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-3 pr-1 text-xs font-bold text-ink sm:text-sm">
                  <span className="whitespace-nowrap">{c.product_count} item{c.product_count === 1 ? "" : "s"}</span>
                  <span className="grid size-6 place-items-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:rotate-45"><ArrowUpRight className="size-3.5" /></span>
                </span>
              </span>
            </IntentLink>
          </li>
        );
      })}
      <li className="pop-in" style={{ ["--d" as string]: `${categories.length * 70}ms` }}>
        <IntentLink href="/shop" className="group flex h-full flex-col items-center justify-center gap-3 rounded-[1.75rem] border-2 border-dashed border-electric/30 bg-white/60 p-4 text-center transition hover:border-electric hover:bg-white sm:rounded-[2.25rem]">
          <span className="grid size-14 place-items-center rounded-full bg-electric text-white transition-transform duration-300 group-hover:scale-110"><LayoutGrid className="size-6" /></span>
          <span className="font-display text-lg font-bold">Browse everything</span>
          <span className="text-sm text-slate">See the full shop →</span>
        </IntentLink>
      </li>
    </ul>
  );
}
