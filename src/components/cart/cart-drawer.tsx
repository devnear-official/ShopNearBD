"use client";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { cart, cartCount, cartSubtotal, useCart } from "./cart-store";
import { useDialog } from "@/hooks/use-dialog";
import { formatTaka } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Streaks } from "@/components/ui/streaks";

export function CartDrawer({ freeShippingThreshold }: { freeShippingThreshold: number | null }) {
  const state = useCart();
  const ref = useDialog<HTMLDivElement>(state.open, cart.close);
  const subtotal = cartSubtotal(state);
  const count = cartCount(state);
  const remaining = freeShippingThreshold ? Math.max(0, freeShippingThreshold - subtotal) : null;

  return (
    <AnimatePresence>
      {state.open && (
        <m.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" tabIndex={-1} aria-label="Close cart" onClick={cart.close} className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" />
          <m.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper shadow-2xl sm:rounded-l-[2rem]"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h2 id="cart-title" className="display t-sub">Your bag <span className="text-mist">({count})</span></h2>
              <button type="button" onClick={cart.close} className="grid size-11 place-items-center rounded-full bg-white shadow-[var(--shadow-card)]" aria-label="Close cart">
                <X className="size-5" />
              </button>
            </div>

            {remaining !== null && count > 0 && (
              <div className="mx-5 mb-2 rounded-2xl bg-white p-3 text-sm shadow-[var(--shadow-card)]">
                <p className="font-medium">{remaining > 0 ? <>Add <b>{formatTaka(remaining)}</b> more for free delivery</> : <>🎉 You&apos;ve unlocked <b>free delivery</b></>}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cloud">
                  <div className="h-full rounded-full bg-gradient-to-r from-electric to-sky transition-[width] duration-500" style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold!) * 100)}%` }} />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {state.items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Streaks className="mb-6 h-10 w-20" />
                  <p className="display t-card">Your bag is empty</p>
                  <p className="mt-2 max-w-xs text-slate">Find something you like — it&apos;s closer than you think.</p>
                  <ButtonLink href="/shop" onClick={cart.close} className="mt-6">Start shopping</ButtonLink>
                </div>
              ) : (
                <ul className="space-y-3">
                  {state.items.map((i) => (
                    <m.li layout key={i.variantId} className="flex gap-3 rounded-3xl bg-white p-3 shadow-[var(--shadow-card)]">
                      <Link href={`/shop/${i.slug}`} onClick={cart.close} className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-cloud">
                        {i.image && <Image src={i.image} alt="" fill sizes="80px" className="object-cover" />}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <Link href={`/shop/${i.slug}`} onClick={cart.close} className="line-clamp-2 font-semibold leading-snug">{i.name}</Link>
                            {i.variantName !== "Default" && <p className="text-sm text-slate">{i.variantName}</p>}
                          </div>
                          <button type="button" onClick={() => cart.remove(i.variantId)} className="grid size-9 place-items-center rounded-full text-mist hover:bg-cloud hover:text-flame" aria-label={`Remove ${i.name}`}>
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <Stepper value={i.quantity} max={Math.min(20, i.maxStock)} onChange={(q) => cart.setQuantity(i.variantId, q)} label={i.name} />
                          <span className="font-display font-bold tabular-nums">{formatTaka(i.unitPrice * i.quantity)}</span>
                        </div>
                      </div>
                    </m.li>
                  ))}
                </ul>
              )}
            </div>

            {state.items.length > 0 && (
              <div className="pb-safe border-t border-line bg-white px-5 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-slate">Subtotal</span>
                  <span className="font-display text-2xl font-bold tabular-nums">{formatTaka(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-slate">Delivery and any coupon are calculated at checkout. Prices are confirmed on the next step.</p>
                <ButtonLink href="/checkout" onClick={cart.close} size="lg" className="mt-4 w-full">
                  <ShoppingBag className="size-5" /> Checkout
                </ButtonLink>
              </div>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex h-10 items-center rounded-full bg-paper ring-1 ring-line" role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} className="grid size-10 place-items-center rounded-full disabled:opacity-30" aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <span className="w-7 text-center text-sm font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className="grid size-10 place-items-center rounded-full disabled:opacity-30" aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
