import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon, type Tx } from "./db";
import type { ShippingSettings } from "./shipping";

export type Variant = { id: string; name: string; sku: string; options: Record<string, string>; price: number | null; sale_price: number | null; stock: number; is_default: boolean };
export type ProductImage = { url: string; alt: string; variant_id: string | null; width: number | null; height: number | null };
export type ProductCard = {
  id: string; slug: string; name: string; name_bn: string | null; short_description: string | null;
  price: number; sale_price: number | null; is_featured: boolean; sold_count: number; created_at: string;
  option_names: string[]; low_stock_threshold: number;
  category: { slug: string; name: string } | null;
  images: ProductImage[]; variants: Variant[];
  min_price: number; total_stock: number;
};
export type ProductDetail = ProductCard & {
  sku: string; description: string | null; specifications: { label: string; value: string }[]; tags: string[]; collections: string[];
  seo_title: string | null; seo_description: string | null; og_image_url: string | null; category_id: string | null; status: string;
};
export type Category = { id: string; slug: string; name: string; name_bn: string | null; description: string | null; accent: string | null; image_url: string | null; product_count: number; cover: string | null };

export type StoreSettings = {
  name: string; tagline: string; tagline_bn: string; phone: string; whatsapp: string; email: string; address: string; hours: string;
  social: Record<string, string>; dev_default?: boolean;
};
export type PaymentSettings = {
  cod: { enabled: boolean; note?: string };
  bkash_manual: { enabled: boolean; number: string; account_type: string; instructions: string };
  nagad_manual: { enabled: boolean; number: string; account_type: string; instructions: string };
  dev_default?: boolean;
};
export type PolicySettings = { returns: string; refunds: string; cancellation: string; warranty: string; dev_default?: boolean };
export type HomepageSettings = {
  hero_eyebrow: string; hero_title: string; hero_title_accent: string; hero_subtitle: string; hero_product_slug: string | null;
  campaign_title: string; campaign_body: string; campaign_collection: string; marquee: string[];
};
export type PublicSettings = { store: StoreSettings; shipping: ShippingSettings; payments: PaymentSettings; policies: PolicySettings; homepage: HomepageSettings };

/** Card columns + aggregated images/variants in one round trip. */
const cardSelect = (tx: Tx) => tx`
  p.id, p.slug, p.name, p.name_bn, p.short_description, p.price, p.sale_price, p.is_featured, p.sold_count,
  p.created_at, p.option_names, p.low_stock_threshold,
  (select json_build_object('slug', c.slug, 'name', c.name) from public.categories c where c.id = p.category_id) as category,
  coalesce((select json_agg(json_build_object('url', i.url, 'alt', i.alt, 'variant_id', i.variant_id, 'width', i.width, 'height', i.height) order by i.sort_order)
            from public.product_images i where i.product_id = p.id), '[]') as images,
  coalesce((select json_agg(json_build_object('id', v.id, 'name', v.name, 'sku', v.sku, 'options', v.options, 'price', v.price,
             'sale_price', v.sale_price, 'stock', v.stock, 'is_default', v.is_default) order by v.sort_order)
            from public.product_variants v where v.product_id = p.id and v.is_active), '[]') as variants,
  pr.min_price, pr.total_stock`;

const priceJoin = (tx: Tx) => tx`
  cross join lateral (
    select coalesce(min(public.variant_unit_price(p, v)), coalesce(p.sale_price, p.price)) as min_price,
           coalesce(sum(v.stock), 0)::int as total_stock
    from public.product_variants v where v.product_id = p.id and v.is_active
  ) pr`;

