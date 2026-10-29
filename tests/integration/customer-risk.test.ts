import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, makeUser, orderPayload, sql, variantBySku } from "../support/db";

const skip = process.env.NO_TEST_DB === "1";
let admin: { id: string; email: string };
let shopper: { id: string; email: string };
const PHONE = "01955500123";

beforeAll(async () => {
  if (skip) return;
  admin = await makeUser("risk-admin@test.local", true);
  shopper = await makeUser("risk-shopper@test.local");
  await sql`delete from public.orders where phone = ${PHONE}`;
});
afterAll(async () => { await sql.end(); });

const asAdmin = <T>(fn: Parameters<typeof asRole<T>>[2]) => asRole("authenticated", { sub: admin.id, email: admin.email }, fn);
const asShopper = <T>(fn: Parameters<typeof asRole<T>>[2]) => asRole("authenticated", { sub: shopper.id, email: shopper.email }, fn);
const place = async () => {
  const v = await variantBySku("BOTTLE-750-BLU").catch(() => undefined) ?? (await sql<{ id: string }[]>`select id from public.product_variants where stock > 5 limit 1`)[0];
  const payload = orderPayload([{ variant_id: v.id, quantity: 1 }], { customer: { name: "Risk Tester", phone: PHONE, address: "House 9, Road 4, Dhanmondi", district: "Dhaka", zone: "inside_dhaka" } });
  const [r] = await asRole("anon", {}, (tx) => tx<{ r: { order_id: string } }[]>`select public.place_order(${tx.json(payload as never)}) as r`);
  return r.r.order_id;
};
const stats = async () => (await sql<{ orders: number; delivered: number; cancelled: number; spent: number }[]>`select orders, delivered, cancelled, spent from public.customer_stats where phone = ${PHONE}`)[0];

describe.skipIf(skip)("customer_stats and customer_risk", () => {
  it("customer_stats follows orders as they are placed and finish", async () => {
    const a = await place();
    const b = await place();
    expect(await stats()).toMatchObject({ orders: 2, delivered: 0, cancelled: 0 });
    await sql`update public.orders set status = 'delivered' where id = ${a}`;
    await sql`update public.orders set status = 'cancelled' where id = ${b}`;
    const s = await stats();
    expect(s).toMatchObject({ orders: 2, delivered: 1, cancelled: 1 });
    expect(Number(s.spent)).toBeGreaterThan(0);
  });

  it("counts orders placed at the same moment", async () => {
    await Promise.all([place(), place(), place()]);
    expect((await stats()).orders).toBe(5);
  });

  it("customer_risk returns the history for admins only", async () => {
    const r = await asAdmin((tx) => tx<{ r: { orders: number; delivered: number; cancelled: number; couriers: unknown[] } }[]>`select public.customer_risk(${PHONE}) as r`).then((x) => x[0].r);
    expect(r).toMatchObject({ orders: 5, delivered: 1, cancelled: 1 });
    expect(r.couriers).toEqual([]);
    await expect(asShopper((tx) => tx`select public.customer_risk(${PHONE})`)).rejects.toThrow("FORBIDDEN");
    await expect(asRole("anon", {}, (tx) => tx`select public.customer_risk(${PHONE})`)).rejects.toThrow();
  });

  it("per-courier results come from non-sandbox shipments of that phone's orders", async () => {
    const [o, other] = await sql<{ id: string }[]>`select id from public.orders where phone = ${PHONE} order by (status = 'delivered') desc, created_at limit 2`;
    const rec = { name: "Risk Tester", phone: PHONE };
    await sql`insert into public.shipments (order_id, provider, status, idempotency_key, recipient) values (${o.id}, 'steadfast', 'delivered', ${"risk-" + Math.random()}, ${sql.json(rec)})`;
    await sql`insert into public.shipments (order_id, provider, is_sandbox, status, idempotency_key, recipient) values (${other.id}, 'sandbox', true, 'delivered', ${"risk-" + Math.random()}, ${sql.json(rec)})`;
    const r = await asAdmin((tx) => tx<{ r: { couriers: { provider: string; total: number; delivered: number }[] } }[]>`select public.customer_risk(${PHONE}) as r`).then((x) => x[0].r);
    expect(r.couriers).toEqual([expect.objectContaining({ provider: "steadfast", total: 1, delivered: 1 })]);
  });

  it("non-admins cannot read customer_stats", async () => {
    expect(await asShopper((tx) => tx`select * from public.customer_stats`)).toHaveLength(0);
    expect((await asAdmin((tx) => tx`select * from public.customer_stats where phone = ${PHONE}`))).toHaveLength(1);
  });
});
