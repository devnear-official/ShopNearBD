import { describe, expect, it } from "vitest";
import { bdPhone, normalizeBdPhone } from "@/lib/validation/common";
import { checkoutSchema, deliverySchema } from "@/lib/validation/checkout";
import { productSchema } from "@/lib/validation/product";

describe("Bangladesh phone numbers", () => {
  it.each([["01712345678", "01712345678"], ["+8801712345678", "01712345678"], ["8801712345678", "01712345678"], ["017-1234-5678", "01712345678"], ["০১৭১২৩৪৫৬৭৮", "01712345678"]])("normalises %s", (input, out) => {
    expect(normalizeBdPhone(input)).toBe(out);
    expect(bdPhone.parse(input)).toBe(out);
  });
  it.each(["0171234567", "01212345678", "11712345678", "abc"])("rejects %s", (bad) => {
    expect(bdPhone.safeParse(bad).success).toBe(false);
  });
});

const delivery = { name: "Rahim", phone: "01712345678", district: "Dhaka", address: "House 12, Road 5, Dhanmondi" };
const item = { variantId: "6f1b5f5e-1c2d-4e5f-8a9b-0c1d2e3f4a5b", quantity: 1 };

describe("checkout validation", () => {
  it("accepts a valid COD checkout", () => {
    expect(checkoutSchema.safeParse({ items: [item], delivery, payment: { method: "cod" }, idempotencyKey: "x".repeat(20), accessToken: "a".repeat(43) }).success).toBe(true);
  });
  it("requires a known district and a usable address", () => {
    expect(deliverySchema.safeParse({ ...delivery, district: "Atlantis" }).success).toBe(false);
    expect(deliverySchema.safeParse({ ...delivery, address: "Dhaka" }).success).toBe(false);
  });
  it("manual payment needs TrxID and sender unless paying later", () => {
    const base = { items: [item], delivery, idempotencyKey: "x".repeat(20), accessToken: "a".repeat(43) };
    expect(checkoutSchema.safeParse({ ...base, payment: { method: "bkash_manual" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, payment: { method: "bkash_manual", payLater: true } }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, payment: { method: "nagad_manual", senderNumber: "01812345678", transactionId: "9JK4L2M8QA" } }).success).toBe(true);
  });
  it("caps quantities and line count", () => {
    const base = { delivery, payment: { method: "cod" }, idempotencyKey: "x".repeat(20), accessToken: "a".repeat(43) };
    expect(checkoutSchema.safeParse({ ...base, items: [{ ...item, quantity: 21 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
  it("has no field for totals — the browser cannot send a price", () => {
    const parsed = checkoutSchema.parse({ items: [{ ...item, price: 1 }], delivery, payment: { method: "cod" }, idempotencyKey: "x".repeat(20), accessToken: "a".repeat(43), total: 1 } as never);
    expect(parsed).not.toHaveProperty("total");
    expect(parsed.items[0]).not.toHaveProperty("price");
  });
});

describe("product validation", () => {
  const base = {
    name: "Test", slug: "test-product", sku: "TST-1", category_id: "", status: "draft", is_featured: false, price: 1000, sale_price: "", cost_price: "", low_stock_threshold: 5,
    specifications: [], tags: "a, b", collections: "Commute Kit", option_names: ["Color"], images: [], seo_title: "", seo_description: "", og_image_url: "",
    variants: [{ key: "1", name: "Black", sku: "TST-1-B", options: { Color: "Black" }, price: "", sale_price: "", stock: 3, is_active: true }],
  };
  it("normalises tags and collections", () => {
    const p = productSchema.parse(base);
    expect(p.collections).toEqual(["commute-kit"]);
    expect(p.tags).toEqual(["a", "b"]);
  });
  it("rejects a sale price above the price, duplicate SKUs, missing options, publishing without images", () => {
    expect(productSchema.safeParse({ ...base, sale_price: 1200 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, variants: [base.variants[0], { ...base.variants[0], key: "2" }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, variants: [{ ...base.variants[0], options: {} }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, status: "published" }).success).toBe(false);
  });
});
