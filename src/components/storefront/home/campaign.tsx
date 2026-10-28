"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { m, useScroll, useTransform, useReducedMotion } from "motion/react";
import type { ProductCard } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Streaks } from "@/components/ui/streaks";

/** Editorial collection story: sticky copy, products that drift past at different speeds. */
export function Campaign({ title, body, collection, products }: { title: string; body: string; collection: string; products: ProductCard[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const y2 = useTransform(scrollYProgress, [0, 1], [160, -140]);
  const words = title.split(" ");

  return (
    <section ref={ref} aria-labelledby="campaign-title" className="relative overflow-hidden rounded-[2.5rem] bg-ink px-5 py-16 text-white sm:mx-4 sm:px-10 lg:py-24">
      <div aria-hidden className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-electric/30 blur-[120px]" />
      <div aria-hidden className="absolute -bottom-40 left-10 size-[24rem] rounded-full bg-tangerine/20 blur-[120px]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Streaks tone="tangerine" className="h-6 w-12" />
          <p className="eyebrow mt-6 text-white/50">The edit · {products.length} pieces</p>
          <h2 id="campaign-title" className="display mt-3 text-6xl sm:text-7xl">
            {words.map((w, i) => (
              <m.span key={i} className="mr-3 inline-block" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }}>
                {i === words.length - 1 ? <span className="text-tangerine">{w}</span> : w}
              </m.span>
            ))}
          </h2>
          <p className="mt-6 max-w-md text-lg text-white/70">{body}</p>
          <ButtonLink href={`/shop?collection=${collection}`} variant="tangerine" size="lg" className="mt-8">Shop the edit</ButtonLink>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {products.map((p, i) => (
            <m.div key={p.id} style={reduce ? undefined : { y: i % 2 ? y2 : y1 }} className={i % 2 ? "mt-16" : ""}>
              <Link href={`/shop/${p.slug}`} className="group block">
                <div className="tag-hole relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-ink-2">
                  {p.images[1] ?? p.images[0] ? <Image src={(p.images[1] ?? p.images[0]).url} alt={p.images[0]?.alt || p.name} fill sizes="(min-width:1024px) 22rem, 45vw" className="object-cover transition duration-700 group-hover:scale-105" /> : null}
                  <span className="absolute left-4 top-12 font-display text-5xl font-bold text-white/90">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="font-semibold group-hover:underline">{p.name}</span>
                  <span className="font-display font-bold text-tangerine">{formatTaka(p.min_price)}</span>
                </div>
              </Link>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
