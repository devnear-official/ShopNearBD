"use client";
import { useEffect, useState } from "react";

/** Current year, set after hydration so the static shell stays cacheable. */
export function Year({ fallback = 2026 }: { fallback?: number }) {
  const [y, setY] = useState(fallback);
  useEffect(() => setY(new Date().getFullYear()), []);
  return <span>{y}</span>;
}
