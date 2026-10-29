import { describe, expect, it } from "vitest";
import { compareAtPrice, couponDiscount, unitPrice } from "@/lib/pricing";
import { quoteShipping, zonesForDistrict, DISTRICTS, type ShippingSettings } from "@/lib/shipping";
import { formatTaka, percentOff } from "@/lib/format";

describe("unit price (mirrors public.variant_unit_price)", () => {
  const product = { price: 1000, sale_price: 800 };
  it("uses the product sale price when the variant has no override", () => {
    expect(unitPrice(product, { price: null, sale_price: null })).toBe(800);
    expect(compareAtPrice(product, { price: null, sale_price: null })).toBe(1000);
  });
  it("a variant price override ignores the product sale price", () => {
    expect(unitPrice(product, { price: 1200, sale_price: null })).toBe(1200);
    expect(compareAtPrice(product, { price: 1200, sale_price: null })).toBeNull();
  });
  it("variant sale price wins", () => {
    expect(unitPrice(product, { price: 1200, sale_price: 900 })).toBe(900);
    expect(unitPrice({ price: 1000, sale_price: null }, { price: null, sale_price: 700 })).toBe(700);
  });
});

describe("coupon discount", () => {
  it("percent, rounded to whole taka and capped", () => {
    expect(couponDiscount({ type: "percent", value: 10, max_discount: null }, 1995)).toBe(200);
    expect(couponDiscount({ type: "percent", value: 10, max_discount: 150 }, 5000)).toBe(150);
  });
  it("never exceeds the subtotal", () => {
    expect(couponDiscount({ type: "fixed", value: 500, max_discount: null }, 300)).toBe(300);
  });
});

describe("shipping", () => {
  const s: ShippingSettings = {
    zones: [{ id: "inside_dhaka", label: "Inside", fee: 70 }, { id: "dhaka_suburbs", label: "Suburbs", fee: 100 }, { id: "outside_dhaka", label: "Outside", fee: 130 }],
    district_zones: { Dhaka: ["inside_dhaka", "dhaka_suburbs"], Gazipur: ["dhaka_suburbs"] },
    default_zone: "outside_dhaka",
    free_shipping_threshold: 5000,
  };
  it("has all 64 districts", () => expect(DISTRICTS).toHaveLength(64));
  it("maps districts to zones with a default", () => {
    expect(zonesForDistrict(s, "Dhaka").map((z) => z.id)).toEqual(["inside_dhaka", "dhaka_suburbs"]);
    expect(zonesForDistrict(s, "Sylhet").map((z) => z.id)).toEqual(["outside_dhaka"]);
  });
  it("honours a valid zone hint and ignores an invalid one", () => {
    expect(quoteShipping(s, "Dhaka", "dhaka_suburbs", 100)?.fee).toBe(100);
    expect(quoteShipping(s, "Gazipur", "inside_dhaka", 100)?.zone.id).toBe("dhaka_suburbs");
  });
  it("free delivery above the threshold", () => {
    expect(quoteShipping(s, "Khulna", null, 5000)?.fee).toBe(0);
    expect(quoteShipping(s, "Khulna", null, 4999)?.fee).toBe(130);
  });
});

describe("formatting", () => {
  it("uses South Asian grouping and the taka sign", () => {
    expect(formatTaka(123450)).toBe("৳1,23,450");
    expect(formatTaka(null)).toBe("৳—");
  });
  it("percent off", () => {
    expect(percentOff(3490, 2990)).toBe(14);
    expect(percentOff(100, 100)).toBeNull();
  });
});
