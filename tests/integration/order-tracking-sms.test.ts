import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, makeUser, orderPayload, sql, variantBySku } from "../support/db";
import { sha256 } from "../../src/lib/tokens";

const skip = process.env.NO_TEST_DB === "1";
const token = "t".repeat(32);
const phone = "01955123456";

beforeAll(() => {
  process.env.SMS_PROVIDER = "console";
  process.env.APP_SECRET = process.env.APP_SECRET || "x".repeat(40);
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.test";
});
afterAll(async () => { await sql.end(); });

async function newOrder() {
  const v = await sql<{ sku: string }[]>`select sku from public.product_variants where stock > 5 and is_active limit 1`;
  const variant = await variantBySku(v[0].sku);
  const payload = orderPayload([{ variant_id: variant.id, quantity: 1 }], { access_token_hash: sha256(token) });
  (payload.customer as Record<string, string>).phone = phone;
  const [r] = await asRole("anon", {}, (tx) => tx<{ r: { order_id: string; order_number: string } }[]>`select public.place_order(${tx.json(payload as never)}) as r`);
  return r.r;
}

describe.skipIf(skip)("order SMS", () => {
  it("sends each event once, only for states that are really saved, and ends with a signed link", async () => {
    const { notifyOrderEvent } = await import("@/lib/order-sms");
    const { trackSig } = await import("@/lib/customer/order-access");
    const o = await newOrder();

    expect(await notifyOrderEvent(o.order_id, "placed")).toBe("sent");
    expect(await notifyOrderEvent(o.order_id, "placed")).toBe("duplicate");
    // The order is still pending: nothing may claim it shipped or was delivered.
    expect(await notifyOrderEvent(o.order_id, "shipped")).toBe("skipped");
    expect(await notifyOrderEvent(o.order_id, "delivered")).toBe("skipped");
    expect(await notifyOrderEvent(o.order_id, "processing")).toBe("skipped");

    const [sms] = await sql<{ body: string }[]>`select body from public.dev_sms_outbox where phone = ${phone} order by id desc limit 1`;
    expect(sms.body.endsWith(`https://shop.test/order/${o.order_number}?s=${trackSig(o.order_number)}`)).toBe(true);
    expect(sms.body).toContain(o.order_number);

    const admin = await makeUser("sms-admin@example.com", true);
    await asRole("authenticated", { sub: admin.id, email: admin.email }, (tx) => tx`select public.admin_transition_order(${o.order_id}, 'confirmed', null, true)`);
    expect(await notifyOrderEvent(o.order_id, "confirmed")).toBe("sent");
    expect(await notifyOrderEvent(o.order_id, "confirmed")).toBe("duplicate");

    const rows = await sql<{ event: string; status: string }[]>`select event, status from public.order_sms where order_id = ${o.order_id} order by id`;
    expect(rows).toEqual([{ event: "placed", status: "sent" }, { event: "confirmed", status: "sent" }]);
  });

  it("only announces 'processing' after the team published it", async () => {
    const { notifyOrderEvent } = await import("@/lib/order-sms");
    const o = await newOrder();
    const admin = await makeUser("sms-admin@example.com", true);
    await asRole("authenticated", { sub: admin.id, email: admin.email }, (tx) => tx`select public.admin_transition_order(${o.order_id}, 'confirmed', null, true)`);
    expect(await notifyOrderEvent(o.order_id, "processing")).toBe("skipped");
    await asRole("authenticated", { sub: admin.id, email: admin.email }, (tx) => tx`insert into public.order_updates (order_id, stage, message, actor_id, actor_label) values (${o.order_id}, 'processing', 'Packing now', ${admin.id}, 'admin')`);
    expect(await notifyOrderEvent(o.order_id, "processing")).toBe("sent");
  });
});

