import { Suspense } from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatDate, formatTaka } from "@/lib/format";
import { Card, Empty, PageHeader, Pager, Table } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";

/** Customers are grouped by phone number (guest checkout is the norm in Bangladesh). */
export default function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="skeleton h-10 w-64 rounded-xl" /><div className="skeleton h-64 rounded-3xl" /></div>}>
      <CustomersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomersContent({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const size = 30;
  const rows = await admin.db((tx) => tx<{ phone: string; name: string; district: string; orders: number; delivered: number; cancelled: number; spent: number; last_order: Date; total_count: number; last_login: Date | null }[]>`
    select s.phone, s.name, s.district, s.orders, s.delivered, s.cancelled, s.spent, s.last_order, count(*) over ()::int as total_count,
      (select a.last_login_at from public.customer_accounts a where a.phone = s.phone) as last_login
    from public.customer_stats s
    ${q ? tx`where s.phone like ${"%" + q.replace(/\D/g, "") + "%"} or s.name ilike ${"%" + q + "%"}` : tx``}
    order by s.last_order desc limit ${size} offset ${(page - 1) * size}`);
  const total = rows[0]?.total_count ?? 0;
  return (
    <>
      <PageHeader title="Customers" description="Grouped by phone. Every phone that orders has an account; customers log in with an SMS code. Delivery success rate helps spot risky COD orders." />
      <Card className="mb-4"><form className="flex gap-2" role="search"><input name="q" defaultValue={q} placeholder="Phone or name" className="input max-w-xs" aria-label="Search customers" /><button className={buttonClass("dark", "sm")}>Search</button></form></Card>
      {rows.length ? (
        <Card pad={false}>
          <Table head={["Customer", "Orders", "Delivered", "Cancelled/returned", "Spent (delivered)", "Last order"]}>
            {rows.map((r) => (
              <tr key={r.phone}>
                <td className="px-4 py-3"><Link href={`/admin/orders?q=${r.phone}`} className="font-semibold hover:underline">{r.name}</Link><span className="block text-xs text-slate"><span className="font-mono">{r.phone}</span> · {r.district}</span>{r.last_login && <span className="mt-0.5 block text-xs text-mint">Logged in {formatDate(r.last_login)}</span>}</td>
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
