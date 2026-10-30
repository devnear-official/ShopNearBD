"use client";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import clsx from "clsx";
import type { ProductCard as P } from "@/lib/catalog";
import { ProductCard } from "@/components/products/product-card";
import { ButtonLink } from "@/components/ui/button";

export function ProductTabs({ tabs }: { tabs: { key: string; label: string; href: string; items: P[] }[] }) {
  const [active, setActive] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === active)!;
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div role="tablist" aria-label="Product lists" className="inline-flex rounded-full bg-white p-1.5 shadow-[var(--shadow-card)]">
          {tabs.map((t) => (
            <button key={t.key} role="tab" type="button" id={`tab-${t.key}`} aria-selected={t.key === active} aria-controls={`panel-${t.key}`} onClick={() => setActive(t.key)}
              className={clsx("relative h-11 rounded-full px-5 text-sm font-semibold transition-colors", t.key === active ? "text-white" : "text-ink-2 hover:text-ink")}>
              {t.key === active && <m.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <ButtonLink href={tab.href} variant="ghost" size="sm">View all</ButtonLink>
      </div>
      <AnimatePresence mode="wait">
        <m.div key={tab.key} role="tabpanel" id={`panel-${tab.key}`} aria-labelledby={`tab-${tab.key}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
          className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
          {tab.items.map((p, i) => <ProductCard key={p.id} product={p} className={i % 4 === 1 ? "xl:translate-y-10" : i % 4 === 3 ? "xl:translate-y-5" : ""} />)}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
