"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { m } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import clsx from "clsx";
import type { Category } from "@/lib/catalog";

/**
 * Category "lanes": on desktop, an accordion of tall lanes — the hovered or
 * focused lane widens and reveals its product. On touch screens they become a
 * swipeable row of full cards (nothing hidden behind hover).
 */
export function CategoryLanes({ categories }: { categories: Category[] }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <div className="hidden h-[30rem] gap-3 lg:flex" onMouseLeave={() => setActive(active)}>
        {categories.map((c, i) => {
          const open = i === active;
          return (
            <m.div key={c.slug} layout className={clsx("relative overflow-hidden rounded-[2rem]", open ? "flex-[3.2]" : "flex-1")}
              transition={{ type: "spring", stiffness: 180, damping: 26 }} onMouseEnter={() => setActive(i)}>
              <Link href={`/shop?category=${c.slug}`} onFocus={() => setActive(i)} className="group absolute inset-0 flex flex-col justify-between p-6 text-white" style={{ background: c.accent ?? "#1E6BFF" }}>
                {c.cover && (
                  <Image src={c.cover} alt="" fill sizes="40vw" className={clsx("object-cover transition-all duration-700", open ? "opacity-100 scale-100" : "opacity-0 scale-110")} />
                )}
                <span className={clsx("absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent transition-opacity", open ? "opacity-100" : "opacity-0")} />
                <span className="relative font-display text-5xl font-bold opacity-90">{String(i + 1).padStart(2, "0")}</span>
                <span className="relative">
                  <span className={clsx("block font-display font-bold leading-none transition-all duration-500", open ? "text-4xl" : "text-2xl [writing-mode:vertical-rl] rotate-180 whitespace-nowrap")}>{c.name}</span>
                  {open && (
                    <m.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-end justify-between gap-4">
                      <span className="max-w-xs text-sm text-white/85">
                        {c.name_bn && <span className="bn mb-1 block text-base font-semibold" lang="bn">{c.name_bn}</span>}
                        {c.description}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
                        {c.product_count} products <ArrowUpRight className="size-4" />
                      </span>
                    </m.span>
                  )}
                </span>
              </Link>
            </m.div>
          );
        })}
      </div>

      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:hidden">
        {categories.map((c, i) => (
          <Link key={c.slug} href={`/shop?category=${c.slug}`} className="relative flex aspect-[3/4] w-[68%] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[1.75rem] p-5 text-white sm:w-[40%]" style={{ background: c.accent ?? "#1E6BFF" }}>
            {c.cover && <Image src={c.cover} alt="" fill sizes="70vw" className="object-cover" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/10" />
            <span className="relative font-display text-4xl font-bold">{String(i + 1).padStart(2, "0")}</span>
            <span className="relative">
              <span className="block font-display text-3xl font-bold leading-none">{c.name}</span>
              {c.name_bn && <span className="bn mt-1 block font-semibold text-white/85" lang="bn">{c.name_bn}</span>}
              <span className="mt-2 block text-sm text-white/80">{c.product_count} products →</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
