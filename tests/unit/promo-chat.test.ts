import { describe, expect, it } from "vitest";
import { isSafeCustomLink, resolveLink, validateTarget } from "@/lib/promo";
import { extractOrderNumbers, extractPhones } from "@/lib/ai/order-lookup";
import { renderSms } from "@/lib/order-sms";
import { messengerLink } from "@/lib/social";

describe("promotion links", () => {
  it("maps each destination type to a real route", () => {
    expect(resolveLink("product", "pulse-anc-earbuds-pro")).toBe("/shop/pulse-anc-earbuds-pro");
    expect(resolveLink("category", "bags")).toBe("/shop?category=bags");
    expect(resolveLink("campaign", "commute-kit")).toBe("/shop?collection=commute-kit");
    expect(resolveLink("deals", null)).toBe("/shop?sort=discount");
    expect(resolveLink("custom", "/help#faq")).toBe("/help#faq");
    expect(resolveLink("custom", "https://example.com/x")).toBe("https://example.com/x");
  });
  it("refuses unsafe or malformed targets", () => {
    for (const bad of ["javascript:alert(1)", "//evil.com", "http://insecure.example", "data:text/html,x", "/\\evil.com", ""]) {
      expect(isSafeCustomLink(bad)).toBe(false);
      expect(resolveLink("custom", bad)).toBeNull();
    }
    expect(resolveLink("product", "Not A Slug")).toBeNull();
    expect(resolveLink("category", "../admin")).toBeNull();
    expect(validateTarget("campaign", "")).toMatch(/where/i);
    expect(validateTarget("deals", "")).toBeNull();
  });
});

describe("messenger link", () => {
  it("accepts only https Messenger/Facebook hosts", () => {
    expect(messengerLink("https://m.me/shopnearbd")).toBe("https://m.me/shopnearbd");
    expect(messengerLink("https://www.facebook.com/shopnearbd")).toContain("facebook.com");
    expect(messengerLink("javascript:alert(1)")).toBeNull();
    expect(messengerLink("http://m.me/x")).toBeNull();
    expect(messengerLink("https://evil.example/m.me")).toBeNull();
    expect(messengerLink("")).toBeNull();
  });
});

describe("chat order detection", () => {
  it("finds order numbers and phones in English, Bangla digits and mixed text", () => {
    expect(extractOrderNumbers("My order number is sn20261102001. Where is it? Also SN20261102002")).toEqual(["SN20261102001", "SN20261102002"]);
    expect(extractOrderNumbers("order SN123")).toEqual([]);
    expect(extractPhones("phone 01712-345678")).toEqual(["01712345678"]);
    expect(extractPhones("+8801712345678 and ০১৮১২৩৪৫৬৭৮")).toEqual(["01712345678", "01812345678"]);
    expect(extractPhones("12345")).toEqual([]);
  });
});

describe("sms rendering", () => {
  it("fills placeholders and always ends with the track link", () => {
    const s = renderSms("Hi {name}, order {order} shipped. {link}", { name: "Rahim Uddin", order: "SN20261102001", link: "https://x.test/order/SN20261102001?s=abc" });
    expect(s).toBe("Hi Rahim, order SN20261102001 shipped. Track: https://x.test/order/SN20261102001?s=abc");
    expect(s.endsWith("?s=abc")).toBe(true);
  });
});
