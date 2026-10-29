import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Type } from "@google/genai";
import { asAnon } from "../db";
import { imageFor, listProducts, type ProductCard } from "../catalog";
import { aiSettings } from "./chat-service";
import { generateJson, type Part } from "./gemini";
import { searchTerms } from "./intent";

export type SearchHit = { slug: string; name: string; name_bn: string | null; price: number; image: string | null; category: string | null };

export const toHit = (p: ProductCard): SearchHit => ({ slug: p.slug, name: p.name, name_bn: p.name_bn, price: p.min_price, image: imageFor(p)?.url ?? null, category: p.category?.name ?? null });

/** Product and category names, so the model answers in the store's own words. */
async function vocabulary(): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const rows = await asAnon((tx) => tx<{ name: string; category: string | null; tags: string[] }[]>`
    select p.name, c.name as category, p.tags from public.products p left join public.categories c on c.id = p.category_id
    order by p.sold_count desc limit 150`);
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))];
  const tags = [...new Set(rows.flatMap((r) => r.tags ?? []))].slice(0, 120);
  return `Categories: ${cats.join(", ")}\nProducts: ${rows.map((r) => r.name).join("; ")}\nTags: ${tags.join(", ")}`;
}

const intentSchema = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING, description: "What the shopper said, verbatim (voice only; empty otherwise)" },
    description: { type: Type.STRING, description: "Short description of the item in the photo (image only; empty otherwise)" },
    queries: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-4 short product search queries, best first, in English, using the store's own words" },
  },
  required: ["queries"],
};

type Intent = { transcript?: string; description?: string; queries: string[] };

const RULES = `[search-intent] You turn a shopper's request into product search queries for an online shop in Bangladesh.
Rules: answer only with JSON. Queries are 1-3 words each, lowercase, in English, preferring words from the store vocabulary below.
Do not invent brands or prices. If nothing relevant is shown or said, return an empty queries array.`;

function clean(i: Intent): Intent {
  const queries = [...new Set((i.queries ?? []).map((q) => String(q).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40)).filter((q) => q.length > 1))].slice(0, 4);
  return { transcript: i.transcript?.trim().slice(0, 200) || undefined, description: i.description?.trim().slice(0, 160) || undefined, queries };
}

async function ask(parts: Part[]): Promise<Intent> {
  const s = await aiSettings();
  const vocab = await vocabulary();
  return clean(await generateJson<Intent>([{ text: `${RULES}\n\n<store_vocabulary>\n${vocab}\n</store_vocabulary>` }, ...parts], s, intentSchema));
}

export const interpretImage = (data: Buffer, mimeType: string) =>
  ask([{ inlineData: { mimeType, data: data.toString("base64") } }, { text: "The shopper uploaded this photo and wants to find this product or similar ones. Describe it briefly and give search queries." }]);

export const transcribeAudio = (data: Buffer, mimeType: string) =>
  ask([{ inlineData: { mimeType, data: data.toString("base64") } }, { text: "The shopper spoke this search (Bangla, English or a mix). Put the exact words in transcript, then give search queries." }]);

export const interpretText = (text: string) =>
  ask([{ text: `The shopper said (via voice, possibly Bangla): """${text.slice(0, 200)}""". Give search queries.` }]);

/**
 * Runs each query against the catalogue (best first) and merges the results.
 * A multi-word query with no hits is retried as "any of these words".
 */
export async function searchQueries(queries: string[], limit = 8): Promise<{ items: SearchHit[]; used: string | null }> {
  const seen = new Map<string, SearchHit>();
  let used: string | null = null;
  for (const q of queries.slice(0, 4)) {
    let { items } = await listProducts({ q, pageSize: limit });
    if (!items.length && q.includes(" ")) ({ items } = await listProducts({ q: q.split(/\s+/).join(" or "), pageSize: limit }));
    if (items.length && !used) used = q;
    for (const p of items) if (!seen.has(p.slug)) seen.set(p.slug, toHit(p));
    if (seen.size >= limit) break;
  }
  return { items: [...seen.values()].slice(0, limit), used };
}

/** Words from a spoken sentence that are worth searching for (no AI needed). */
export const spokenTerms = (text: string) => searchTerms(text);
