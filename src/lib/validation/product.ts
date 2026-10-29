import { z } from "zod";
import { slug } from "./common";

const money = z.coerce.number().min(0).max(10_000_000);
const optMoney = z.union([z.literal(""), z.null(), z.undefined(), money]).transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)));

export const variantSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  key: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, - _ . only"),
  options: z.record(z.string(), z.string().trim().max(40)),
  price: optMoney,
  sale_price: optMoney,
  stock: z.coerce.number().int().min(0).max(1_000_000),
  is_active: z.boolean(),
});

export const imageSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  url: z.string().min(1).max(500),
  storage_path: z.string().max(300).nullable().optional(),
  alt: z.string().trim().max(200),
  variant_key: z.string().max(80).nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
});

export const productSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2, "Name is required").max(140),
  name_bn: z.string().trim().max(140).optional().default(""),
  slug,
  sku: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, - _ . only"),
  category_id: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
  status: z.enum(["draft", "published", "archived"]),
  is_featured: z.boolean(),
  price: money.refine((v) => v > 0, "Price must be above 0"),
  sale_price: optMoney,
  cost_price: optMoney,
  low_stock_threshold: z.coerce.number().int().min(0).max(10000),
  short_description: z.string().trim().max(300).optional().default(""),
  description: z.string().trim().max(10000).optional().default(""),
  specifications: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) })).max(40),
  tags: z.string().max(500).transform((v) => [...new Set(v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30)),
  collections: z.string().max(300).transform((v) => [...new Set(v.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))].slice(0, 10)),
  option_names: z.array(z.string().trim().min(1).max(30)).max(3),
  variants: z.array(variantSchema).min(1, "Add at least one variant").max(100),
  images: z.array(imageSchema).max(20),
  seo_title: z.string().trim().max(70).optional().default(""),
  seo_description: z.string().trim().max(170).optional().default(""),
  og_image_url: z.string().trim().max(500).optional().default(""),
}).superRefine((p, ctx) => {
  if (p.sale_price !== null && p.sale_price >= p.price) ctx.addIssue({ code: "custom", path: ["sale_price"], message: "Sale price must be lower than the price" });
  const skus = new Set<string>();
  p.variants.forEach((v, i) => {
    if (skus.has(v.sku.toUpperCase())) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Duplicate SKU" });
    skus.add(v.sku.toUpperCase());
    if (v.sale_price !== null && v.price !== null && v.sale_price >= v.price) ctx.addIssue({ code: "custom", path: ["variants", i, "sale_price"], message: "Must be below the variant price" });
    for (const o of p.option_names) if (!v.options[o]) ctx.addIssue({ code: "custom", path: ["variants", i, "options"], message: `Set ${o}` });
  });
  if (p.status === "published" && p.images.length === 0) ctx.addIssue({ code: "custom", path: ["images"], message: "Add at least one image before publishing" });
});

export type ProductInput = z.input<typeof productSchema>;
