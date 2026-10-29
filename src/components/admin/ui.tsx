import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-2 inline-block text-sm font-semibold text-slate hover:text-ink">← {back.label}</Link>}
        <h1 className="display text-3xl sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("rounded-3xl bg-white shadow-[var(--shadow-card)]", pad && "p-5", className)}>
      {(title || actions) && (
        <div className={clsx("mb-4 flex items-center justify-between gap-3", !pad && "px-5 pt-5")}>
          {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const tones = {
  gray: "bg-cloud text-ink-2", blue: "bg-electric/10 text-electric-deep", green: "bg-mint/15 text-[#0b7a55]",
  amber: "bg-sun/20 text-[#7a4d05]", red: "bg-flame/10 text-[#a3290f]", violet: "bg-[#7c3aed]/10 text-[#5b21b6]", ink: "bg-ink text-white",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export const ORDER_TONE: Record<string, Tone> = { pending: "amber", confirmed: "blue", packed: "violet", shipped: "blue", delivered: "green", cancelled: "red", returned: "gray" };
export const PAY_TONE: Record<string, Tone> = { unpaid: "gray", pending_verification: "amber", paid: "green", failed: "red", refunded: "gray", partially_refunded: "gray" };
export const PAY_LABEL: Record<string, string> = { unpaid: "Unpaid", pending_verification: "Verify payment", paid: "Paid", failed: "Payment failed", refunded: "Refunded", partially_refunded: "Part refunded" };
export const STATUS_LABEL: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", packed: "Packed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", returned: "Returned" };

export function Stat({ label, value, hint, tone = "ink", href }: { label: string; value: ReactNode; hint?: string; tone?: "ink" | "blue" | "amber" | "green" | "red"; href?: string }) {
  const body = (
    <div className="h-full rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate">{label}</p>
      <p className={clsx("mt-2 font-display text-3xl font-bold tabular-nums", { ink: "text-ink", blue: "text-electric", amber: "text-[#b7791f]", green: "text-mint", red: "text-flame" }[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-paper p-6 text-center text-sm text-slate">{children}</p>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-slate">{head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="rounded-full bg-white px-4 py-2 font-semibold shadow-[var(--shadow-card)]">Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className="rounded-full bg-white px-4 py-2 font-semibold shadow-[var(--shadow-card)]">Next</Link>}
      </div>
    </div>
  );
}
