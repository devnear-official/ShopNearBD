"use client";
import { useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Fades/slides content in once when it scrolls into view. Content is visible in the
 * server HTML; only blocks that start below the fold are hidden (on mount) and then
 * revealed, so nothing is invisible while JavaScript loads. CSS-only animation.
 */
export function Reveal({ children, delay = 0, y = 24, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as "div";

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    el.style.setProperty("--reveal-y", `${y}px`);
    el.style.transitionDelay = `${delay}s`;
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      el.dataset.reveal = "shown";
      io.disconnect();
    }, { rootMargin: "0px 0px -60px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [delay, y]);

  return <Tag ref={ref as React.RefObject<HTMLDivElement>} className={clsx("reveal", className)}>{children}</Tag>;
}
