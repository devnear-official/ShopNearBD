import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories } from "@/lib/catalog";

const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getAllProductSlugs(), getCategories()]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.4 },
    ...categories.map((c) => ({ url: `${base}/category/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/shop/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
