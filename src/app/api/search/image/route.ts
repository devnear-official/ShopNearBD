import { NextResponse, type NextRequest } from "next/server";
import { clientIpHash, rateLimit } from "@/lib/rate-limit";
import { geminiConfigured } from "@/lib/ai/gemini";
import { interpretImage, searchQueries } from "@/lib/ai/media-search";

const MAX = 6 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Sniff the real format; the browser-supplied type is not trusted. */
function sniff(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|msf1|heif)/.test(b.subarray(8, 12).toString("latin1"))) return "image/heic";
  return null;
}

/**
 * Photo search: the image goes to Gemini (vision) once to get search words,
 * then the normal catalogue search runs. The image is never stored or logged.
 */
export async function POST(req: NextRequest) {
  if (!geminiConfigured()) return NextResponse.json({ error: "Photo search isn't set up on this store yet. Please type what you're looking for." }, { status: 503 });
  if (!(await rateLimit(`imgsearch:${await clientIpHash()}`, 8, 60))) return NextResponse.json({ error: "Too many photo searches. Please wait a minute." }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX + 64 * 1024) return NextResponse.json({ error: "That photo is too large (max 6 MB)." }, { status: 413 });

  let file: File | null = null;
  try {
    const f = (await req.formData()).get("image");
    file = f instanceof File ? f : null;
  } catch {}
  if (!file) return NextResponse.json({ error: "Choose a photo to search with." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "That photo is too large (max 6 MB)." }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !TYPES.includes(type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP or HEIC photo." }, { status: 415 });

  try {
    const intent = await interpretImage(bytes, type);
    const { items, used } = await searchQueries(intent.queries);
    return NextResponse.json({ description: intent.description ?? null, queries: intent.queries, query: used ?? intent.queries[0] ?? null, items }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("image search failed", (e as Error).message);
    return NextResponse.json({ error: "We couldn't read that photo right now. Please try again or type your search." }, { status: 502 });
  }
}
