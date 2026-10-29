import "server-only";
import { asAnon } from "../db";
import { sha256 } from "../tokens";
import { unitPrice } from "../pricing";
import { extractBudget, searchTerms, type Intent } from "./intent";
import type { PublicSettings } from "../catalog";
import { getPublicSettings } from "../catalog";

export type ProductFact = { name: string; url: string; price: number; was: number | null; in_stock: boolean; stock_note: string; variants: string[]; summary: string; specs: string[] };
export type OrderFact = { order_number: string; status: string; payment_status: string; payment_method: string; total: number; courier: string | null; tracking_url: string | null; placed: string };
export type Context = { intent: Intent; products: ProductFact[]; faqs: { q: string; a: string }[]; policies: Record<string, unknown>; orders: OrderFact[]; ordersRequested: boolean };

/** Bounded, read-only lookups through the anon role (RLS applies). */
export async function retrieve(intent: Intent, message: string, orderAccess: { number: string; token: string }[]): Promise<Context> {
  const settings: PublicSettings = await getPublicSettings();
  const terms = searchTerms(message);
  const budget = extractBudget(message);
  const wantProducts = intent === "product" || intent === "general";

  const [products, faqs, orders] = await Promise.all([
    wantProducts ? findProducts(terms, budget) : Promise.resolve([]),
    findFaqs(terms || message.slice(0, 80)),
    intent === "order_status" ? findOrders(orderAccess) : Promise.resolve([]),
  ]);

  const policies: Record<string, unknown> = {};
  if (intent === "shipping" || intent === "general" || intent === "product") policies.delivery = { zones: settings.shipping.zones.map((z) => ({ area: z.label, fee_bdt: z.fee, time: z.eta })), free_delivery_from_bdt: settings.shipping.free_shipping_threshold, district_zone_rules: settings.shipping.district_zones };
  if (intent === "payment" || intent === "general") policies.payment = { cash_on_delivery: settings.payments.cod?.enabled, bkash: settings.payments.bkash_manual?.enabled ? "Send Money; verified by staff before dispatch" : "not available", nagad: settings.payments.nagad_manual?.enabled ? "Send Money; verified by staff before dispatch" : "not available" };
  if (intent === "returns" || intent === "general") policies.returns = settings.policies;
  policies.contact = { phone: settings.store.phone, hours: settings.store.hours, email: settings.store.email };

  return { intent, products, faqs, policies, orders, ordersRequested: intent === "order_status" };
}

async function findProducts(terms: string, budget: number | null): Promise<ProductFact[]> {
  type Row = { strong: boolean; slug: string; name: string; price: number; sale_price: number | null; short_description: string | null; specifications: { label: string; value: string }[]; low_stock_threshold: number; variants: { name: string; price: number | null; sale_price: number | null; stock: number }[] };
  const rows = await asAnon((tx) => tx<Row[]>`
    select ${terms ? tx`(p.name ilike ${"%" + terms.split(" ")[0] + "%"} or p.name_bn ilike ${"%" + terms.split(" ")[0] + "%"} or exists (select 1 from unnest(p.tags) t where ${terms} ilike '%' || t || '%' and length(t) > 2))` : tx`true`} as strong,
      p.slug, p.name, p.price, p.sale_price, p.short_description, p.specifications, p.low_stock_threshold,
      coalesce((select json_agg(json_build_object('name', v.name, 'price', v.price, 'sale_price', v.sale_price, 'stock', v.stock) order by v.sort_order) from public.product_variants v where v.product_id = p.id and v.is_active), '[]') as variants
    from public.products p
    where ${terms ? tx`(p.search_vector @@ websearch_to_tsquery('simple', ${terms}) or p.name ilike ${"%" + terms.split(" ")[0] + "%"} or p.name_bn ilike ${"%" + terms.split(" ")[0] + "%"} or exists (select 1 from unnest(p.tags) t where ${terms} ilike '%' || t || '%'))` : tx`true`}
      ${budget ? tx`and coalesce(p.sale_price, p.price) <= ${budget}` : tx``}
    order by 1 desc, ${terms ? tx`ts_rank(p.search_vector, websearch_to_tsquery('simple', ${terms})) desc,` : tx``} p.sold_count desc
    limit 6`);
  // Prefer products that match by name or tag; description-only mentions are weak evidence.
  const strong = rows.filter((r) => r.strong);
  return (strong.length ? strong : rows).slice(0, 4).map((p) => {
    const prices = p.variants.map((v) => unitPrice(p, v));
    const price = prices.length ? Math.min(...prices) : p.sale_price ?? p.price;
    const stock = p.variants.reduce((a, v) => a + v.stock, 0);
    return {
      name: p.name, url: `/shop/${p.slug}`, price, was: p.sale_price ? p.price : null, in_stock: stock > 0,
      stock_note: stock <= 0 ? "sold out" : stock <= p.low_stock_threshold ? "only a few left" : "in stock",
      variants: p.variants.filter((v) => v.name !== "Default").map((v) => `${v.name}${v.stock <= 0 ? " (sold out)" : ""}`),
      summary: p.short_description ?? "", specs: p.specifications.slice(0, 5).map((s) => `${s.label}: ${s.value}`),
    };
  });
}

async function findFaqs(text: string) {
  const rows = await asAnon((tx) => tx<{ question: string; answer: string }[]>`
    select question, answer from public.support_faqs
    where is_active and (search_vector @@ plainto_tsquery('simple', ${text}) or exists (select 1 from unnest(tags) t where ${text.toLowerCase()} like '%' || lower(t) || '%'))
    order by ts_rank(search_vector, plainto_tsquery('simple', ${text})) desc limit 3`);
  return rows.map((r) => ({ q: r.question, a: r.answer }));
}

/** Only orders whose private access token this browser holds — never by number or phone alone. */
async function findOrders(access: { number: string; token: string }[]): Promise<OrderFact[]> {
  const valid = access.filter((a) => /^SN\d{11}$/.test(a.number) && /^[A-Za-z0-9_-]{20,128}$/.test(a.token)).slice(0, 5);
  if (!valid.length) return [];
  const out: OrderFact[] = [];
  for (const a of valid) {
    const [r] = await asAnon((tx) => tx<{ o: { order_number: string; status: string; payment_status: string; payment_method: string; total: number; created_at: string; shipment: { provider: string; tracking_url: string | null } | null } | null }[]>`select public.get_order_public(${a.number}, ${sha256(a.token)}) as o`);
    if (r?.o) out.push({ order_number: r.o.order_number, status: r.o.status, payment_status: r.o.payment_status, payment_method: r.o.payment_method, total: Number(r.o.total), courier: r.o.shipment?.provider ?? null, tracking_url: r.o.shipment?.tracking_url ?? null, placed: r.o.created_at });
  }
  return out;
}
