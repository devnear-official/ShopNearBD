"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "sn-storage";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Write to localStorage and notify every useStoredValue subscriber in this tab. */
export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/**
 * Hydration-safe localStorage value: renders `fallback` on the server and
 * during hydration, then the stored value — without setState-in-effect.
 */
export function useStoredValue<T>(key: string, parse: (raw: string | null) => T, fallback: T): [T, (raw: string | null) => void, boolean] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => undefined as unknown as string | null);
  const hydrated = raw !== undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- parse is expected to be a stable module-level function
  const value = useMemo(() => (hydrated ? parse(raw) : fallback), [raw, hydrated]);
  const set = useCallback((v: string | null) => writeStored(key, v), [key]);
  return [value, set, hydrated];
}

export const parseJsonArray = <T,>(raw: string | null): T[] => {
  try { const v = JSON.parse(raw ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};
