/**
 * Development seed: categories, products, variants, images, FAQs, a sample coupon.
 * Idempotent — existing rows (matched by slug / sku / code) are left untouched.
 *   npm run db:seed
 * No reviews are seeded: the storefront only shows reviews from real delivered orders.
 */
import postgres from "postgres";
import { loadEnv } from "./env";
import { categories, faqs, products } from "./seed-data";

loadEnv();
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });

async function main() {
  await sql.begin(async (tx) => {
    const catIds = new Map<string, string>();
    for (const [i, c] of categories.entries()) {
      const [row] = await tx<{ id: string }[]>`
        insert into public.categories (slug, name, name_bn, description, accent, sort_order)
        values (${c.slug}, ${c.name}, ${c.name_bn}, ${c.description}, ${c.accent}, ${i})
        on conflict (slug) do update set slug = excluded.slug
        returning id`;
      catIds.set(c.slug, row.id);
    }

    let created = 0;
    for (const [i, p] of products.entries()) {
      const exists = await tx`select 1 from public.products where slug = ${p.slug}`;
      if (exists.length) continue;
      created++;
      const publishedAt = new Date(Date.now() - (products.length - i) * 86400000 * 2);
      const [prod] = await tx<{ id: string }[]>`
        insert into public.products (slug, sku, name, name_bn, short_description, description, specifications, category_id,
          tags, collections, price, sale_price, cost_price, status, is_featured, option_names, sold_count, published_at, created_at,
          seo_title, seo_description)
        values (${p.slug}, ${p.sku}, ${p.name}, ${p.name_bn}, ${p.short}, ${p.description},
          ${tx.json(p.specs.map(([label, value]) => ({ label, value })))}, ${catIds.get(p.category)!},
          ${p.tags}, ${p.collections ?? []}, ${p.price}, ${p.sale_price ?? null}, ${p.cost_price ?? null}, 'published',
          ${p.featured ?? false}, ${p.option_names ?? []}, ${p.sold ?? 0}, ${publishedAt}, ${publishedAt},
          ${`${p.name} — price in Bangladesh`}, ${p.short})
        returning id`;

      const variantIds: string[] = [];
      for (const [j, v] of p.variants.entries()) {
        const [row] = await tx<{ id: string }[]>`
          insert into public.product_variants (product_id, name, sku, options, price, sale_price, stock, is_default, sort_order)
          values (${prod.id}, ${v.name}, ${v.sku}, ${tx.json(v.options)}, ${v.price ?? null}, ${v.sale_price ?? null}, ${v.stock}, ${j === 0}, ${j})
          returning id`;
        variantIds.push(row.id);
        if (v.stock > 0) {
          await tx`insert into public.inventory_movements (variant_id, delta, stock_after, reason, note)
                   values (${row.id}, ${v.stock}, ${v.stock}, 'initial', 'Seed stock')`;
        }
      }

      const images: { url: string; alt: string; variant: string | null }[] = [
        { url: `/seed/${p.slug}-1.webp`, alt: `${p.name}${p.variants[0].options.Color ? ` in ${p.variants[0].options.Color}` : ""}`, variant: p.variants[0].palette ? variantIds[0] : null },
        { url: `/seed/${p.slug}-2.webp`, alt: `${p.name} — close-up`, variant: null },
        ...p.variants.slice(1).flatMap((v, k) => (v.palette ? [{ url: `/seed/${p.slug}-${v.sku.toLowerCase()}.webp`, alt: `${p.name} in ${v.name}`, variant: variantIds[k + 1] }] : [])),
      ];
      for (const [k, im] of images.entries()) {
        await tx`insert into public.product_images (product_id, variant_id, url, alt, width, height, sort_order)
                 values (${prod.id}, ${im.variant}, ${im.url}, ${im.alt}, 1000, 1250, ${k})`;
      }
    }

    for (const [i, f] of faqs.entries()) {
      const exists = await tx`select 1 from public.support_faqs where question = ${f.q}`;
      if (!exists.length) await tx`insert into public.support_faqs (question, answer, tags, sort_order) values (${f.q}, ${f.a}, ${f.tags}, ${i})`;
    }

    await tx`insert into public.coupons (code, description, type, value, min_subtotal, max_discount, per_phone_limit)
             values ('WELCOME10', 'Dev sample: 10% off first order over ৳1,000 (max ৳300)', 'percent', 10, 1000, 300, 1)
             on conflict (code) do nothing`;

    await tx`update public.site_settings set value = jsonb_set(value, '{hero_product_slug}', '"pulse-anc-earbuds-pro"')
             where key = 'homepage' and (value ->> 'hero_product_slug') is null`;

    console.log(`seeded: ${created} new products, ${categories.length} categories, ${faqs.length} FAQs`);
  });
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
