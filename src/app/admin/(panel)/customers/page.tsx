import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatDate, formatTaka } from "@/lib/format";
import { Card, Empty, PageHeader, Pager, Table } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";

/** Customers are grouped by phone number (guest checkout is the norm in Bangladesh). */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const size = 30;
  const rows = await admin.db((tx) => tx<{ phone: string; name: string; district: string; orders: number; delivered: number; cancelled: number; spent: number; last_order: Date; total_count: number }[]>`
    select phone, (array_agg(customer_name order by created_at desc))[1] as name, (array_agg(district order by created_at desc))[1] as district,
      count(*)::int as orders, count(*) filter (where status = 'delivered')::int as delivered, count(*) filter (where status in ('cancelled','returned'))::int as cancelled,
      coalesce(sum(total) filter (where status = 'delivered'), 0) as spent, max(created_at) as last_order, count(*) over ()::int as total_count
    from public.orders
    ${q ? tx`where phone like ${"%" + q.replace(/\D/g, "") + "%"} or customer_name ilike ${"%" + q + "%"}` : tx``}
    group by phone order by max(created_at) desc limit ${size} offset ${(page - 1) * size}`);
  const total = rows[0]?.total_count ?? 0;
  return (
    <>
      <PageHeader title="Customers" description="Grouped by phone. Delivery success rate helps spot risky COD orders." />
      <Card className="mb-4"><form className="flex gap-2" role="search"><input name="q" defaultValue={q} placeholder="Phone or name" className="input max-w-xs" aria-label="Search customers" /><button className={buttonClass("dark", "sm")}>Search</button></form></Card>
      {rows.length ? (
        <Card pad={false}>
          <Table head={["Customer", "Orders", "Delivered", "Cancelled/returned", "Spent (delivered)", "Last order"]}>
            {rows.map((r) => (
              <tr key={r.phone}>
                <td className="px-4 py-3"><Link href={`/admin/orders?q=${r.phone}`} className="font-semibold hover:underline">{r.name}</Link><span className="block text-xs text-slate"><span className="font-mono">{r.phone}</span> · {r.district}</span></td>
                <td className="px-4 py-3 tabular-nums">{r.orders}</td>
                <td className="px-4 py-3 tabular-nums">{r.delivered}</td>
                <td className={`px-4 py-3 tabular-nums ${r.cancelled > 0 && r.cancelled >= r.delivered ? "font-bold text-flame" : ""}`}>{r.cancelled}</td>
                <td className="px-4 py-3 tabular-nums">{formatTaka(r.spent)}</td>
                <td className="px-4 py-3 text-slate">{formatDate(r.last_order)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : <Empty>No customers yet.</Empty>}
      <Pager page={page} pages={Math.ceil(total / size)} href={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
    </>
  );
}
