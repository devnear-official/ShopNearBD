import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, makeUser, orderPayload, sql, variantBySku } from "../support/db";

const skip = process.env.NO_TEST_DB === "1";
let admin: { id: string; email: string };
let customer: { id: string; email: string };

beforeAll(async () => {
  if (skip) return;
  admin = await makeUser("int-admin@test.local", true);
  customer = await makeUser("int-customer@test.local");
});
afterAll(async () => { await sql.end(); });

const place = (payload: unknown) => asRole("anon", {}, (tx) => tx<{ r: { order_id: string; order_number: string; total: number; duplicate: boolean } }[]>`select public.place_order(${tx.json(payload as never)}) as r`).then((r) => r[0].r);
const asAdmin = <T>(fn: Parameters<typeof asRole<T>>[2]) => asRole("authenticated", { sub: admin.id, email: admin.email }, fn);
const asCustomer = <T>(fn: Parameters<typeof asRole<T>>[2]) => asRole("authenticated", { sub: customer.id, email: customer.email }, fn);

describe.skipIf(skip)("row level security", () => {
  it("anonymous visitors see only published products", async () => {
    const [p] = await sql<{ id: string }[]>`select id from public.products where slug = 'fit-band-7'`;
    await sql`update public.products set status = 'draft' where id = ${p.id}`;
    const visible = await asRole("anon", {}, (tx) => tx`select slug from public.products`);
    expect(visible.map((r) => r.slug)).not.toContain("fit-band-7");
    const variants = await asRole("anon", {}, (tx) => tx`select 1 from public.product_variants where product_id = ${p.id}`);
    expect(variants).toHaveLength(0);
    await sql`update public.products set status = 'published' where id = ${p.id}`;
  });
  it("anonymous visitors cannot read orders, payments, chats or settings marked private", async () => {
    for (const t of ["orders", "payments", "order_items", "chat_messages", "audit_logs", "coupons"]) {
      await expect(asRole("anon", {}, (tx) => tx.unsafe(`select * from public.${t} limit 1`))).rejects.toThrow(/permission denied/);
    }
    const keys = await asRole("anon", {}, (tx) => tx<{ key: string }[]>`select key from public.site_settings`);
    expect(keys.map((k) => k.key)).not.toContain("ai");
  });
  it("signed-in customers cannot write the catalogue or read other people's orders", async () => {
    const changed = await asCustomer((tx) => tx`update public.products set price = 1 returning id`);
    expect(changed).toHaveLength(0);
    await expect(asCustomer((tx) => tx`insert into public.categories (slug, name) values ('hack', 'Hack')`)).rejects.toThrow(/row-level security/);
    const orders = await asCustomer((tx) => tx`select id from public.orders`);
    expect(orders).toHaveLength(0);
    await expect(asCustomer((tx) => tx`insert into public.user_roles (user_id, role) values (${customer.id}, 'admin')`)).rejects.toThrow();
  });
  it("admins can manage the catalogue", async () => {
    const r = await asAdmin((tx) => tx`update public.products set low_stock_threshold = low_stock_threshold where slug = 'fit-band-7' returning id`);
    expect(r).toHaveLength(1);
  });
});

