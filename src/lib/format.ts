const taka = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ৳1,23,450 — South Asian digit grouping, no decimals (BDT is priced in whole taka). */
export function formatTaka(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "৳—";
  return `৳${taka.format(Math.round(n))}`;
}

export function percentOff(price: number, sale: number | null | undefined): number | null {
  if (!sale || sale >= price || price <= 0) return null;
  return Math.round(((price - sale) / price) * 100);
}

const dhaka = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });
const dhakaTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const formatDate = (d: string | Date) => dhaka.format(new Date(d));
export const formatDateTime = (d: string | Date) => dhakaTime.format(new Date(d));

export function maskPhone(p: string) {
  return p.length >= 6 ? `${p.slice(0, 3)}*****${p.slice(-3)}` : p;
}
