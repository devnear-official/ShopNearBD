import "server-only";
import type { AdminContext } from "./auth";
import { cardSelect, priceJoin, type ProductDetail } from "./catalog";
import type { EditorValues } from "@/components/admin/product-editor";

export async function loadProductForAdmin(admin: AdminContext, id: string): Promise<(ProductDetail & { cost_price: number | null; all_variants: { id: string; name: string; sku: string; options: Record<string, string>; price: number | null; sale_price: number | null; stock: number; is_active: boolean }[]; image_rows: { id: string; url: string; storage_path: string | null; alt: string; variant_id: string | null; width: number | null; height: number | null }[] }) | null> {
  return admin.db(async (tx) => {
    const [p] = await tx<ProductDetail[]>`select ${cardSelect(tx)}, p.sku, p.description, p.specifications, p.tags, p.collections, p.seo_title, p.seo_description, p.og_image_url, p.category_id, p.status
      from public.products p ${priceJoin(tx)} where p.id = ${id}`;
    if (!p) return null;
    const [extra] = await tx<{ cost_price: number | null }[]>`select cost_price from public.products where id = ${id}`;
    const all_variants = await tx`select id, name, sku, options, price, sale_price, stock, is_active from public.product_variants where product_id = ${id} and sku not like '%-OLD-%' order by is_active desc, sort_order`;
    const image_rows = await tx`select id, url, storage_path, alt, variant_id, width, height from public.product_images where product_id = ${id} order by sort_order`;
    return { ...p, cost_price: extra.cost_price, all_variants, image_rows } as never;
  });
}

export function toEditorValues(p: NonNullable<Awaited<ReturnType<typeof loadProductForAdmin>>>): EditorValues {
  const keyOf = new Map(p.all_variants.map((v) => [v.id, v.id]));
  return {
    id: p.id, name: p.name, name_bn: p.name_bn ?? "", slug: p.slug, sku: p.sku, category_id: p.category_id ?? "", status: p.status as EditorValues["status"],
    is_featured: p.is_featured, price: p.price, sale_price: p.sale_price, cost_price: p.cost_price, low_stock_threshold: p.low_stock_threshold,
    short_description: p.short_description ?? "", description: p.description ?? "", specifications: p.specifications, tags: p.tags.join(", "), collections: p.collections.join(", "),
    option_names: p.option_names,
    variants: p.all_variants.map((v) => ({ id: v.id, key: v.id, name: v.name, sku: v.sku, options: v.options, price: v.price, sale_price: v.sale_price, stock: v.stock, is_active: v.is_active })),
    images: p.image_rows.map((i) => ({ id: i.id, url: i.url, storage_path: i.storage_path, alt: i.alt, variant_key: i.variant_id ? keyOf.get(i.variant_id) ?? null : null, width: i.width, height: i.height })),
    seo_title: p.seo_title ?? "", seo_description: p.seo_description ?? "", og_image_url: p.og_image_url ?? "",
  };
}

export async function categoryOptions(admin: AdminContext) {
  return admin.db((tx) => tx<{ id: string; name: string }[]>`select id, name from public.categories order by sort_order, name`);
}
