"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, PackageSearch, ShoppingBag, ShoppingCart, UserRound } from "lucide-react";
import clsx from "clsx";
import { cart, cartCount, useCart } from "@/components/cart/cart-store";

/**
 * Mobile-first bottom navigation bar that gives the web store a native app feel.
 * Docked at the bottom on mobile/tablet viewports (< lg) and hidden on desktop.
 */
export function BottomNav() {
  const pathname = usePathname();
  const state = useCart();
  const count = cartCount(state);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const on = () => {
      setBump(false);
      requestAnimationFrame(() => setBump(true));
    };
    window.addEventListener("sn:cart-bump", on);
    return () => window.removeEventListener("sn:cart-bump", on);
  }, []);

  // Update mobile offset so floating chat and WhatsApp widgets don't overlap the bottom bar
  useEffect(() => {
    if (pathname.startsWith("/checkout")) {
      document.documentElement.style.setProperty("--bottom-nav-offset", "0px");
    } else {
      document.documentElement.style.setProperty("--bottom-nav-offset", "4.25rem");
    }
    return () => {
      document.documentElement.style.setProperty("--bottom-nav-offset", "0px");
    };
  }, [pathname]);

  // Keep checkout distraction-free
  if (pathname.startsWith("/checkout")) return null;

  const isHome = pathname === "/";
  const isShop = pathname.startsWith("/shop") || pathname.startsWith("/category");
  const isTrack = pathname.startsWith("/order");
  const isAccount = pathname.startsWith("/account");

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl shadow-[0_-8px_30px_rgba(11,21,48,0.08)] lg:hidden"
    >
      <div className="mx-auto grid h-14 max-w-md grid-cols-5 items-center px-1">
        {/* Home */}
        <Link
          href="/"
          className={clsx(
            "group relative flex flex-col items-center justify-center py-1 transition-all active:scale-90",
            isHome ? "text-electric" : "text-slate hover:text-ink",
          )}
        >
          <Home className="size-5 transition-transform group-hover:scale-105" />
          <span className={clsx("mt-1 text-[11px] tracking-tight", isHome ? "font-bold text-electric" : "font-medium")}>
            Home
          </span>
          {isHome && <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-electric" />}
        </Link>

        {/* Shop */}
        <Link
          href="/shop"
          className={clsx(
            "group relative flex flex-col items-center justify-center py-1 transition-all active:scale-90",
            isShop ? "text-electric" : "text-slate hover:text-ink",
          )}
        >
          <ShoppingBag className="size-5 transition-transform group-hover:scale-105" />
          <span className={clsx("mt-1 text-[11px] tracking-tight", isShop ? "font-bold text-electric" : "font-medium")}>
            Shop
          </span>
          {isShop && <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-electric" />}
        </Link>

        {/* Cart Trigger */}
        <button
          type="button"
          data-cart-target
          onClick={() => cart.open()}
          aria-label={`Cart with ${count} items`}
          className={clsx(
            "group relative flex flex-col items-center justify-center py-1 transition-all active:scale-90",
            state.open ? "text-electric" : "text-slate hover:text-ink",
          )}
        >
          <span className="relative">
            <ShoppingCart className={clsx("size-5 transition-transform duration-200 group-hover:scale-105", bump && "scale-125 text-electric")} />
            {count > 0 && (
              <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-tangerine px-1 text-[10px] font-bold text-ink shadow-[0_2px_6px_rgba(255,122,26,0.4)]">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </span>
          <span className={clsx("mt-1 text-[11px] tracking-tight", state.open ? "font-bold text-electric" : "font-medium")}>
            Cart
          </span>
          {state.open && <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-electric" />}
        </button>

        {/* Track Order */}
        <Link
          href="/order"
          className={clsx(
            "group relative flex flex-col items-center justify-center py-1 transition-all active:scale-90",
            isTrack ? "text-electric" : "text-slate hover:text-ink",
          )}
        >
          <PackageSearch className="size-5 transition-transform group-hover:scale-105" />
          <span className={clsx("mt-1 text-[11px] tracking-tight", isTrack ? "font-bold text-electric" : "font-medium")}>
            Track
          </span>
          {isTrack && <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-electric" />}
        </Link>

        {/* Account */}
        <Link
          href="/account"
          className={clsx(
            "group relative flex flex-col items-center justify-center py-1 transition-all active:scale-90",
            isAccount ? "text-electric" : "text-slate hover:text-ink",
          )}
        >
          <UserRound className="size-5 transition-transform group-hover:scale-105" />
          <span className={clsx("mt-1 text-[11px] tracking-tight", isAccount ? "font-bold text-electric" : "font-medium")}>
            Account
          </span>
          {isAccount && <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-electric" />}
        </Link>
      </div>
    </nav>
  );
}
