import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Star } from "lucide-react";
import { getAllProductSlugs, getProduct, getPublicSettings, getRelated, getReviews } from "@/lib/catalog";
import { unitPrice } from "@/lib/pricing";
import { formatDate } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { ProductExperience, RecentlyViewed } from "@/components/products/product-experience";
import { ProductGrid } from "@/components/products/product-grid";

type Params = { params: Promise<{ slug: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.slice(0, 200).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const image = p.og_image_url ?? p.images[0]?.url;
  return {
    title: p.seo_title ?? p.name,
    description: p.seo_description ?? p.short_description ?? undefined,
    alternates: { canonical: `/shop/${p.slug}` },
    openGraph: { title: p.name, description: p.short_description ?? undefined, images: image ? [{ url: image, alt: p.images[0]?.alt || p.name }] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  // /shop/<uuid> keeps working but canonicalises to the readable slug.
  if (UUID.test(slug)) permanentRedirect(`/shop/${product.slug}`);

  const [settings, related, reviews] = await Promise.all([getPublicSettings(), getRelated(product), getReviews(product.id)]);
  const base = siteUrl();
  const prices = product.variants.map((v) => unitPrice(product, v));
  const inStock = product.variants.some((v) => v.stock > 0);

  // Structured data mirrors exactly what the page shows.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku,
      description: product.short_description ?? undefined,
      image: product.images.map((i) => (i.url.startsWith("http") ? i.url : `${base}${i.url}`)),
      category: product.category?.name,
      offers: product.variants.length > 1
        ? { "@type": "AggregateOffer", priceCurrency: "BDT", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: product.variants.length, availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
        : { "@type": "Offer", priceCurrency: "BDT", price: prices[0], availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${base}/shop/${product.slug}` },
      ...(reviews.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average, reviewCount: reviews.count } } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "Shop", item: `${base}/shop` },
        ...(product.category ? [{ "@type": "ListItem", position: 3, name: product.category.name, item: `${base}/category/${product.category.slug}` }] : []),
        { "@type": "ListItem", position: product.category ? 4 : 3, name: product.name, item: `${base}/shop/${product.slug}` },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-8">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate">
          <ol className="flex flex-wrap gap-1.5">
            <li><Link href="/" className="hover:underline">Home</Link> /</li>
            <li><Link href="/shop" className="hover:underline">Shop</Link> /</li>
            {product.category && <li><Link href={`/category/${product.category.slug}`} className="hover:underline">{product.category.name}</Link> /</li>}
            <li aria-current="page" className="text-ink">{product.name}</li>
          </ol>
        </nav>

        <ProductExperience product={product} shipping={settings.shipping} payments={settings.payments}>
          <div className="mt-8 divide-y divide-line rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]">
            <Details title="Description" open>
              <p className="whitespace-pre-line leading-relaxed text-ink-2">{product.description}</p>
            </Details>
            {product.specifications.length > 0 && (
              <Details title="Specifications" open>
                <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2.5 text-sm">
                  {product.specifications.map((s) => (
                    <div key={s.label} className="contents"><dt className="text-slate">{s.label}</dt><dd className="font-medium">{s.value}</dd></div>
                  ))}
                  <div className="contents"><dt className="text-slate">SKU</dt><dd className="font-mono text-xs">{product.sku}</dd></div>
                </dl>
              </Details>
            )}
            <Details title="Delivery & payment">
              <ul className="space-y-1.5 text-sm text-ink-2">
                {settings.shipping.zones.map((z) => <li key={z.id}>{z.label}: ৳{z.fee}{z.eta ? ` · ${z.eta}` : ""}</li>)}
              </ul>
              <p className="mt-3 text-sm text-slate">Pay by Cash on Delivery{settings.payments.bkash_manual?.enabled ? ", bKash" : ""}{settings.payments.nagad_manual?.enabled ? " or Nagad" : ""}. Advance payments are verified by our team before dispatch.</p>
            </Details>
            <Details title="Returns & warranty">
              <p className="text-sm text-ink-2">{settings.policies.returns}</p>
              <p className="mt-2 text-sm text-ink-2">{settings.policies.warranty}</p>
              <Link href="/help#returns" className="mt-2 inline-block text-sm font-semibold text-electric underline">Full policy</Link>
            </Details>
          </div>
        </ProductExperience>

        <section aria-labelledby="reviews" className="mt-20">
          <h2 id="reviews" className="display text-4xl">Reviews</h2>
          {reviews.count > 0 ? (
            <>
              <p className="mt-2 flex items-center gap-2 text-slate"><Star className="size-5 fill-sun text-sun" /> <b className="text-ink">{reviews.average}</b> from {reviews.count} verified buyer{reviews.count === 1 ? "" : "s"}</p>
              <ul className="mt-6 grid gap-4 md:grid-cols-2">
                {reviews.reviews.map((r) => (
                  <li key={r.id} className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)]">
                    <p className="flex items-center gap-1" aria-label={`${r.rating} out of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`size-4 ${i < r.rating ? "fill-sun text-sun" : "text-line"}`} />)}</p>
                    {r.body && <p className="mt-3 text-ink-2">{r.body}</p>}
                    <p className="mt-3 text-sm text-slate">{r.author_name} · verified purchase · {formatDate(r.created_at)}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 max-w-xl text-slate">No reviews yet. Reviews come only from customers whose order was delivered — you&apos;ll get a link to review after your parcel arrives.</p>
          )}
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-20">
            <h2 id="related" className="display mb-8 text-4xl">You might also like</h2>
            <ProductGrid items={related} />
          </section>
        )}
      </div>
      <RecentlyViewed exclude={product.slug} />
    </>
  );
}

function Details({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
        {title}
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-paper text-lg transition group-open:rotate-45">+</span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
