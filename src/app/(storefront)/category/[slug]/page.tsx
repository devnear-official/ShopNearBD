import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategories, listProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/products/product-grid";
import { ButtonLink } from "@/components/ui/button";

/** Crawlable, statically generated category landing pages. Filtering lives on /shop. */
export async function generateStaticParams() {
  const cats = await getCategories();
  return cats.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found" };
  return {
    title: `${cat.name} — buy online in Bangladesh`,
    description: cat.description ?? `Shop ${cat.name} at ShopNear BD with Cash on Delivery.`,
    alternates: { canonical: `/category/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) notFound();
  const { items, total } = await listProducts({ category: slug, pageSize: 24, sort: "popular" });
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate"><Link href="/" className="hover:underline">Home</Link> / <Link href="/shop" className="hover:underline">Shop</Link> / <span className="text-ink">{cat.name}</span></nav>
      <header className="mt-4 rounded-[2.5rem] p-8 text-white sm:p-12" style={{ background: cat.accent ?? "#1E6BFF" }}>
        <h1 className="display text-[clamp(3rem,9vw,6.5rem)]">{cat.name}</h1>
        {cat.name_bn && <p className="bn mt-1 text-2xl font-semibold opacity-85" lang="bn">{cat.name_bn}</p>}
        <p className="mt-4 max-w-xl text-lg text-white/85">{cat.description}</p>
        <ButtonLink href={`/shop?category=${cat.slug}`} variant="light" className="mt-6">Filter & sort {total} products</ButtonLink>
      </header>
      <div className="mt-10"><ProductGrid items={items} /></div>
    </div>
  );
}