describe.skipIf(skip)("customer tracking data and access", () => {
  it("shows posted updates and courier details only with the right token, never to anon via the tables", async () => {
    const o = await newOrder();
    const admin = await makeUser("sms-admin@example.com", true);
    await asRole("authenticated", { sub: admin.id, email: admin.email }, async (tx) => {
      await tx`insert into public.order_updates (order_id, stage, message, actor_id, actor_label) values (${o.order_id}, 'info', 'Delayed by rain', ${admin.id}, 'admin')`;
      await tx`insert into public.shipments (order_id, provider, status, idempotency_key, courier_name, tracking_code, recipient, cod_amount) values (${o.order_id}, 'manual', 'created', ${"k" + o.order_id}, 'Sundarban', 'SB-77', '{}'::jsonb, 0)`;
    });
    const view = await asRole("anon", {}, (tx) => tx<{ o: { updates: { message: string }[]; shipment: { courier_name: string; tracking_code: string }; updated_at: string } | null }[]>`select public.get_order_public(${o.order_number}, ${sha256(token)}) as o`);
    expect(view[0].o?.updates[0].message).toBe("Delayed by rain");
    expect(view[0].o?.shipment).toMatchObject({ courier_name: "Sundarban", tracking_code: "SB-77" });
    expect(view[0].o?.updated_at).toBeTruthy();

    const wrong = await asRole("anon", {}, (tx) => tx`select public.get_order_public(${o.order_number}, ${sha256("nope")}) as o`);
    expect(wrong[0].o).toBeNull();
    // Internal tables stay closed to the public API role.
    await expect(asRole("anon", {}, (tx) => tx`select * from public.order_updates`)).rejects.toThrow(/permission denied/);
    await expect(asRole("anon", {}, (tx) => tx`select * from public.order_sms`)).rejects.toThrow(/permission denied/);
  });

  it("signed links verify only for the right order; an order number alone never resolves", async () => {
    const { resolveOrderHash, trackSig } = await import("@/lib/customer/order-access");
    const o = await newOrder();
    const [row] = await sql<{ h: string }[]>`select access_token_hash as h from public.orders where order_number = ${o.order_number}`;
    expect(await resolveOrderHash(o.order_number, { s: trackSig(o.order_number) })).toBe(row.h);
    expect(await resolveOrderHash(o.order_number, { s: trackSig("SN00000000000") })).toBeNull();
    expect(await resolveOrderHash(o.order_number, { s: "a".repeat(22) })).toBeNull();
    expect(await resolveOrderHash(o.order_number, { t: token })).toBe(sha256(token));
  });
});

describe.skipIf(skip)("chat order answers", () => {
  it("refuses a bare order number, accepts the browser token, and gives phone-only users no private link", async () => {
    const { answerOrderQuestion } = await import("@/lib/ai/order-lookup");
    const o = await newOrder();
    const base = { ipHash: "chat-test-" + Math.random(), bangla: false, customerPhone: null as string | null };

    const bare = await answerOrderQuestion({ ...base, text: `Where is ${o.order_number}?`, recentUserText: `Where is ${o.order_number}?`, tokens: [] });
    expect(bare.text).toMatch(/couldn't verify/i);
    expect(bare.text).not.toContain(o.order_number + " —");
    expect(bare.text).not.toMatch(/\?s=/);

    const wrongPhone = await answerOrderQuestion({ ...base, text: "x", recentUserText: `${o.order_number} 01999999999`, tokens: [] });
    expect(wrongPhone.text).toMatch(/couldn't verify/i);

    const byPhone = await answerOrderQuestion({ ...base, text: "x", recentUserText: `${o.order_number} my phone is ${phone}`, tokens: [] });
    expect(byPhone.text).toContain("Order received");
    expect(byPhone.text).not.toMatch(/\?s=|\?t=/);
    expect(byPhone.text).toContain("https://shop.test/order");
    expect(byPhone.text).not.toContain(phone);

    const owner = await answerOrderQuestion({ ...base, text: "x", recentUserText: `Where is ${o.order_number}`, tokens: [{ number: o.order_number, token }] });
    expect(owner.text).toContain("Order received");
    expect(owner.text).toMatch(/Track Order: https:\/\/shop\.test\/order\/SN\d{11}\?s=/);
    expect(owner.text).toMatch(/invoice/i);
    expect(owner.text).not.toContain("Dhanmondi");
    expect(owner.text).not.toContain(phone);
    expect(owner.text).toMatch(/Last updated/);
  });
});

describe.skipIf(skip)("COD collection", () => {
  it("does not call a part-collected order 'refunded', and marks paid only when fully collected", async () => {
    const o = await newOrder();
    const [{ total }] = await sql<{ total: number }[]>`select total from public.orders where id = ${o.order_id}`;
    const admin = await makeUser("sms-admin@example.com", true);
    const as = <T,>(fn: (tx: Parameters<Parameters<typeof asRole>[2]>[0]) => Promise<T>) => asRole("authenticated", { sub: admin.id, email: admin.email }, fn);
    await as((tx) => tx`select public.admin_record_cod(${o.order_id}, ${total - 10}, 'part')`);
    expect((await sql<{ s: string }[]>`select payment_status as s from public.orders where id = ${o.order_id}`)[0].s).toBe("unpaid");
    await expect(as((tx) => tx`select public.admin_record_cod(${o.order_id}, ${total}, 'too much')`)).rejects.toThrow(/INVALID_AMOUNT/);
    await as((tx) => tx`select public.admin_record_cod(${o.order_id}, 10, 'rest')`);
    expect((await sql<{ s: string }[]>`select payment_status as s from public.orders where id = ${o.order_id}`)[0].s).toBe("paid");
  });
});
