"use client";
import { m } from "motion/react";
import type { ReactNode } from "react";

/** Fades/slides content in once when it enters the viewport (IntersectionObserver via motion). */
export function Reveal({ children, delay = 0, y = 24, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" }) {
  const C = as === "section" ? m.section : as === "li" ? m.li : m.div;
  return (
    <C className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease: [0.2, 0.9, 0.1, 1] }}>
      {children}
    </C>
  );
}
