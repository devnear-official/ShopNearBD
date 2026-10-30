import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Table } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { adjustStock } from "@/actions/admin-catalog";
import { buttonClass } from "@/components/ui/button";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60);
  const low = sp.low === "1";
  const [rows, moves] = await admin.db((tx) => Promise.all([
    tx<{ id: string; product_id: string; product: string; name: string; sku: string; stock: number; threshold: number; status: string; is_active: boolean }[]>`
      select v.id, p.id as product_id, p.name as product, v.name, v.sku, v.stock, p.low_stock_threshold as threshold, p.status, v.is_active
      from public.product_variants v join public.products p on p.id = v.product_id
      where v.sku not like '%-OLD-%' ${q ? tx`and (p.name ilike ${"%" + q + "%"} or v.sku ilike ${"%" + q + "%"} or p.sku ilike ${"%" + q + "%"})` : tx``} ${low ? tx`and v.stock <= p.low_stock_threshold and v.is_active` : tx``}
      order by (v.stock <= p.low_stock_threshold) desc, v.stock asc, p.name limit 200`,
    tx<{ id: number; delta: number; stock_after: number; reason: string; note: string | null; created_at: Date; sku: string; product: string; order_number: string | null; actor: string | null }[]>`
      select m.id, m.delta, m.stock_after, m.reason, m.note, m.created_at, v.sku, p.name as product, o.order_number, case when m.actor_id is null then null else coalesce(u.full_name, 'Admin') end as actor
      from public.inventory_movements m join public.product_variants v on v.id = m.variant_id join public.products p on p.id = v.product_id
      left join public.orders o on o.id = m.order_id left join public.profiles u on u.id = m.actor_id
      ${q ? tx`where (p.name ilike ${"%" + q + "%"} or v.sku ilike ${"%" + q + "%"})` : tx``}
      order by m.id desc limit 40`,
  ]));
  return (
    <>
      <PageHeader title="Inventory" description="Every stock change is recorded. Orders reserve stock at checkout; cancellations and returns put it back." />
      <Card className="mb-4">
        <form className="flex flex-wrap gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Product or SKU" className="input max-w-xs" aria-label="Search" />
          <label className="flex items-center gap-2 px-2 text-sm font-semibold"><input type="checkbox" name="low" value="1" defaultChecked={low} className="size-4 accent-electric" /> Low stock only</label>
          <button className={buttonClass("dark", "sm")}>Filter</button>
        </form>
      </Card>
      <Card pad={false} className="mb-4">
        {rows.length ? (
          <Table head={["Variant", "Stock", "Adjust"]}>
            {rows.map((r) => (
              <tr key={r.id} className={!r.is_active ? "opacity-50" : ""}>
                <td className="px-4 py-3"><Link href={`/admin/products/${r.product_id}`} className="font-semibold hover:underline">{r.product}</Link>{r.name !== "Default" && <span className="text-slate"> · {r.name}</span>}<span className="block font-mono text-xs text-slate">{r.sku}</span></td>
                <td className="px-4 py-3"><span className="font-display text-lg font-bold tabular-nums">{r.stock}</span>{r.stock <= r.threshold && r.is_active && <Badge tone={r.stock === 0 ? "red" : "amber"} className="ml-2">{r.stock === 0 ? "Out" : "Low"}</Badge>}</td>
                <td className="px-4 py-3">
                  <ActionForm action={adjustStock} className="flex flex-wrap items-center gap-2" resetOnSuccess>
                    <input type="hidden" name="variantId" value={r.id} />
                    <input name="delta" type="number" required placeholder="+10 / −2" aria-label="Change" className="input h-10 min-h-0 w-28" />
                    <select name="reason" aria-label="Reason" className="input h-10 min-h-0 w-36 py-1"><option value="restock">Restock</option><option value="adjustment">Correction</option><option value="return">Return</option></select>
                    <input name="note" placeholder="Note" aria-label="Note" className="input h-10 min-h-0 w-40" />
                    <SubmitButton size="sm" variant="dark">Apply</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </Table>
        ) : <div className="p-5"><Empty>No variants match.</Empty></div>}
      </Card>
      <Card title="Recent stock movements">
        {moves.length ? (
          <ul className="divide-y divide-line text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <b className={`w-14 tabular-nums ${m.delta > 0 ? "text-mint" : "text-flame"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</b>
                <span className="min-w-0 flex-1">{m.product} <span className="font-mono text-xs text-slate">{m.sku}</span></span>
                <Badge>{m.reason}</Badge><span className="text-slate">→ {m.stock_after}</span>
                <span className="text-xs text-slate">{m.order_number ?? m.actor ?? "system"}{m.note ? ` · ${m.note}` : ""} · {formatDateTime(m.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>No movements yet.</Empty>}
      </Card>
    </>
  );
}
