import type { ProductQuery } from "./catalog";

export type ShopSearchParams = Record<string, string | string[] | undefined>;
const SORTS = ["newest", "price_asc", "price_desc", "popular", "discount"] as const;

/** Parses /shop query parameters defensively (they are user input). */
export function parseShopParams(sp: ShopSearchParams): Required<Pick<ProductQuery, "page">> & ProductQuery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const num = (k: string) => {
    const v = Number(one(k));
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined;
  };
  const sort = one("sort");
  return {
    q: one("q")?.slice(0, 80) || undefined,
    category: one("category")?.match(/^[a-z0-9-]{1,60}$/)?.[0],
    collection: one("collection")?.match(/^[a-z0-9-]{1,60}$/)?.[0],
    min: num("min"),
    max: num("max"),
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as ProductQuery["sort"]) : undefined,
    inStock: one("stock") === "1" || undefined,
    page: Math.max(1, Math.min(num("page") ?? 1, 500)),
  };
}

export function shopHref(base: ProductQuery, patch: Partial<ProductQuery & { page: number }>) {
  const q = { ...base, ...patch };
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.category) params.set("category", q.category);
  if (q.collection) params.set("collection", q.collection);
  if (q.min !== undefined) params.set("min", String(q.min));
  if (q.max !== undefined) params.set("max", String(q.max));
  if (q.sort) params.set("sort", q.sort);
  if (q.inStock) params.set("stock", "1");
  if (q.page && q.page > 1) params.set("page", String(q.page));
  const s = params.toString();
  return `/shop${s ? `?${s}` : ""}`;
}
