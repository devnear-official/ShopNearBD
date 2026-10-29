import "server-only";
import { system } from "../db";

export type CustomerOrder = { order_number: string; status: string; payment_status: string; payment_method: string; total: number; created_at: Date; item_count: number; first_item: string | null; image_url: string | null };
export type CustomerStats = { orders: number; active: number; delivered: number; spent: number; delivered_value: number; first_order: Date | null };

/** Every order placed with this phone number, newest first, plus totals. */
export async function customerOrders(phone: string): Promise<{ orders: CustomerOrder[]; stats: CustomerStats; last: { name: string; email: string | null; district: string; zone: string; area: string | null; address: string } | null }> {
  return system(async (tx) => {
    const orders = await tx<CustomerOrder[]>`
      select o.order_number, o.status, o.payment_status, o.payment_method, o.total, o.created_at,
        (select coalesce(sum(quantity), 0)::int from public.order_items i where i.order_id = o.id) as item_count,
        (select product_name from public.order_items i where i.order_id = o.id order by line_total desc limit 1) as first_item,
        (select image_url from public.order_items i where i.order_id = o.id order by line_total desc limit 1) as image_url
      from public.orders o where o.phone = ${phone} order by o.created_at desc limit 100`;
    const [stats] = await tx<CustomerStats[]>`
      select count(*)::int as orders,
        count(*) filter (where status in ('pending', 'confirmed', 'packed', 'shipped'))::int as active,
        count(*) filter (where status = 'delivered')::int as delivered,
        coalesce(sum(total) filter (where status not in ('cancelled', 'returned')), 0)::numeric as spent,
        coalesce(sum(total) filter (where status = 'delivered'), 0)::numeric as delivered_value,
        min(created_at) as first_order
      from public.orders where phone = ${phone}`;
    const [last] = await tx<{ name: string; email: string | null; district: string; zone: string; area: string | null; address: string }[]>`
      select customer_name as name, email, district, zone, area, address from public.orders where phone = ${phone} order by created_at desc limit 1`;
    return {
      orders: orders.map((o) => ({ ...o, total: Number(o.total) })),
      stats: { ...stats, spent: Number(stats.spent), delivered_value: Number(stats.delivered_value) },
      last: last ?? null,
    };
  });
}
