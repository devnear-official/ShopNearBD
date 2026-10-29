import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { getPublicSettings } from "@/lib/catalog";

type Row = {
  product_sku: string; slug: string; name: string; short_description: string | null; description: string | null; category: string | null;
  price: number; sale_price: number | null; variant_sku: string; variant_name: string; options: Record<string, string>;
  v_price: number | null; v_sale_price: number | null; stock: number; images: { url: string; variant_id: string | null }[]; variant_id: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const abs = (u: string) => (u.startsWith("http") ? u : `${siteUrl()}${u.startsWith("/") ? "" : "/"}${u}`);
const money = (n: number) => `${Number(n).toFixed(2)} BDT`;

/**
 * Product catalogue feed (RSS 2.0 + Google product namespace), accepted by
 * Meta Commerce Manager, TikTok Catalog and Google Merchant Center.
 * One item per variant: id = variant SKU (the same content ID the pixels send),
 * item_group_id = product SKU.
 */
async function buildFeed(): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const [settings, rows] = await Promise.all([
    getPublicSettings(),
    asAnon((tx) => tx<Row[]>`
      select p.sku as product_sku, p.slug, p.name, p.short_description, p.description, c.name as category, p.price, p.sale_price,
        v.sku as variant_sku, v.name as variant_name, v.options, v.price as v_price, v.sale_price as v_sale_price, v.stock, v.id as variant_id,
        coalesce((select jsonb_agg(jsonb_build_object('url', i.url, 'variant_id', i.variant_id) order by i.sort_order) from public.product_images i where i.product_id = p.id), '[]') as images
      from public.products p
      join public.product_variants v on v.product_id = p.id and v.is_active
      left join public.categories c on c.id = p.category_id
      where p.status = 'published'
      order by p.sold_count desc, p.id, v.sort_order`),
  ]);
  const brand = settings.store?.name || "ShopNear BD";
  const items = rows.map((r) => {
    const base = Number(r.v_price ?? r.price);
    const now = r.v_price !== null ? Number(r.v_sale_price ?? r.v_price) : Number(r.v_sale_price ?? r.sale_price ?? r.price);
    const own = r.images.filter((i) => i.variant_id === r.variant_id);
    const imgs = [...own, ...r.images.filter((i) => i.variant_id !== r.variant_id)];
    const multi = rows.filter((x) => x.product_sku === r.product_sku).length > 1;
    const title = multi && r.variant_name !== "Default" ? `${r.name} - ${r.variant_name}` : r.name;
    const desc = (r.description || r.short_description || r.name).slice(0, 4900);
    const link = `${siteUrl()}/shop/${r.slug}`;
    const opts = r.options ?? {};
    return [
      "<item>",
      `<g:id>${esc(r.variant_sku)}</g:id>`,
      `<g:item_group_id>${esc(r.product_sku)}</g:item_group_id>`,
      `<g:title>${esc(title.slice(0, 150))}</g:title>`,
      `<g:description>${esc(desc)}</g:description>`,
      `<g:link>${esc(link)}</g:link>`,
      imgs[0] ? `<g:image_link>${esc(abs(imgs[0].url))}</g:image_link>` : "",
      ...imgs.slice(1, 10).map((i) => `<g:additional_image_link>${esc(abs(i.url))}</g:additional_image_link>`),
      `<g:availability>${r.stock > 0 ? "in stock" : "out of stock"}</g:availability>`,
      `<g:inventory>${Math.max(0, r.stock)}</g:inventory>`,
      `<g:price>${money(base)}</g:price>`,
      now < base ? `<g:sale_price>${money(now)}</g:sale_price>` : "",
      `<g:condition>new</g:condition>`,
      `<g:brand>${esc(brand)}</g:brand>`,
      r.category ? `<g:product_type>${esc(r.category)}</g:product_type>` : "",
      opts.Color ? `<g:color>${esc(opts.Color)}</g:color>` : "",
      opts.Size ? `<g:size>${esc(opts.Size)}</g:size>` : "",
      "</item>",
    ].filter(Boolean).join("");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${esc(brand)}</title><link>${esc(siteUrl())}</link><description>${esc(brand)} product catalogue</description>\n${items.join("\n")}\n</channel></rss>\n`;
}

export async function GET() {
  return new Response(await buildFeed(), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
