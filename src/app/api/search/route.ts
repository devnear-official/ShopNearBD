import { NextResponse, type NextRequest } from "next/server";
import { imageFor, listProducts } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ items: [] });
  let { items } = await listProducts({ q, pageSize: 6 });
  // "blue neck fan" with no exact match → any of the words.
  if (!items.length && /\s/.test(q)) ({ items } = await listProducts({ q: q.split(/\s+/).slice(0, 5).join(" or "), pageSize: 6 }));
  return NextResponse.json(
    { items: items.map((p) => ({ slug: p.slug, name: p.name, name_bn: p.name_bn, price: p.min_price, image: imageFor(p)?.url ?? null, category: p.category?.name ?? null })) },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
