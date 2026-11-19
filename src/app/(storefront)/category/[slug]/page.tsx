import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategories, listProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/products/product-grid";
import { ButtonLink } from "@/components/ui/button";

const BUILD_PLACEHOLDER = "__build_placeholder__";

/** Crawlable, statically generated category landing pages. Filtering lives on /shop. */
export async function generateStaticParams() {
  const cats = await getCategories();
  if (cats.length === 0) return [{ slug: BUILD_PLACEHOLDER }];
  return cats.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === BUILD_PLACEHOLDER) return { title: "Category not found", robots: { index: false } };
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found" };
  return {
    title: `${cat.name} — buy online in Bangladesh`,
    description: cat.description ?? `Shop ${cat.name} at ShopNear BD with Cash on Delivery.`,
    alternates: { canonical: `/category/${cat.slug}` },
  };
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 pt-8 sm:px-8"><div className="skeleton h-64 rounded-[2.5rem]" /></div>}><CategoryView params={params} /></Suspense>;
}

async function CategoryView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === BUILD_PLACEHOLDER) notFound();
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) notFound();
  const { items, total } = await listProducts({ category: slug, pageSize: 24, sort: "popular" });
  return (
    <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-8 sm:pt-8">
      <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-slate"><Link href="/" className="hover:underline">Home</Link> / <Link href="/shop" className="hover:underline">Shop</Link> / <span className="text-ink font-semibold">{cat.name}</span></nav>
      <header className="mt-2.5 rounded-2xl p-4 text-white sm:mt-4 sm:rounded-[2.5rem] sm:p-8" style={{ background: cat.accent ?? "#1E6BFF" }}>
        <h1 className="flex flex-wrap items-baseline gap-x-2 text-xl font-extrabold tracking-tight sm:text-4xl">
          <span>{cat.name}</span>
          {cat.name_bn && <span className="bn text-xs font-normal opacity-85 sm:text-xl" lang="bn">({cat.name_bn})</span>}
        </h1>
        {cat.description && <p className="mt-1 text-xs text-white/85 line-clamp-2 sm:mt-3 sm:line-clamp-none sm:text-base">{cat.description}</p>}
        <ButtonLink href={`/shop?category=${cat.slug}`} variant="light" size="sm" className="mt-3 sm:mt-6 sm:h-11 sm:px-6 sm:text-sm">Filter & sort {total} products</ButtonLink>
      </header>
      <div className="mt-4 sm:mt-10"><ProductGrid items={items} /></div>
    </div>
  );
}
