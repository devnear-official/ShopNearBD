"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, m } from "motion/react";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { cart, cartCount, cartSubtotal, useCart } from "./cart-store";
import { useDialog } from "@/hooks/use-dialog";
import { formatTaka } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Streaks } from "@/components/ui/streaks";
import { CapsuleFill, CapsuleShine, pressOrigin, type PressOrigin } from "@/components/ui/capsule";

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
                <CheckoutLink />
              </div>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Checkout capsule. On press the cart rolls to the right across the word and swallows it one
 * letter at a time (c-h-e-c-k-o-u-t) while the button floods with navy from the tap point; the
 * drawer then slides away onto the checkout page. Modified clicks (new tab) behave like a normal link.
 */
const WORD = "Checkout";
function CheckoutLink() {
  const router = useRouter();
  const [going, setGoing] = useState(false);
  const [origin, setOrigin] = useState<PressOrigin>(null);
  const cartRef = useRef<HTMLSpanElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  useEffect(() => { router.prefetch("/checkout"); }, [router]);

  const eat = () => {
    const cartEl = cartRef.current;
    const letters = Array.from(wordRef.current?.querySelectorAll<HTMLElement>("[data-l]") ?? []);
    if (!cartEl || !letters.length) return 0;
    const c = cartEl.getBoundingClientRect();
    const last = letters[letters.length - 1].getBoundingClientRect();
    const startX = c.left + c.width / 2;
    const travel = last.right + 6 - startX - c.width / 2;
    const duration = 260 + letters.length * 95;
    cartEl.animate(
      [
        { transform: "translate(0,0) rotate(0deg)" },
        { transform: `translate(${travel * 0.5}px,-2px) rotate(-5deg)`, offset: 0.5 },
        { transform: `translate(${travel}px,0) rotate(0deg) scale(1)`, offset: 0.92 },
        { transform: `translate(${travel}px,0) rotate(0deg) scale(1.25)` },
      ],
      { duration, easing: "cubic-bezier(0.4, 0, 0.3, 1)", fill: "forwards" },
    );
    for (const l of letters) {
      const r = l.getBoundingClientRect();
      const at = Math.min(1, Math.max(0, (r.left + r.width / 2 - startX) / (travel + c.width / 2)));
      l.animate(
        [{ transform: "none", opacity: 1 }, { transform: "translate(-0.6em,-0.15em) scale(0.2)", opacity: 0 }],
        { duration: 190, delay: Math.max(0, at * duration - 120), easing: "ease-in", fill: "forwards" },
      );
    }
    return duration;
  };

  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (going) return;
    router.push("/checkout");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return cart.close();
    setOrigin(pressOrigin(e));
    setGoing(true);
    const d = eat();
    setTimeout(cart.close, d + 260);
  };

  return (
    <Link
      href="/checkout"
      onClick={go}
      aria-busy={going}
      className="group/cap relative mt-4 flex h-14 w-full select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-electric to-electric-deep text-base font-semibold text-white shadow-[var(--shadow-lift)] transition-transform duration-200 active:scale-[0.97]"
    >
      <CapsuleFill on={going} origin={origin} />
      <CapsuleShine />
      <span className="relative flex items-center gap-2">
        <span ref={cartRef} aria-hidden className={clsx("grid place-items-center transition-colors duration-500", going && "text-tangerine")}>
          <ShoppingCart className="size-5" />
        </span>
        <span className="sr-only">Checkout</span>
        <span ref={wordRef} aria-hidden className="inline-flex">
          {WORD.split("").map((ch, i) => <span key={i} data-l className="inline-block">{ch}</span>)}
        </span>
      </span>
    </Link>
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
