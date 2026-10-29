import "server-only";
import { cacheLife } from "next/cache";
import { sql } from "./db";

/**
 * Analytics for the last `range` days. Computed from every order in the window, so on a large
 * store it is the heaviest query set in the admin; the result is shared and refreshed every minute
 * instead of being recomputed on every visit. Callers must have passed the admin check.
 */
export async function getAnalytics(range: number) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  const to = new Date();
  const from = new Date(to.getTime() - range * 86400000);
  const db = sql();
  return Promise.all([
    db<{ orders: number; placed_value: number; delivered: number; delivered_value: number; cancelled: number; returned: number; customers: number; repeat_customers: number; units: number; gross_profit: number | null }[]>`
      with o as (select * from public.orders where created_at between ${from} and ${to}),
        -- the order lines are read once and shared by units and profit
        lines as (select o.status, i.quantity, i.line_total, p.cost_price from o join public.order_items i on i.order_id = o.id left join public.products p on p.id = i.product_id)
      select count(*)::int as orders, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as placed_value,
        count(*) filter (where status = 'delivered')::int as delivered, coalesce(sum(total) filter (where status = 'delivered'), 0) as delivered_value,
        count(*) filter (where status = 'cancelled')::int as cancelled, count(*) filter (where status = 'returned')::int as returned,
        count(distinct phone)::int as customers,
        (select count(*)::int from public.customer_stats s where s.orders > 1 and s.phone in (select phone from o)) as repeat_customers,
        (select coalesce(sum(quantity) filter (where status <> 'cancelled'), 0)::int from lines) as units,
        (select sum(line_total - quantity * cost_price) filter (where status = 'delivered' and cost_price is not null) from lines) as gross_profit
      from o`,
    db<{ day: string; orders: number; value: number }[]>`select to_char(date_trunc('day', created_at at time zone 'Asia/Dhaka'), 'YYYY-MM-DD') as day, count(*)::int as orders, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as value from public.orders where created_at between ${from} and ${to} group by 1`,
    db<{ method: string; n: number; value: number }[]>`select payment_method as method, count(*)::int as n, coalesce(sum(total), 0) as value from public.orders where created_at between ${from} and ${to} and status <> 'cancelled' group by 1 order by 2 desc`,
    db<{ name: string; units: number; value: number }[]>`select coalesce(c.name, 'Uncategorised') as name, sum(i.quantity)::int as units, sum(i.line_total) as value from public.order_items i join public.orders o on o.id = i.order_id left join public.products p on p.id = i.product_id left join public.categories c on c.id = p.category_id where o.created_at between ${from} and ${to} and o.status <> 'cancelled' group by 1 order by 3 desc`,
    db<{ zone: string; n: number; delivered: number; returned: number }[]>`select zone, count(*)::int as n, count(*) filter (where status = 'delivered')::int as delivered, count(*) filter (where status = 'returned')::int as returned from public.orders where created_at between ${from} and ${to} group by 1 order by 2 desc`,
    db<{ code: string; uses: number; discount: number }[]>`select c.code, count(r.*)::int as uses, coalesce(sum(r.amount), 0) as discount from public.coupon_redemptions r join public.coupons c on c.id = r.coupon_id where r.created_at between ${from} and ${to} group by 1 order by 2 desc limit 8`,
    db<{ calls: number; failures: number; avg_ms: number | null; tokens: number | null }[]>`select count(*)::int as calls, count(*) filter (where not ok)::int as failures, avg(latency_ms)::int as avg_ms, sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int as tokens from public.ai_usage where created_at between ${from} and ${to}`,
    db<{ channel: string; campaign: string | null; n: number; delivered: number; value: number }[]>`
      select coalesce(nullif(attribution ->> 'channel', ''), 'direct') as channel, nullif(attribution ->> 'utm_campaign', '') as campaign, count(*)::int as n,
        count(*) filter (where status = 'delivered')::int as delivered, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as value
      from public.orders where created_at between ${from} and ${to} group by 1, 2 order by 5 desc limit 12`,
    ]);
}
