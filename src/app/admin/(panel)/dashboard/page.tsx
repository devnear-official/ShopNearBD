import { Suspense } from "react";
import { AdminPageFallback } from "@/components/admin/page-fallback";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime, formatTaka } from "@/lib/format";
import { Badge, Card, Empty, ORDER_TONE, PageHeader, PAY_LABEL, PAY_TONE, Stat, STATUS_LABEL } from "@/components/admin/ui";
import { DailyBars, StatusBar } from "@/components/admin/charts";

type Metrics = {
  orders_today: number; awaiting_confirmation: number; awaiting_shipment: number; in_transit: number; payments_to_verify: number;
  delivered_in_range: number; cancelled_in_range: number; orders_in_range: number; booked_value: number; delivered_value: number;
  collected: number; refunded: number; status_distribution: Record<string, number>;
  top_products: { product_id: string; name: string; quantity: number; value: number }[];
  low_stock: { product_id: string; name: string; variant_name: string; sku: string; stock: number; low_stock_threshold: number }[];
  daily: { day: string; orders: number; value: number }[];
};

export default function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  return (
    <Suspense fallback={<AdminPageFallback />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const admin = await requireAdminPage();
  const range = [7, 30, 90].includes(Number((await searchParams).range)) ? Number((await searchParams).range) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - range * 86400000);
  const [m, recent, chats] = await admin.db(async (tx) => Promise.all([
    tx<{ m: Metrics }[]>`select public.admin_dashboard(${from}, ${to}) as m`.then((r) => r[0].m),
    tx<{ id: string; order_number: string; customer_name: string; total: number; status: string; payment_status: string; payment_method: string; created_at: Date }[]>`
      select id, order_number, customer_name, total, status, payment_status, payment_method, created_at from public.orders order by created_at desc limit 8`,
    tx<{ id: string; customer_name: string | null; content: string; created_at: Date; status: string; needs_human: boolean }[]>`
      select c.id, c.customer_name, m.content, m.created_at, c.status, c.needs_human from public.chat_conversations c
      join lateral (select content, created_at from public.chat_messages where conversation_id = c.id and role = 'user' order by id desc limit 1) m on true
      order by c.last_message_at desc limit 5`,
  ]));
  const aov = m.orders_in_range - m.cancelled_in_range > 0 ? m.booked_value / (m.orders_in_range - m.cancelled_in_range) : 0;

  return (
    <>
      <PageHeader title="Dashboard" description="Live operational numbers. Each figure says exactly what it counts."
        actions={[7, 30, 90].map((r) => <Link key={r} href={`/admin/dashboard?range=${r}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${r === range ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)]"}`}>{r} days</Link>)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Orders today" value={m.orders_today} hint="Placed since midnight (Dhaka)" />
        <Stat label="Awaiting confirmation" value={m.awaiting_confirmation} tone="amber" hint="Status: pending" href="/admin/orders?status=pending" />
        <Stat label="Payments to verify" value={m.payments_to_verify} tone="amber" hint="bKash/Nagad submissions" href="/admin/orders?payment=pending_verification" />
        <Stat label="Awaiting shipment" value={m.awaiting_shipment} tone="blue" hint="Confirmed or packed" href="/admin/orders?status=confirmed" />
        <Stat label="With courier" value={m.in_transit} tone="blue" hint="Status: shipped" href="/admin/orders?status=shipped" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Booked value · ${range}d`} value={formatTaka(m.booked_value)} hint="Orders placed, excluding cancelled. Not revenue." />
        <Stat label={`Delivered sales · ${range}d`} value={formatTaka(m.delivered_value)} tone="green" hint={`${m.delivered_in_range} orders delivered in period`} />
        <Stat label={`Cash collected · ${range}d`} value={formatTaka(m.collected - m.refunded)} tone="green" hint={`Verified payments − refunds (${formatTaka(m.refunded)})`} />
        <Stat label={`Cancelled · ${range}d`} value={m.cancelled_in_range} tone="red" hint={`Avg order value ${formatTaka(aov)}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title={`Order value per day · ${range} days`} className="lg:col-span-2"><DailyBars data={m.daily} days={range} /></Card>
        <Card title="Status of orders placed in period"><StatusBar dist={m.status_distribution} /></Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Recent orders" className="lg:col-span-2" actions={<Link href="/admin/orders" className="text-sm font-semibold text-electric">All orders →</Link>}>
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-paper sm:flex-nowrap">
                    <span className="w-32 font-mono text-sm font-semibold">{o.order_number}</span>
                    <span className="min-w-0 flex-1 truncate">{o.customer_name}</span>
                    <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    <Badge tone={PAY_TONE[o.payment_status]}>{PAY_LABEL[o.payment_status]}</Badge>
                    <span className="w-20 text-right font-semibold tabular-nums">{formatTaka(o.total)}</span>
                    <span className="hidden w-28 text-right text-xs text-slate sm:block">{formatDateTime(o.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>No orders yet.</Empty>}
        </Card>
        <Card title="Low stock" actions={<Link href="/admin/inventory?low=1" className="text-sm font-semibold text-electric">Inventory →</Link>}>
          {m.low_stock.length ? (
            <ul className="space-y-2 text-sm">
              {m.low_stock.map((l) => (
                <li key={l.sku} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/products/${l.product_id}`} className="min-w-0 truncate hover:underline">{l.name}{l.variant_name !== "Default" ? ` · ${l.variant_name}` : ""}</Link>
                  <Badge tone={l.stock === 0 ? "red" : "amber"}>{l.stock} left</Badge>
                </li>
              ))}
            </ul>
          ) : <Empty>Everything is above its low-stock threshold.</Empty>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Top sellers · ${range} days`} actions={<span className="text-xs text-slate">Units in non-cancelled orders</span>}>
          {m.top_products.length ? (
            <ol className="space-y-2 text-sm">
              {m.top_products.map((t, i) => (
                <li key={t.product_id ?? i} className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-paper text-xs font-bold">{i + 1}</span><span className="min-w-0 flex-1 truncate">{t.name}</span><b className="tabular-nums">{t.quantity}</b><span className="w-20 text-right text-slate">{formatTaka(t.value)}</span></li>
              ))}
            </ol>
          ) : <Empty>No sales in this period.</Empty>}
        </Card>
        <Card title="Recent customer messages" actions={<Link href="/admin/chat" className="text-sm font-semibold text-electric">Chat inbox →</Link>}>
          {chats.length ? (
            <ul className="divide-y divide-line text-sm">
              {chats.map((c) => (
                <li key={c.id}><Link href={`/admin/chat?c=${c.id}`} className="block py-2.5 hover:bg-paper">
                  <span className="flex items-center gap-2"><b>{c.customer_name ?? "Visitor"}</b>{c.needs_human && <Badge tone="red">Needs human</Badge>}<span className="ml-auto text-xs text-slate">{formatDateTime(c.created_at)}</span></span>
                  <span className="line-clamp-1 text-slate">{c.content}</span>
                </Link></li>
              ))}
            </ul>
          ) : <Empty>No conversations yet.</Empty>}
        </Card>
      </div>
    </>
  );
}
