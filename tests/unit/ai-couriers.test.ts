import { describe, expect, it } from "vitest";
import { classify, extractBudget, searchTerms } from "@/lib/ai/intent";
import { fallbackReply, contextBlock, systemPrompt } from "@/lib/ai/prompt";
import { mapSteadfast } from "@/lib/couriers/steadfast";
import { mapPathao } from "@/lib/couriers/pathao";
import { mapRedx } from "@/lib/couriers/redx";
import { sandbox } from "@/lib/couriers/sandbox";
import { CourierError } from "@/lib/couriers/types";

describe("intent classification (Bangla / Banglish / English)", () => {
  it.each([
    ["Where is my order?", "order_status"], ["amar order kothay?", "order_status"], ["আমার অর্ডার কোথায়", "order_status"],
    ["delivery charge koto?", "shipping"], ["ঢাকার বাইরে ডেলিভারি চার্জ কত", "shipping"],
    ["bkash e payment kivabe?", "payment"], ["বিকাশে পেমেন্ট", "payment"],
    ["I want a refund", "returns"], ["product ferot dibo", "returns"],
    ["talk to a human", "human"], ["মানুষের সাথে কথা বলতে চাই", "human"],
    ["power bank er dam koto?", "product"], ["hello", "greeting"],
  ])("%s → %s", (msg, intent) => expect(classify(msg)).toBe(intent));
  it("extracts budgets", () => {
    expect(extractBudget("earbuds under 3000")).toBe(3000);
    expect(extractBudget("৩০০০ টাকার মধ্যে earbuds")).toBe(3000);
    expect(extractBudget("2k er moddhe")).toBe(2000);
    expect(extractBudget("best earbuds")).toBeNull();
  });
  it("drops filler words", () => expect(searchTerms("power bank er dam koto?")).toBe("power bank"));
});

describe("grounding prompt", () => {
  const ctx = { intent: "product" as const, products: [{ name: "X", url: "/shop/x", price: 100, was: null, in_stock: true, stock_note: "in stock", variants: [], summary: "", specs: [] }], faqs: [], policies: {}, orders: [], ordersRequested: false };
  it("delimits store data and forbids invented facts and actions", () => {
    const p = systemPrompt("ShopNear BD");
    expect(p).toMatch(/Use ONLY the data inside <store_data>/);
    expect(p).toMatch(/cannot confirm orders, verify payments, issue refunds/);
    expect(p).toMatch(/Never ask for or accept OTPs, PINs or passwords/);
    expect(contextBlock(ctx)).toMatch(/^<store_data>\n\{.*\}\n<\/store_data>$/s);
  });
  it("fallback lists real products and never invents order data", () => {
    expect(fallbackReply(ctx, false)).toContain("[X](/shop/x) — ৳100");
    expect(fallbackReply({ ...ctx, intent: "order_status", products: [], ordersRequested: true }, false)).toMatch(/privacy/);
  });
});

describe("courier status mapping", () => {
  it("steadfast", () => {
    expect(mapSteadfast("delivered_approval_pending")).toBe("delivered");
    expect(mapSteadfast("partial_delivered")).toBe("partial_delivered");
    expect(mapSteadfast("cancelled")).toBe("returned");
    expect(mapSteadfast("in_review")).toBe("in_transit");
  });
  it("pathao & redx", () => {
    expect(mapPathao("Pickup_Requested")).toBe("picked_up");
    expect(mapPathao("Delivered")).toBe("delivered");
    expect(mapPathao("Delivery_Failed")).toBe("in_transit");
    expect(mapPathao("Return")).toBe("returned");
    expect(mapRedx("Delivered")).toBe("delivered");
    expect(mapRedx("pickup-pending")).toBe("picked_up");
  });
  it("sandbox simulates retryable failures", async () => {
    const input = { invoice: "SN1", recipientName: "A", recipientPhone: "01712345678", address: "FAIL street", area: null, district: "Dhaka", codAmount: 100, note: null, itemCount: 1, itemDescription: "x", weightKg: 0.5 };
    await expect(sandbox.createShipment(input)).rejects.toMatchObject({ retryable: true });
    const ok = await sandbox.createShipment({ ...input, address: "Road 1" });
    expect(ok.consignmentId).toMatch(/^SBX-/);
    expect(new CourierError("x", false, 401).status).toBe(401);
  });
});
