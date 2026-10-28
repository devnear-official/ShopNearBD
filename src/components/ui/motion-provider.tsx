"use client";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/** Loads only the DOM animation feature set and honours prefers-reduced-motion everywhere. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
