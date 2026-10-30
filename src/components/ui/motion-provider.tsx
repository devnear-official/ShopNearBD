"use client";
import { LazyMotion, MotionConfig } from "motion/react";

// The animation features load after the page is interactive, not inside the first-load bundle.
const loadFeatures = () => import("./motion-features").then((m) => m.default);

/** Loads the DOM animation feature set on demand and honours prefers-reduced-motion everywhere. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
