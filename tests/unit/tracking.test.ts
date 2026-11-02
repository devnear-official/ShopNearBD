import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bdE164Digits, hashedIdentity } from "@/lib/tracking/hash";
import { GA4_EVENT, RELAYABLE, channelOf, ga4Params, metaCustomData, tiktokEventName, tiktokProperties } from "@/lib/tracking/events";
import { buildAttribution } from "@/lib/tracking/attribution";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const ctx = { ip: "103.4.5.6", userAgent: "UA", fbp: "fb.1.1.2", fbc: null, ttp: "ttp1", ttclid: null, url: "https://shop.example/checkout", referrer: null };

describe("customer identity hashing", () => {
  it("normalises Bangladeshi numbers to country-code digits", () => {
    expect(bdE164Digits("01712345678")).toBe("8801712345678");
    expect(bdE164Digits("+880 1712-345678")).toBe("8801712345678");
    expect(bdE164Digits("8801712345678")).toBe("8801712345678");
    expect(bdE164Digits("0171234")).toBeNull();
    expect(bdE164Digits(null)).toBeNull();
  });

  it("hashes in each platform's documented format", () => {
    const id = hashedIdentity({ phone: "01712345678", email: " Rahim@Example.COM ", name: "Rahim  Uddin Khan", district: "Cox's Bazar" });
    expect(id.meta.ph).toEqual([sha("8801712345678")]);
    expect(id.meta.em).toEqual([sha("rahim@example.com")]);
    expect(id.meta.fn).toEqual([sha("rahim")]);
    expect(id.meta.ln).toEqual([sha("khan")]);
    expect(id.meta.ct).toEqual([sha("coxsbazar")]);
    expect(id.meta.country).toEqual([sha("bd")]);
    // TikTok wants E.164 with the plus sign.
    expect(id.tiktok.phone).toBe(sha("+8801712345678"));
    expect(id.tiktok.email).toBe(sha("rahim@example.com"));
    // No raw personal data anywhere in the output.
    expect(JSON.stringify(id)).not.toMatch(/rahim|01712345678/i);
  });
});

describe("event mapping", () => {
  it("never relays Purchase from the browser (it is sent from the stored order), but does relay PageView and Contact", () => {
    expect(RELAYABLE).not.toContain("Purchase");
    expect(RELAYABLE).toContain("PageView");
    expect(RELAYABLE).toContain("Contact");
  });
  it("has a GA4 name and a TikTok name for every event it sends", () => {
    expect(GA4_EVENT.Purchase).toBe("purchase");
    expect(GA4_EVENT.AddToCart).toBe("add_to_cart");
    expect(ga4Params({ value: 100, orderId: "SN1", items: [{ id: "SKU1", quantity: 2, price: 50 }] })).toEqual({ currency: "BDT", value: 100, transaction_id: "SN1", items: [{ item_id: "SKU1", price: 50, quantity: 2 }] });
    expect(tiktokEventName("Contact")).toBe("Contact");
  });

  it("maps names for TikTok", () => {
    expect(tiktokEventName("PageView")).toBeNull();
    expect(tiktokEventName("Purchase")).toBe("Purchase");
    expect(tiktokEventName("Purchase", "CompletePayment")).toBe("CompletePayment");
    expect(tiktokEventName("AddToCart")).toBe("AddToCart");
  });

  it("builds content data with SKUs as content IDs", () => {
    const p = { value: 1780, items: [{ id: "AUD-1-BLK", name: "Earbuds", quantity: 2, price: 890 }], orderId: "SN1" };
    expect(metaCustomData(p)).toMatchObject({ currency: "BDT", value: 1780, content_ids: ["AUD-1-BLK"], content_type: "product", num_items: 2, order_id: "SN1", contents: [{ id: "AUD-1-BLK", quantity: 2, item_price: 890 }] });
    expect(tiktokProperties(p)).toMatchObject({ currency: "BDT", value: 1780, content_type: "product", contents: [{ content_id: "AUD-1-BLK", quantity: 2, price: 890 }] });
    expect(metaCustomData({ search: "fan" })).toEqual({ search_string: "fan" });
  });
});

describe("attribution", () => {
  it("classifies channels", () => {
    expect(channelOf({ fbclid: "x" })).toBe("facebook");
    expect(channelOf({ utm_source: "ig" })).toBe("facebook");
    expect(channelOf({ ttclid: "x" })).toBe("tiktok");
    expect(channelOf({ utm_source: "TikTok" })).toBe("tiktok");
    expect(channelOf({ referrer: "https://www.google.com/" })).toBe("google");
    expect(channelOf({ utm_source: "newsletter" })).toBe("newsletter");
    expect(channelOf({ referrer: "https://blog.example" })).toBe("referral");
    expect(channelOf({})).toBe("direct");
  });

  it("keeps only known keys and derives fbc from fbclid", () => {
    const a = buildAttribution({ utm_source: "facebook", utm_campaign: "eid", fbclid: "ABC", evil: "<script>", landing: 5 }, ctx);
    expect(a).toMatchObject({ utm_source: "facebook", utm_campaign: "eid", fbclid: "ABC", fbp: "fb.1.1.2", ttp: "ttp1", ip: "103.4.5.6", channel: "facebook" });
    expect(a.fbc).toMatch(/^fb\.1\.\d+\.ABC$/);
    expect(a).not.toHaveProperty("evil");
    expect(a).not.toHaveProperty("landing");
  });

  it("prefers the real _fbc cookie when present", () => {
    expect(buildAttribution({ fbclid: "ABC" }, { ...ctx, fbc: "fb.1.99.REAL" }).fbc).toBe("fb.1.99.REAL");
  });
});