function normalize<T extends ProductCard>(r: T): T {
  return { ...r, created_at: new Date(r.created_at).toISOString(), min_price: Number(r.min_price) };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  const rows = await asAnon((tx) => tx<{ key: string; value: unknown }[]>`select key, value from public.site_settings where is_public`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as PublicSettings;
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return asAnon((tx) => tx<Category[]>`
    select c.id, c.slug, c.name, c.name_bn, c.description, c.accent, c.image_url,
      (select count(*)::int from public.products p where p.category_id = c.id) as product_count,
      coalesce(c.image_url, (select i.url from public.products p join public.product_images i on i.product_id = p.id
        where p.category_id = c.id order by p.is_featured desc, p.sold_count desc, i.sort_order limit 1)) as cover
    from public.categories c where c.parent_id is null order by c.sort_order, c.name`);
}

export type ProductQuery = {
  q?: string; category?: string; collection?: string; min?: number; max?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "popular" | "discount"; page?: number; pageSize?: number; inStock?: boolean;
};

export async function listProducts(query: ProductQuery): Promise<{ items: ProductCard[]; total: number; page: number; pageSize: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const page = Math.max(1, Math.min(query.page ?? 1, 500));
  const pageSize = Math.max(1, Math.min(query.pageSize ?? 12, 48));
  const q = query.q?.trim().slice(0, 80) || null;
  return asAnon(async (tx) => {
    const where = tx`
      where true
      ${query.category ? tx`and p.category_id = (select id from public.categories where slug = ${query.category})` : tx``}
      ${query.collection ? tx`and ${query.collection} = any(p.collections)` : tx``}
      ${q ? tx`and (p.search_vector @@ websearch_to_tsquery('simple', ${q}) or p.name ilike ${"%" + q.replace(/[%_]/g, "") + "%"} or p.name_bn ilike ${"%" + q + "%"} or ${q.toLowerCase()} = any(p.tags))` : tx``}
      ${query.min !== undefined ? tx`and pr.min_price >= ${query.min}` : tx``}
      ${query.max !== undefined ? tx`and pr.min_price <= ${query.max}` : tx``}
      ${query.inStock ? tx`and pr.total_stock > 0` : tx``}`;
    const order =
      query.sort === "price_asc" ? tx`pr.min_price asc, p.id`
      : query.sort === "price_desc" ? tx`pr.min_price desc, p.id`
      : query.sort === "popular" ? tx`p.sold_count desc, p.id`
      : query.sort === "discount" ? tx`(p.price - pr.min_price) / nullif(p.price, 0) desc nulls last, p.id`
      : q ? tx`ts_rank(p.search_vector, websearch_to_tsquery('simple', ${q})) desc, p.sold_count desc`
      : tx`p.published_at desc nulls last, p.id`;
    const [{ total }] = await tx<{ total: number }[]>`select count(*)::int as total from public.products p ${priceJoin(tx)} ${where}`;
    const items = await tx<ProductCard[]>`
      select ${cardSelect(tx)} from public.products p ${priceJoin(tx)} ${where}
      order by ${order} limit ${pageSize} offset ${(page - 1) * pageSize}`;
    return { items: items.map(normalize), total, page, pageSize };
  });
}

export async function getProductsBySlugs(slugs: string[]): Promise<ProductCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  if (!slugs.length) return [];
  const rows = await asAnon((tx) => tx<ProductCard[]>`select ${cardSelect(tx)} from public.products p ${priceJoin(tx)} where p.slug = any(${slugs})`);
  return slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean).map((r) => normalize(r!));
}

export async function getFeatured(limit = 6): Promise<ProductCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const rows = await asAnon((tx) => tx<ProductCard[]>`
    select ${cardSelect(tx)} from public.products p ${priceJoin(tx)} where p.is_featured
    order by p.sold_count desc limit ${limit}`);
  return rows.map(normalize);
}

export async function getProduct(slugOrId: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", `product:${slugOrId}`);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const rows = await asAnon((tx) => tx<ProductDetail[]>`
    select ${cardSelect(tx)}, p.sku, p.description, p.specifications, p.tags, p.collections, p.seo_title, p.seo_description,
      p.og_image_url, p.category_id, p.status
    from public.products p ${priceJoin(tx)}
    where ${isUuid ? tx`p.id = ${slugOrId}` : tx`p.slug = ${slugOrId}`}`);
  return rows[0] ? normalize(rows[0]) : null;
}

export async function getRelated(product: { id: string; category_id: string | null; tags: string[] }, limit = 4): Promise<ProductCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const rows = await asAnon((tx) => tx<ProductCard[]>`
    select ${cardSelect(tx)} from public.products p ${priceJoin(tx)}
    where p.id <> ${product.id}
    order by (p.category_id is not distinct from ${product.category_id}) desc,
             cardinality(array(select unnest(p.tags) intersect select unnest(${product.tags}::text[]))) desc,
             p.sold_count desc
    limit ${limit}`);
  return rows.map(normalize);
}

export type Review = { id: string; author_name: string; rating: number; body: string | null; created_at: string };
export async function getReviews(productId: string): Promise<{ reviews: Review[]; average: number | null; count: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag("reviews", `reviews:${productId}`);
  const reviews = await asAnon((tx) => tx<Review[]>`
    select id, author_name, rating, body, created_at from public.reviews where product_id = ${productId}
    order by created_at desc limit 20`);
  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  return { reviews: reviews.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })), average, count };
}

export async function getAllProductSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const rows = await asAnon((tx) => tx<{ slug: string; updated_at: Date }[]>`select slug, updated_at from public.products order by published_at desc limit 5000`);
  return rows.map((r) => ({ slug: r.slug, updated_at: new Date(r.updated_at).toISOString() }));
}

/** Choose the image for a variant: its own image first, else the product's first. */
export function imageFor(p: Pick<ProductCard, "images">, variantId?: string | null): ProductImage | null {
  return (variantId && p.images.find((i) => i.variant_id === variantId)) || p.images[0] || null;
}
