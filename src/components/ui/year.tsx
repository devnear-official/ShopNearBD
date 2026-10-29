"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Current year on the client; a fixed fallback in the prerendered shell. */
export function Year({ fallback = 2026 }: { fallback?: number }) {
  const y = useSyncExternalStore(noop, () => new Date().getFullYear(), () => fallback);
  return <span>{y}</span>;
}
