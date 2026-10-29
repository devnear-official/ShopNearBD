"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUpRight, Heart, Menu, PackageSearch, Search, ShoppingCart, UserRound, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/ui/logo";
import { Streaks } from "@/components/ui/streaks";
import { cart, cartCount, useCart } from "@/components/cart/cart-store";
import { useDialog } from "@/hooks/use-dialog";
import dynamic from "next/dynamic";

// Search (with voice and photo search) loads when first opened, or when the browser is idle.
const SearchOverlay = dynamic(() => import("./search-overlay").then((m) => m.SearchOverlay), { ssr: false });

type Cat = { slug: string; name: string; name_bn: string | null; accent: string | null };

export function Header({ categories }: { categories: Cat[] }) {
  const state = useCart();
  const count = cartCount(state);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<"text" | "voice" | "image">("text");
  const [searchFile, setSearchFile] = useState<File | null>(null);
  const [searchLoaded, setSearchLoaded] = useState(false);
  // The cart button bumps when a product lands in it (see lib/fly-to-cart).
  const [bump, setBump] = useState(false);
  useEffect(() => {
    const on = () => { setBump(false); requestAnimationFrame(() => setBump(true)); };
    window.addEventListener("sn:cart-bump", on);
    return () => window.removeEventListener("sn:cart-bump", on);
  }, []);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const t = w.requestIdleCallback ? w.requestIdleCallback(() => void import("./search-overlay"), { timeout: 6000 }) : window.setTimeout(() => void import("./search-overlay"), 4000);
    return () => { if (!w.requestIdleCallback) clearTimeout(t); };
  }, []);
  if (search && !searchLoaded) setSearchLoaded(true);
  const [catsOpen, setCatsOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && !(e.target as HTMLElement)?.closest("input,textarea")) {
        e.preventDefault();
        setSearch(true);
      }
    };
    // Other components (e.g. the search bar on /shop) can open search in voice or photo mode.
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ mode?: "text" | "voice" | "image"; file?: File }>).detail;
      setSearchMode(d?.mode ?? "text");
      setSearchFile(d?.file ?? null);
      setSearch(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("sn:open-search", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("sn:open-search", onOpen); };
  }, []);

  const menuRef = useDialog<HTMLDivElement>(menu, () => setMenu(false));

  return (
    <>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div
          className={clsx(
            "mx-auto flex h-16 max-w-7xl items-center gap-1 rounded-full pl-3 pr-1.5 min-[380px]:gap-2 min-[380px]:pl-4 min-[380px]:pr-2 transition-all duration-300 sm:pl-6",
            scrolled ? "bg-white/85 shadow-[var(--shadow-float)] ring-1 ring-ink/5 backdrop-blur-xl" : "bg-white/60 backdrop-blur-md",
          )}
        >
          <Link href="/" className="mr-1 min-w-0 shrink" aria-label="ShopNear BD home">
            <Logo priority className="h-7 min-[380px]:h-8 sm:h-9" />
          </Link>

          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
            <NavLink href="/shop">Shop all</NavLink>
            <div className="relative" onMouseLeave={() => setCatsOpen(false)}>
              <button
                type="button"
                aria-expanded={catsOpen}
                aria-controls="cat-menu"
                onClick={() => setCatsOpen((v) => !v)}
                onMouseEnter={() => setCatsOpen(true)}
                className="rounded-full px-4 py-2 text-[0.95rem] font-semibold text-ink-2 hover:bg-cloud"
              >
                Categories
              </button>
              <AnimatePresence>
                {catsOpen && (
                  <m.div
                    id="cat-menu"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 top-full w-[34rem] pt-3"
                  >
                    <div className="grid grid-cols-2 gap-1 rounded-3xl bg-white p-3 shadow-[var(--shadow-float)] ring-1 ring-ink/5">
                      {categories.map((c, i) => (
                        <Link key={c.slug} href={`/shop?category=${c.slug}`} onClick={() => setCatsOpen(false)} className="group flex items-center gap-3 rounded-2xl p-3 hover:bg-paper">
                          <span className="grid size-10 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: c.accent ?? "#1E6BFF" }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{c.name}</span>
                            {c.name_bn && <span className="bn block text-sm text-slate" lang="bn">{c.name_bn}</span>}
                          </span>
                          <ArrowUpRight className="ml-auto size-4 text-mist opacity-0 transition group-hover:opacity-100" />
                        </Link>
                      ))}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
            <NavLink href="/shop?collection=commute-kit">Commute Kit</NavLink>
            <NavLink href="/help">Help</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setSearch(true)} className="hidden h-11 items-center gap-2 rounded-full bg-cloud/70 pl-4 pr-3 text-sm text-slate hover:bg-cloud md:flex" aria-label="Search products">
              <Search className="size-4" />
              <span className="w-28 text-left">Search…</span>
              <kbd className="rounded-md bg-white px-1.5 text-xs text-mist">/</kbd>
            </button>
            <IconButton label="Search products" onClick={() => setSearch(true)} className="md:hidden"><Search className="size-5" /></IconButton>
            <Link href="/wishlist" className="hidden size-11 place-items-center rounded-full hover:bg-cloud sm:grid" aria-label="Wishlist" title="Wishlist">
              <Heart className="size-5" />
            </Link>
            <Link href="/order" className="hidden size-11 place-items-center rounded-full hover:bg-cloud sm:grid" aria-label="Track your orders" title="Track your orders">
              <PackageSearch className="size-5" />
            </Link>
            <Link href="/account" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-cloud" aria-label="My account" title="My account">
              <UserRound className="size-5" />
            </Link>
            <button
              type="button"
              onClick={() => cart.open()}
              data-cart-target
              onAnimationEnd={() => setBump(false)}
              className={clsx("relative flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink pl-3 pr-3.5 text-white transition hover:bg-ink-2", bump && "cart-bump")}
              aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            >
              <ShoppingCart className="size-5" />
              <span className="text-sm font-semibold tabular-nums">{count}</span>
              <AnimatePresence>
                {state.lastAdded && count > 0 && (
                  <m.span
                    key={`${state.lastAdded}-${count}`}
                    initial={{ scale: 0.4, opacity: 0.9 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-tangerine"
                  />
                )}
              </AnimatePresence>
            </button>
            <IconButton label="Open menu" onClick={() => setMenu(true)} className="lg:hidden"><Menu className="size-5" /></IconButton>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <m.div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink text-white lg:hidden"
          >
            <div className="flex h-20 items-center justify-between px-5">
              <Logo tone="dark" className="h-8" />
              <button type="button" onClick={() => setMenu(false)} className="grid size-12 place-items-center rounded-full bg-white/10" aria-label="Close menu">
                <X className="size-6" />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex flex-1 flex-col px-5 pb-8" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setMenu(false); }}>
              {[{ href: "/shop", label: "Shop all", bn: "সব পণ্য" }, ...categories.map((c) => ({ href: `/shop?category=${c.slug}`, label: c.name, bn: c.name_bn ?? "" }))].map((l, i) => (
                <m.div key={l.href} initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.04 * i, duration: 0.3 }}>
                  <Link href={l.href} className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 py-3">
                    <span className="min-w-0 text-lg font-semibold">{l.label}</span>
                    <span className="bn shrink-0 text-sm text-white/50" lang="bn">{l.bn}</span>
                  </Link>
                </m.div>
              ))}
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <Link href="/order" className="rounded-2xl bg-white/10 p-4 font-semibold">Track my order</Link>
                <Link href="/help" className="rounded-2xl bg-white/10 p-4 font-semibold">Help & policies</Link>
                <Link href="/wishlist" className="rounded-2xl bg-white/10 p-4 font-semibold">♡ Wishlist</Link>
                <Link href="/account" className="rounded-2xl bg-electric p-4 font-semibold">My account</Link>
              </div>
              <Streaks tone="light" className="mt-10 h-8 w-16 opacity-60" />
            </nav>
          </m.div>
        )}
      </AnimatePresence>

      {searchLoaded && <SearchOverlay open={search} mode={searchMode} file={searchFile} onClose={() => { setSearch(false); setSearchMode("text"); setSearchFile(null); }} />}
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full px-4 py-2 text-[0.95rem] font-semibold text-ink-2 transition hover:bg-cloud">
      {children}
    </Link>
  );
}

function IconButton({ label, onClick, className, children }: { label: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={clsx("grid size-11 place-items-center rounded-full hover:bg-cloud", className)}>
      {children}
    </button>
  );
}
