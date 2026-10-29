"use client";
import { useSyncExternalStore } from "react";
import { track } from "@/lib/tracking/client";

/**
 * Guest cart kept in localStorage. Prices stored here are for display only —
 * checkout re-prices every line from the database.
 */
export type CartItem = {
  variantId: string; productId: string; slug: string; name: string; variantName: string; sku?: string; category?: string;
  image: string | null; unitPrice: number; quantity: number; maxStock: number;
};
type State = { items: CartItem[]; open: boolean; lastAdded: string | null; hydrated: boolean };

const KEY = "sn_cart_v1";
let state: State = { items: [], open: false, lastAdded: null, hydrated: false };
const listeners = new Set<() => void>();
const serverState: State = { items: [], open: false, lastAdded: null, hydrated: false };

function emit() {
  for (const l of listeners) l();
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.items));
  } catch {}
}
function hydrate() {
  if (state.hydrated || typeof window === "undefined") return;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(raw)) state = { ...state, items: raw.filter((i) => i && typeof i.variantId === "string" && i.quantity > 0).slice(0, 30) };
  } catch {}
  state = { ...state, hydrated: true };
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = { ...state, hydrated: false };
      hydrate();
      emit();
    }
  });
}

const set = (next: Partial<State>, save = true) => {
  state = { ...state, ...next };
  if (save) persist();
  emit();
};

export const cart = {
  add(item: Omit<CartItem, "quantity">, quantity = 1) {
    hydrate();
    const existing = state.items.find((i) => i.variantId === item.variantId);
    const cap = Math.min(20, Math.max(item.maxStock, 0));
    const items = existing
      ? state.items.map((i) => (i.variantId === item.variantId ? { ...i, ...item, quantity: Math.min(cap, i.quantity + quantity) } : i))
      : [...state.items, { ...item, quantity: Math.min(cap, quantity) }];
    set({ items: items.filter((i) => i.quantity > 0), lastAdded: item.variantId });
    track("AddToCart", { value: item.unitPrice * quantity, items: [{ id: item.sku ?? item.variantId, name: item.name, quantity, price: item.unitPrice, category: item.category }] });
  },
  setQuantity(variantId: string, quantity: number) {
    set({ items: state.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(20, Math.min(i.maxStock || 20, quantity))) } : i)) });
  },
  remove(variantId: string) {
    set({ items: state.items.filter((i) => i.variantId !== variantId) });
  },
  /** Apply server truth (current price / stock) after a quote. */
  reconcile(lines: { variant_id: string; unit_price: number; stock: number }[]) {
    let changed = false;
    const items = state.items.map((i) => {
      const l = lines.find((x) => x.variant_id === i.variantId);
      if (!l || (Number(l.unit_price) === i.unitPrice && l.stock === i.maxStock)) return i;
      changed = true;
      return { ...i, unitPrice: Number(l.unit_price), maxStock: l.stock };
    });
    // Only touch state when the server's numbers differ; otherwise every quote would trigger another quote.
    if (changed) set({ items });
  },
  clear() {
    set({ items: [] });
  },
  open() {
    set({ open: true }, false);
  },
  close() {
    set({ open: false }, false);
  },
};

function subscribe(l: () => void) {
  hydrate();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCart() {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

export const cartCount = (s: State) => s.items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotal = (s: State) => s.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
