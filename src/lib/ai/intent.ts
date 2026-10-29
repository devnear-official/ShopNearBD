/**
 * Lightweight intent classifier for Bangla, Banglish and English. It decides
 * which business data to retrieve; the model never chooses its own queries.
 */
export type Intent = "order_status" | "human" | "shipping" | "payment" | "returns" | "product" | "greeting" | "general";

const rules: [Intent, RegExp][] = [
  ["human", /\b(human|agent|person|representative|call me|talk to (someone|staff))\b|মানুষ|এজেন্ট|কথা বল|manush|kotha bol|admin er sathe/i],
  ["order_status", /\b(my order|order status|where is|track|tracking|parcel|consignment|SN\d{6,})\b|অর্ডার(টা)? কোথায়|অর্ডার স্ট্যাটাস|ট্র্যাক|order (ta|kothay|koi)|parcel (kothay|koi)|amar order/i],
  ["shipping", /\b(deliver|delivery|shipping|courier|charge|how many days|when will|dhaka|outside dhaka|district)\b|ডেলিভারি|চার্জ|কত দিন|কবে পাব|delivery charge|koto din|kobe pabo|charge koto/i],
  ["payment", /\b(pay|payment|bkash|nagad|cash on delivery|cod|trx|transaction|advance)\b|পেমেন্ট|বিকাশ|নগদ|ক্যাশ অন|টাকা দিব|payment kivabe|bikash/i],
  ["returns", /\b(return|refund|exchange|warranty|damaged|broken|wrong item|replace)\b|ফেরত|রিফান্ড|বদল|ওয়ারেন্টি|ভাঙা|ferot|refund|warranty|kharap/i],
  ["greeting", /^(hi|hello|hey|salam|assalamu|আসসালামু|হ্যালো|হাই|কেমন আছ|kemon acho)[\s!.?]*$/i],
];

const productHints = /\b(price|cost|stock|available|buy|have|recommend|best|under|below|which|compare|spec|battery|color|colour)\b|দাম|আছে|স্টক|কিনতে|কোনটা|dam koto|ache\b|koto taka|valo kon|suggest/i;

export function classify(message: string): Intent {
  const m = message.trim();
  for (const [intent, re] of rules) if (re.test(m)) return intent;
  if (productHints.test(m)) return "product";
  return m.split(/\s+/).length <= 6 ? "product" : "general";
}

/** Budget like "under 2000", "২০০০ টাকার মধ্যে", "2k er niche". */
export function extractBudget(message: string): number | null {
  const ascii = message.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  const m = /(?:under|below|within|less than|er? (?:moddhe|niche|vitore)|এর? (?:মধ্যে|নিচে)|max|budget)\s*৳?\s*(\d+(?:\.\d+)?)\s*(k)?/i.exec(ascii) ?? /৳?\s*(\d+(?:\.\d+)?)\s*(k)?\s*(?:taka|টাকা|tk)?\s*(?:er|এর)?\s*(?:moddhe|মধ্যে|niche|নিচে)/i.exec(ascii);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Search terms: drop filler words in all three languages. */
export function searchTerms(message: string): string {
  const stop = new Set("i me my want need a an the is are do you have any for to of and or with in on please show tell about price dam koto ki ache ase amar ami chai lagbe kono ta te er ar je ki? kemon valo best".split(" "));
  return message.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !stop.has(w) && !/^\d+$/.test(w)).slice(0, 6).join(" ");
}
