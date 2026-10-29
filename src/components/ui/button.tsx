import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "dark" | "ghost" | "light" | "tangerine" | "danger";
type Size = "sm" | "md" | "lg";

const base = "group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-full font-semibold transition-[transform,background-color,box-shadow,color] duration-200 ease-[var(--ease-snap)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-electric text-white shadow-[var(--shadow-lift)] hover:bg-electric-deep",
  dark: "bg-ink text-white hover:bg-ink-2",
  ghost: "bg-transparent text-ink ring-1 ring-inset ring-line hover:bg-cloud",
  light: "bg-white text-ink shadow-[var(--shadow-card)] hover:bg-cloud",
  tangerine: "bg-tangerine text-ink hover:bg-sun",
  danger: "bg-flame text-white hover:bg-[#e0391c]",
};
const sizes: Record<Size, string> = { sm: "h-10 px-4 text-sm", md: "h-12 px-6 text-[0.95rem]", lg: "h-14 px-8 text-base" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

/** Streaks that slide in on hover — echoing the logo's motion lines. */
function Rush() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex w-8 -translate-x-10 flex-col justify-center gap-1 opacity-0 transition-all duration-300 group-hover/btn:translate-x-0 group-hover/btn:opacity-60">
      <span className="h-0.5 w-5 rounded bg-current" />
      <span className="h-0.5 w-3 rounded bg-current" />
    </span>
  );
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      <Rush />
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, children, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      <Rush />
      {children}
    </Link>
  );
}
