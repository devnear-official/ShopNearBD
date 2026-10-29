import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIpHash, rateLimit } from "@/lib/rate-limit";
import { geminiConfigured } from "@/lib/ai/gemini";
import { interpretText, searchQueries, spokenTerms, transcribeAudio, type SearchHit } from "@/lib/ai/media-search";

const MAX = 2 * 1024 * 1024;
const AUDIO = /^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac|m4a|x-m4a)(;.*)?$/;
const textBody = z.object({ text: z.string().trim().min(1).max(200) });

/**
 * Voice search.
 * - JSON {text}: the browser already transcribed it (Web Speech API). We search
 *   the words directly; if that finds nothing (e.g. a Bangla sentence) and
 *   Gemini is set up, Gemini maps the sentence to catalogue words.
 * - multipart "audio": browsers without speech recognition send a short clip;
 *   Gemini transcribes it. The audio is never stored.
 */
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`voicesearch:${await clientIpHash()}`, 20, 60))) return NextResponse.json({ error: "Too many voice searches. Please wait a minute." }, { status: 429 });
  const ctype = req.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("application/json")) {
      const parsed = textBody.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return NextResponse.json({ error: "Say what you're looking for." }, { status: 400 });
      const text = parsed.data.text;
      const terms = spokenTerms(text);
      let res: { items: SearchHit[]; used: string | null } = await searchQueries([...new Set([terms, text.toLowerCase()].filter((q) => q.length > 1))]);
      let ai = false;
      if (res.items.length === 0 && geminiConfigured()) {
        const intent = await interpretText(text).catch(() => null);
        if (intent?.queries.length) { res = await searchQueries(intent.queries); ai = true; }
      }
      return NextResponse.json({ transcript: text, query: res.used ?? (terms || text), items: res.items, ai }, { headers: { "cache-control": "no-store" } });
    }

    if (!geminiConfigured()) return NextResponse.json({ error: "Voice search isn't available in this browser. Please type your search." }, { status: 503 });
    if (Number(req.headers.get("content-length") ?? 0) > MAX + 64 * 1024) return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
    const f = (await req.formData().catch(() => null))?.get("audio");
    if (!(f instanceof File) || !AUDIO.test(f.type) || f.size === 0) return NextResponse.json({ error: "We didn't get a recording. Please try again." }, { status: 400 });
    if (f.size > MAX) return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
    const intent = await transcribeAudio(Buffer.from(await f.arrayBuffer()), f.type.split(";")[0]);
    if (!intent.transcript && !intent.queries.length) return NextResponse.json({ transcript: "", query: null, items: [], ai: true });
    const res = await searchQueries(intent.queries.length ? intent.queries : [spokenTerms(intent.transcript ?? "")]);
    return NextResponse.json({ transcript: intent.transcript ?? "", query: res.used ?? intent.queries[0] ?? null, items: res.items, ai: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("voice search failed", (e as Error).message);
    return NextResponse.json({ error: "Voice search failed. Please try again or type your search." }, { status: 502 });
  }
}
