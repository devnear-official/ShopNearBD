import "server-only";
import type { Tx } from "./db";

export type OrderFilters = { q?: string; status?: string; payment?: string; method?: string; from?: string; to?: string; page: number };
const STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"];
const PAYS = ["unpaid", "pending_verification", "paid", "failed", "refunded", "partially_refunded"];
const METHODS = ["cod", "bkash_manual", "nagad_manual"];

export function parseOrderFilters(sp: Record<string, string | undefined>): OrderFilters {
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    q: sp.q?.trim().slice(0, 60) || undefined,
    status: STATUSES.includes(sp.status ?? "") ? sp.status : undefined,
    payment: PAYS.includes(sp.payment ?? "") ? sp.payment : undefined,
    method: METHODS.includes(sp.method ?? "") ? sp.method : undefined,
    from: date(sp.from),
    to: date(sp.to),
    page: Math.max(1, Math.min(Number(sp.page) || 1, 1000)),
  };
}

export function orderWhere(tx: Tx, f: OrderFilters) {
  const q = f.q;
  const digits = q?.replace(/\D/g, "");
  return tx`where true
    ${q ? tx`and (o.order_number ilike ${"%" + q + "%"} or o.customer_name ilike ${"%" + q + "%"} ${digits && digits.length >= 4 ? tx`or o.phone like ${"%" + digits.replace(/^880/, "0") + "%"}` : tx``})` : tx``}
    ${f.status ? tx`and o.status = ${f.status}` : tx``}
    ${f.payment ? tx`and o.payment_status = ${f.payment}` : tx``}
    ${f.method ? tx`and o.payment_method = ${f.method}` : tx``}
    ${f.from ? tx`and o.created_at >= (${f.from}::date at time zone 'Asia/Dhaka')` : tx``}
    ${f.to ? tx`and o.created_at < ((${f.to}::date + 1) at time zone 'Asia/Dhaka')` : tx``}`;
}

export function filterQuery(f: OrderFilters, patch: Partial<OrderFilters> = {}) {
  const v = { ...f, ...patch };
  const p = new URLSearchParams();
  for (const k of ["q", "status", "payment", "method", "from", "to"] as const) if (v[k]) p.set(k, String(v[k]));
  if (v.page > 1) p.set("page", String(v.page));
  return p.toString();
}
