import { NextResponse, type NextRequest } from "next/server";
import { getProductsBySlugs } from "@/lib/catalog";

/** Public product cards by slug (used by the guest wishlist). Max 50, published only (RLS). */
export async function GET(req: NextRequest) {
  const slugs = (req.nextUrl.searchParams.get("slugs") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,80}$/.test(s)).slice(0, 50);
  const items = slugs.length ? await getProductsBySlugs([...new Set(slugs)].sort()) : [];
  return NextResponse.json({ items }, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
