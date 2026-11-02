"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { BarChart3, Boxes, FolderTree, Gauge, Megaphone, Smartphone, LogOut, Menu, MessageSquare, Package, Settings, ShoppingCart, Tags, Truck, Users, X, ExternalLink } from "lucide-react";
import { adminSignOut } from "@/actions/admin-auth";
import { Logo } from "@/components/ui/logo";

export const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: Tags },
  { href: "/admin/chat", label: "Chat", icon: MessageSquare },
  { href: "/admin/sms", label: "Order SMS", icon: Smartphone },
  { href: "/admin/couriers", label: "Couriers", icon: Truck },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function Links({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <li key={href}>
            <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={clsx("flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition", active ? "bg-white text-ink shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}>
              <Icon className="size-[18px]" /> {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminNav({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const footer = (
    <div className="mt-auto space-y-2 pt-6 text-sm">
      <Link href="/" target="_blank" className="flex items-center gap-2 px-3 text-white/60 hover:text-white"><ExternalLink className="size-4" /> View store</Link>
      {email && <p className="truncate px-3 text-xs text-white/40">{email}</p>}
      <form action={adminSignOut}><button className="flex h-10 w-full items-center gap-2 rounded-2xl px-3 font-semibold text-white/70 hover:bg-white/10 hover:text-white"><LogOut className="size-4" /> Sign out</button></form>
    </div>
  );
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink p-4 lg:flex">
        <Link href="/admin/dashboard" className="mb-6 px-2 pt-2"><Logo tone="dark" className="h-8" /></Link>
        <nav aria-label="Admin"><Links /></nav>
        {footer}
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 lg:hidden">
        <Logo tone="dark" className="h-7" />
        <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center text-white" aria-label="Open admin menu"><Menu /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="flex w-72 flex-col overflow-y-auto bg-ink p-4">
            <div className="mb-4 flex items-center justify-between"><Logo tone="dark" className="h-7" /><button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center text-white" aria-label="Close menu"><X /></button></div>
            <nav aria-label="Admin"><Links onNavigate={() => setOpen(false)} /></nav>
            {footer}
          </div>
          <button type="button" className="flex-1 bg-ink/50" aria-label="Close menu" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
