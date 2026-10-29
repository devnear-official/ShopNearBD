import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatTaka } from "@/lib/format";
import { Card, PageHeader, Stat } from "@/components/admin/ui";
import { DailyBars } from "@/components/admin/charts";

const CHANNEL_LABEL: Record<string, string> = { facebook: "Facebook/Instagram", tiktok: "TikTok", google: "Google", utm_source: "Tagged link", referral: "Referral", direct: "Direct" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const admin = await requireAdminPage();
  const range = [7, 30, 90, 365].includes(Number((await searchParams).range)) ? Number((await searchParams).range) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - range * 86400000);
  const [summary, daily, byMethod, byCategory, byZone, coupons, ai, byChannel] = await admin.db((tx) => Promise.all([
    tx<{ orders: number; placed_value: number; delivered: number; delivered_value: number; cancelled: number; returned: number; customers: number; repeat_customers: number; units: number; gross_profit: number | null }[]>`
      with o as (select * from public.orders where created_at between ${from} and ${to})
      select count(*)::int as orders, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as placed_value,
        count(*) filter (where status = 'delivered')::int as delivered, coalesce(sum(total) filter (where status = 'delivered'), 0) as delivered_value,
        count(*) filter (where status = 'cancelled')::int as cancelled, count(*) filter (where status = 'returned')::int as returned,
        count(distinct phone)::int as customers,
        (select count(*)::int from (select phone from public.orders where phone in (select phone from o) group by phone having count(*) > 1) r) as repeat_customers,
        (select coalesce(sum(i.quantity), 0)::int from public.order_items i join o on o.id = i.order_id where o.status <> 'cancelled') as units,
        (select sum(i.line_total - i.quantity * p.cost_price) from public.order_items i join o on o.id = i.order_id join public.products p on p.id = i.product_id where o.status = 'delivered' and p.cost_price is not null) as gross_profit
      from o`,
    tx<{ day: string; orders: number; value: number }[]>`select to_char(date_trunc('day', created_at at time zone 'Asia/Dhaka'), 'YYYY-MM-DD') as day, count(*)::int as orders, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as value from public.orders where created_at between ${from} and ${to} group by 1`,
    tx<{ method: string; n: number; value: number }[]>`select payment_method as method, count(*)::int as n, coalesce(sum(total), 0) as value from public.orders where created_at between ${from} and ${to} and status <> 'cancelled' group by 1 order by 2 desc`,
    tx<{ name: string; units: number; value: number }[]>`select coalesce(c.name, 'Uncategorised') as name, sum(i.quantity)::int as units, sum(i.line_total) as value from public.order_items i join public.orders o on o.id = i.order_id left join public.products p on p.id = i.product_id left join public.categories c on c.id = p.category_id where o.created_at between ${from} and ${to} and o.status <> 'cancelled' group by 1 order by 3 desc`,
    tx<{ zone: string; n: number; delivered: number; returned: number }[]>`select zone, count(*)::int as n, count(*) filter (where status = 'delivered')::int as delivered, count(*) filter (where status = 'returned')::int as returned from public.orders where created_at between ${from} and ${to} group by 1 order by 2 desc`,
    tx<{ code: string; uses: number; discount: number }[]>`select c.code, count(r.*)::int as uses, coalesce(sum(r.amount), 0) as discount from public.coupon_redemptions r join public.coupons c on c.id = r.coupon_id where r.created_at between ${from} and ${to} group by 1 order by 2 desc limit 8`,
    tx<{ calls: number; failures: number; avg_ms: number | null; tokens: number | null }[]>`select count(*)::int as calls, count(*) filter (where not ok)::int as failures, avg(latency_ms)::int as avg_ms, sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int as tokens from public.ai_usage where created_at between ${from} and ${to}`,
    tx<{ channel: string; campaign: string | null; n: number; delivered: number; value: number }[]>`
      select coalesce(nullif(attribution ->> 'channel', ''), 'direct') as channel, nullif(attribution ->> 'utm_campaign', '') as campaign, count(*)::int as n,
        count(*) filter (where status = 'delivered')::int as delivered, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as value
      from public.orders where created_at between ${from} and ${to} group by 1, 2 order by 5 desc limit 12`,
  ]));
  const s = summary[0];
  const valid = s.orders - s.cancelled;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const methodLabel: Record<string, string> = { cod: "Cash on Delivery", bkash_manual: "bKash", nagad_manual: "Nagad" };
  return (
    <>
      <PageHeader title="Analytics" description="Calculated from orders in the database. Placed value is not revenue; delivered value is."
        actions={[7, 30, 90, 365].map((r) => <Link key={r} href={`/admin/analytics?range=${r}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${r === range ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)]"}`}>{r === 365 ? "1 year" : `${r} days`}</Link>)} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders placed" value={s.orders} hint={`${s.units} units`} />
        <Stat label="Avg order value" value={formatTaka(valid ? s.placed_value / valid : 0)} hint="Excludes cancelled" />
        <Stat label="Delivery success" value={pct(s.delivered, s.delivered + s.returned)} tone="green" hint={`${s.delivered} delivered · ${s.returned} returned`} />
        <Stat label="Cancellation rate" value={pct(s.cancelled, s.orders)} tone="red" />
        <Stat label="Delivered value" value={formatTaka(s.delivered_value)} tone="green" />
        <Stat label="Gross profit (delivered)" value={s.gross_profit === null ? "—" : formatTaka(s.gross_profit)} hint="Needs cost price on products" />
        <Stat label="Customers" value={s.customers} hint={`${s.repeat_customers} have ordered more than once`} />
        <Stat label="AI chat replies" value={ai[0].calls} hint={`${ai[0].failures} failed · avg ${ai[0].avg_ms ?? 0} ms · ${ai[0].tokens ?? 0} tokens`} />
      </div>
      <Card title="Placed order value per day" className="mt-4"><DailyBars data={daily} days={Math.min(range, 90)} /></Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Payment methods"><Bars rows={byMethod.map((m) => ({ label: methodLabel[m.method] ?? m.method, value: m.value, sub: `${m.n} orders` }))} /></Card>
        <Card title="Sales by category"><Bars rows={byCategory.map((c) => ({ label: c.name, value: c.value, sub: `${c.units} units` }))} /></Card>
        <Card title="Delivery zones"><ul className="space-y-2 text-sm">{byZone.map((z) => <li key={z.zone} className="flex justify-between"><span className="capitalize">{z.zone.replace(/_/g, " ")}</span><span>{z.n} orders · {pct(z.delivered, z.delivered + z.returned)} delivered</span></li>)}</ul></Card>
        <Card title="Orders by source (ads)">
          {byChannel.length ? <Bars rows={byChannel.map((c) => ({ label: `${CHANNEL_LABEL[c.channel] ?? c.channel}${c.campaign ? ` · ${c.campaign}` : ""}`, value: Number(c.value), sub: `${c.n} orders · ${c.delivered} delivered` }))} /> : <p className="text-sm text-slate">No orders in this period.</p>}
        </Card>
        <Card title="Coupons used"><ul className="space-y-2 text-sm">{coupons.length ? coupons.map((c) => <li key={c.code} className="flex justify-between"><span className="font-mono">{c.code}</span><span>{c.uses} uses · {formatTaka(c.discount)}</span></li>) : <li className="text-slate">No coupon use in this period.</li>}</ul></Card>
      </div>
    </>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; sub: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-slate">No data in this period.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm"><span className="font-medium">{r.label}</span><span className="tabular-nums">{formatTaka(r.value)} <span className="text-slate">· {r.sub}</span></span></div>
          <div className="mt-1 h-2 rounded-full bg-cloud"><div className="h-full rounded-full bg-electric" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
