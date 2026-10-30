import { Suspense } from "react";
import { AdminPageFallback } from "@/components/admin/page-fallback";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { filterQuery, orderWhere, parseOrderFilters } from "@/lib/admin-orders";
import { formatDateTime, formatTaka } from "@/lib/format";
import { Badge, Card, Empty, ORDER_TONE, PageHeader, Pager, PAY_LABEL, PAY_TONE, STATUS_LABEL, Table } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";

const METHOD: Record<string, string> = { cod: "COD", bkash_manual: "bKash", nagad_manual: "Nagad" };

export default function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense fallback={<AdminPageFallback />}>
      <OrdersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OrdersPageContent({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdminPage();
  const f = parseOrderFilters(await searchParams);
  const size = 20;
  const [rows, [{ total }], counts] = await admin.db((tx) => Promise.all([
    tx<{ id: string; order_number: string; customer_name: string; phone: string; district: string; total: number; status: string; payment_status: string; payment_method: string; created_at: Date; items: number }[]>`
      select o.id, o.order_number, o.customer_name, o.phone, o.district, o.total, o.status, o.payment_status, o.payment_method, o.created_at,
        (select coalesce(sum(quantity), 0)::int from public.order_items i where i.order_id = o.id) as items
      from public.orders o ${orderWhere(tx, f)} order by o.created_at desc limit ${size} offset ${(f.page - 1) * size}`,
    tx<{ total: number }[]>`select count(*)::int as total from public.orders o ${orderWhere(tx, f)}`,
    tx<{ status: string; n: number }[]>`select status, count(*)::int as n from public.orders group by status`,
  ]));
  const c = Object.fromEntries(counts.map((r) => [r.status, r.n]));
  const tabs = [{ k: undefined, l: "All" }, { k: "pending", l: "Pending" }, { k: "confirmed", l: "Confirmed" }, { k: "packed", l: "Packed" }, { k: "shipped", l: "Shipped" }, { k: "delivered", l: "Delivered" }, { k: "cancelled", l: "Cancelled" }, { k: "returned", l: "Returned" }];

  return (
    <>
      <PageHeader title="Orders" description={`${total} matching order${total === 1 ? "" : "s"}`}
        actions={<a href={`/admin/export/orders?${filterQuery(f, { page: 1 })}`} className={buttonClass("ghost", "sm")}><Download className="size-4" /> Export CSV</a>} />
      <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map((t) => (
          <Link key={t.l} href={`/admin/orders?${filterQuery(f, { status: t.k, page: 1 })}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${f.status === t.k ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)]"}`}>
            {t.l}{t.k && c[t.k] ? <span className="ml-1.5 opacity-60">{c[t.k]}</span> : null}
          </Link>
        ))}
      </div>
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
          {f.status && <input type="hidden" name="status" value={f.status} />}
          <label className="lg:col-span-2"><span className="label">Search</span><input name="q" defaultValue={f.q} placeholder="Order no., phone or name" className="input" /></label>
          <label><span className="label">Payment</span><select name="payment" defaultValue={f.payment ?? ""} className="input"><option value="">Any</option>{Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label><span className="label">Method</span><select name="method" defaultValue={f.method ?? ""} className="input"><option value="">Any</option><option value="cod">COD</option><option value="bkash_manual">bKash</option><option value="nagad_manual">Nagad</option></select></label>
          <label><span className="label">From</span><input type="date" name="from" defaultValue={f.from} className="input" /></label>
          <label><span className="label">To</span><input type="date" name="to" defaultValue={f.to} className="input" /></label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6"><button className={buttonClass("dark", "sm")}>Apply filters</button><Link href="/admin/orders" className={buttonClass("ghost", "sm")}>Reset</Link></div>
        </form>
      </Card>

      {rows.length === 0 ? <Empty>No orders match these filters.</Empty> : (
        <>
          <Card pad={false} className="hidden md:block">
            <Table head={["Order", "Customer", "Items", "Total", "Status", "Payment", "Placed"]}>
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-paper">
                  <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold text-electric hover:underline">{o.order_number}</Link></td>
                  <td className="px-4 py-3"><span className="font-medium">{o.customer_name}</span><span className="block text-xs text-slate">{o.phone} · {o.district}</span></td>
                  <td className="px-4 py-3 tabular-nums">{o.items}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{formatTaka(o.total)}</td>
                  <td className="px-4 py-3"><Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={PAY_TONE[o.payment_status]}>{PAY_LABEL[o.payment_status]}</Badge><span className="ml-1 text-xs text-slate">{METHOD[o.payment_method]}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <ul className="space-y-2 md:hidden">
            {rows.map((o) => (
              <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="block rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between"><span className="font-mono font-semibold">{o.order_number}</span><span className="font-semibold">{formatTaka(o.total)}</span></div>
                <p className="mt-1 text-sm">{o.customer_name} · <span className="text-slate">{o.phone}</span></p>
                <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge><Badge tone={PAY_TONE[o.payment_status]}>{PAY_LABEL[o.payment_status]}</Badge><span className="text-xs text-slate">{METHOD[o.payment_method]} · {formatDateTime(o.created_at)}</span></div>
              </Link></li>
            ))}
          </ul>
        </>
      )}
      <Pager page={f.page} pages={Math.ceil(total / size)} href={(p) => `/admin/orders?${filterQuery(f, { page: p })}`} />
    </>
  );
}
