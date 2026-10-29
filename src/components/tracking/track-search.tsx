"use client";
import { useEffect } from "react";
import { track } from "@/lib/tracking/client";

/** Search event for shop result pages (covers typed, voice and image searches). */
export function TrackSearch({ q, results }: { q: string; results: number }) {
  useEffect(() => {
    track("Search", { search: q, value: undefined });
  }, [q, results]);
  return null;
}