describe.skipIf(skip)("checkout (place_order)", () => {
  it("prices from the database, applies coupon and delivery, ignores client totals", async () => {
    const v = await variantBySku("AUD-PULSE-PRO-MID");
    const r = await place({ ...orderPayload([{ variant_id: v.id, quantity: 2 }], { coupon_code: "welcome10" }), total: 1, subtotal: 1 });
    const [o] = await sql<{ subtotal: number; discount_total: number; shipping_fee: number; total: number }[]>`select subtotal, discount_total, shipping_fee, total from public.orders where id = ${r.order_id}`;
    // 5980 − 300 = 5680 ≥ ৳5,000 free-delivery threshold → no delivery fee
    expect(o).toEqual({ subtotal: 5980, discount_total: 300, shipping_fee: 0, total: 5680 });
    const [after] = await sql<{ stock: number }[]>`select stock from public.product_variants where id = ${v.id}`;
    expect(after.stock).toBe(v.stock - 2);
    const [m] = await sql<{ delta: number; reason: string }[]>`select delta, reason from public.inventory_movements where order_id = ${r.order_id}`;
    expect(m).toEqual({ delta: -2, reason: "order" });
  });
  it("outside Dhaka uses the default zone; free delivery over the threshold", async () => {
    const v = await variantBySku("BAG-SLING-BLK");
    const a = await place(orderPayload([{ variant_id: v.id, quantity: 1 }], { customer: { name: "Karim", phone: "01812345678", address: "Agrabad, Chattogram", district: "Chattogram" } }));
    const [o] = await sql<{ shipping_fee: number; zone: string }[]>`select shipping_fee, zone from public.orders where id = ${a.order_id}`;
    expect(o).toEqual({ shipping_fee: 130, zone: "outside_dhaka" });
    const b = await place(orderPayload([{ variant_id: v.id, quantity: 6 }], { customer: { name: "Karim", phone: "01812345678", address: "Agrabad, Chattogram", district: "Chattogram" } }));
    const [o2] = await sql<{ shipping_fee: number }[]>`select shipping_fee from public.orders where id = ${b.order_id}`;
    expect(o2.shipping_fee).toBe(0);
  });
  it("a repeated submission returns the original order instead of a duplicate", async () => {
    const v = await variantBySku("PWR-CABLE-C-1M");
    const payload = orderPayload([{ variant_id: v.id, quantity: 1 }]);
    const first = await place(payload);
    const second = await place(payload);
    expect(second).toMatchObject({ order_id: first.order_id, duplicate: true });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from public.orders where idempotency_key = ${payload.idempotency_key}`;
    expect(n).toBe(1);
    const [after] = await sql<{ stock: number }[]>`select stock from public.product_variants where id = ${v.id}`;
    expect(after.stock).toBe(v.stock - 1);
  });
  it.each([
    [{ customer: { name: "A", phone: "12345", address: "House 1, Road 2", district: "Dhaka" } }, "INVALID_PHONE"],
    [{ payment: { method: "card" } }, "PAYMENT_METHOD_UNAVAILABLE"],
    [{ coupon_code: "NOPE" }, "COUPON_INVALID"],
  ])("rejects bad input %#", async (over, code) => {
    const v = await variantBySku("LIFE-BOTTLE-750-BLU");
    await expect(place(orderPayload([{ variant_id: v.id, quantity: 1 }], over))).rejects.toThrow(code);
  });
  it("rejects out-of-stock and unpublished products", async () => {
    const sold = await variantBySku("WR-FITBAND-7-GRP"); // seeded with 0 stock
    await expect(place(orderPayload([{ variant_id: sold.id, quantity: 1 }]))).rejects.toThrow("OUT_OF_STOCK");
    const v = await variantBySku("HOME-GLOW-SNW");
    await sql`update public.products set status = 'draft' where id = ${v.product_id}`;
    await expect(place(orderPayload([{ variant_id: v.id, quantity: 1 }]))).rejects.toThrow("PRODUCT_UNAVAILABLE");
    await sql`update public.products set status = 'published' where id = ${v.product_id}`;
  });
  it("a bKash transaction ID can only be claimed once", async () => {
    const v = await variantBySku("LIFE-BOTTLE-750-ORG");
    const pay = { method: "bkash_manual", sender_number: "01711111111", transaction_id: "TRX12345AB" };
    const a = await place(orderPayload([{ variant_id: v.id, quantity: 1 }], { payment: pay }));
    const [o] = await sql<{ payment_status: string }[]>`select payment_status from public.orders where id = ${a.order_id}`;
    expect(o.payment_status).toBe("pending_verification");
    await expect(place(orderPayload([{ variant_id: v.id, quantity: 1 }], { payment: { ...pay, transaction_id: "trx12345ab" } }))).rejects.toThrow("TXID_USED");
  });
});

describe.skipIf(skip)("concurrent checkout", () => {
  it("never oversells: 12 buyers race for 3 units", async () => {
    const v = await variantBySku("WR-ORBIT-S2-OCN");
    await sql`update public.product_variants set stock = 3 where id = ${v.id}`;
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => place(orderPayload([{ variant_id: v.id, quantity: 1 }]))));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toBe(3);
    expect(failed.every((f) => /OUT_OF_STOCK/.test(String(f.reason)))).toBe(true);
    const [after] = await sql<{ stock: number }[]>`select stock from public.product_variants where id = ${v.id}`;
    expect(after.stock).toBe(0);
  });
});

describe.skipIf(skip)("order privacy", () => {
  it("order details need the secret token; wrong token and unknown number look identical", async () => {
    const v = await variantBySku("LIFE-BOTTLE-750-BLU");
    const r = await place(orderPayload([{ variant_id: v.id, quantity: 1 }], { access_token_hash: "b".repeat(64) }));
    const get = (n: string, h: string) => asRole("anon", {}, (tx) => tx<{ o: Record<string, unknown> | null }[]>`select public.get_order_public(${n}, ${h}) as o`).then((x) => x[0].o);
    expect(await get(r.order_number, "c".repeat(64))).toBeNull();
    expect(await get("SN00000000000", "b".repeat(64))).toBeNull();
    const o = await get(r.order_number, "b".repeat(64));
    expect(o).toMatchObject({ order_number: r.order_number, phone_masked: "017*****678" });
    expect(JSON.stringify(o)).not.toContain("01712345678");
    expect(o).not.toHaveProperty("internal_note");
  });
});

describe.skipIf(skip)("admin operations", () => {
  it("non-admins are refused by privileged functions", async () => {
    await expect(asCustomer((tx) => tx`select public.admin_dashboard(now() - interval '1 day', now())`)).rejects.toThrow("FORBIDDEN");
    const [o] = await sql<{ id: string }[]>`select id from public.orders limit 1`;
    await expect(asCustomer((tx) => tx`select public.admin_transition_order(${o.id}, 'confirmed', null, true)`)).rejects.toThrow("FORBIDDEN");
    await expect(asRole("anon", {}, (tx) => tx`select public.system_transition_order(${o.id}, 'delivered', 'x')`)).rejects.toThrow(/permission denied/);
    await expect(asRole("anon", {}, (tx) => tx`select public.rate_limit_hit('x', 60, 1)`)).rejects.toThrow(/permission denied/);
  });
  it("enforces the status machine, restocks and releases the coupon on cancel", async () => {
    const v = await variantBySku("AUD-BASSBOX-NVY");
    const r = await place(orderPayload([{ variant_id: v.id, quantity: 2 }], { coupon_code: "WELCOME10", customer: { name: "Chandra", phone: "01912345678", address: "House 9, Road 9, Uttara", district: "Dhaka" } }));
    const [c0] = await sql<{ used_count: number }[]>`select used_count from public.coupons where code = 'WELCOME10'`;
    await expect(asAdmin((tx) => tx`select public.admin_transition_order(${r.order_id}, 'delivered', null, true)`)).rejects.toThrow("INVALID_TRANSITION");
    await asAdmin((tx) => tx`select public.admin_transition_order(${r.order_id}, 'cancelled', 'customer changed mind', true)`);
    const [after] = await sql<{ stock: number }[]>`select stock from public.product_variants where id = ${v.id}`;
    expect(after.stock).toBe(v.stock);
    const [c1] = await sql<{ used_count: number }[]>`select used_count from public.coupons where code = 'WELCOME10'`;
    expect(c1.used_count).toBe(c0.used_count - 1);
    const [h] = await sql<{ actor_label: string; note: string }[]>`select actor_label, note from public.order_status_history where order_id = ${r.order_id} order by id desc limit 1`;
    expect(h).toEqual({ actor_label: admin.email, note: "customer changed mind" });
    await expect(asAdmin((tx) => tx`select public.admin_transition_order(${r.order_id}, 'confirmed', null, true)`)).rejects.toThrow("INVALID_TRANSITION");
  });
  it("payment verification and refunds are bounded and audited", async () => {
    const v = await variantBySku("LIFE-AIRLOOP-CLD");
    const r = await place(orderPayload([{ variant_id: v.id, quantity: 1 }], { payment: { method: "nagad_manual", sender_number: "01722222222", transaction_id: "NGD7788XYZ" } }));
    const [p] = await sql<{ id: string }[]>`select id from public.payments where order_id = ${r.order_id}`;
    await asAdmin((tx) => tx`select public.admin_verify_payment(${p.id}, true, 'matched statement')`);
    await expect(asAdmin((tx) => tx`select public.admin_verify_payment(${p.id}, false, 'again')`)).rejects.toThrow("PAYMENT_ALREADY_REVIEWED");
    const [o] = await sql<{ payment_status: string; total: number }[]>`select payment_status, total from public.orders where id = ${r.order_id}`;
    expect(o.payment_status).toBe("paid");
    await expect(asAdmin((tx) => tx`select public.admin_record_refund(${r.order_id}, ${o.total + 1}, 'too much')`)).rejects.toThrow("REFUND_EXCEEDS_PAID");
    await asAdmin((tx) => tx`select public.admin_record_refund(${r.order_id}, 100, 'partial refund for scratch')`);
    const [o2] = await sql<{ payment_status: string }[]>`select payment_status from public.orders where id = ${r.order_id}`;
    expect(o2.payment_status).toBe("partially_refunded");
    const audits = await sql<{ action: string }[]>`select action from public.audit_logs where entity_id in (${p.id}, ${r.order_id})`;
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["payment.verify", "payment.refund"]));
  });
  it("stock adjustments cannot go negative", async () => {
    const v = await variantBySku("HOME-BREW-18-STD");
    await expect(asAdmin((tx) => tx`select public.admin_adjust_stock(${v.id}, ${-(v.stock + 1)}, 'adjustment', 'x')`)).rejects.toThrow("STOCK_NEGATIVE");
    const [{ s }] = await asAdmin((tx) => tx<{ s: number }[]>`select public.admin_adjust_stock(${v.id}, 5, 'restock', 'delivery from supplier') as s`);
    expect(s).toBe(v.stock + 5);
  });
});
