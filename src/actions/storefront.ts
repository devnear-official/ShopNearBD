"use server";
import { listProducts, type ProductCard } from "@/lib/catalog";

/** Up to four products of one category, for the home page mall. Public, read-only, cached by the catalogue layer. */
export async function categoryProducts(slug: string): Promise<ProductCard[]> {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,60}$/.test(slug)) return [];
  return (await listProducts({ category: slug, pageSize: 4 })).items;
}
