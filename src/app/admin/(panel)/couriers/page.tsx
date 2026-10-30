import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { PROVIDERS } from "@/lib/couriers";
import { siteUrl } from "@/lib/env";
import { formatDateTime, formatTaka } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Table } from "@/components/admin/ui";

export default async function CouriersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await requireAdminPage();
  const status = (await searchParams).status;
  const [shipments, recon, events] = await admin.db((tx) => Promise.all([
    tx<{ id: string; order_id: string; order_number: string; provider: string; is_sandbox: boolean; status: string; consignment_id: string | null; cod_amount: number; cod_collected: number | null; last_error: string | null; updated_at: Date }[]>`
      select s.id, s.order_id, o.order_number, s.provider, s.is_sandbox, s.status, s.consignment_id, s.cod_amount, s.cod_collected, s.last_error, s.updated_at
      from public.shipments s join public.orders o on o.id = s.order_id
      ${status ? tx`where s.status = ${status}` : tx``} order by s.updated_at desc limit 100`,
    tx<{ provider: string; delivered: number; cod_expected: number; cod_reported: number; returned: number; in_transit: number; failed: number }[]>`
      select provider, count(*) filter (where status in ('delivered','partial_delivered'))::int as delivered,
        coalesce(sum(cod_amount) filter (where status in ('delivered','partial_delivered')), 0) as cod_expected,
        coalesce(sum(cod_collected) filter (where status in ('delivered','partial_delivered')), 0) as cod_reported,
        count(*) filter (where status = 'returned')::int as returned, count(*) filter (where status in ('created','picked_up','in_transit'))::int as in_transit,
        count(*) filter (where status = 'failed')::int as failed
      from public.shipments group by provider`,
    tx<{ id: number; provider: string; status: string | null; received_at: Date; order_number: string | null }[]>`
      select e.id, e.provider, e.status, e.received_at, o.order_number from public.courier_events e left join public.shipments s on s.id = e.shipment_id left join public.orders o on o.id = s.order_id order by e.id desc limit 20`,
  ]));
  const base = siteUrl();
  return (
    <>
      <PageHeader title="Couriers" description="Book parcels from an order page. This screen shows provider setup, shipments and cash-on-delivery reconciliation." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.values(PROVIDERS).map((p) => {
          const missing = p.missingConfig();
          return (
            <Card key={p.id}>
              <div className="flex items-center justify-between"><b>{p.label}</b>{missing.length ? <Badge tone="gray">Not configured</Badge> : p.id === "sandbox" ? <Badge tone="amber">Test mode</Badge> : <Badge tone="green">Ready</Badge>}</div>
              {missing.length > 0 && <p className="mt-2 text-xs text-slate">Set: {missing.join(", ")}</p>}
              {p.id !== "sandbox" && <p className="mt-2 break-all text-xs text-slate">Webhook URL: <span className="font-mono">{base}/api/couriers/{p.id}/webhook{p.id === "redx" ? "?token=REDX_WEBHOOK_TOKEN" : ""}</span></p>}
              {p.id === "sandbox" && <p className="mt-2 text-xs text-slate">Creates fake consignments for testing. Never shown to customers as a real courier.</p>}
            </Card>
          );
        })}
      </div>
      <Card title="COD reconciliation" className="mt-4">
        {recon.length ? (
          <Table head={["Courier", "In transit", "Delivered", "COD expected", "COD reported", "Difference", "Returned", "Failed bookings"]}>
            {recon.map((r) => (
              <tr key={r.provider}><td className="px-4 py-2 font-semibold capitalize">{r.provider}</td><td className="px-4 py-2">{r.in_transit}</td><td className="px-4 py-2">{r.delivered}</td><td className="px-4 py-2">{formatTaka(r.cod_expected)}</td><td className="px-4 py-2">{formatTaka(r.cod_reported)}</td>
                <td className={`px-4 py-2 font-semibold ${r.cod_expected - r.cod_reported > 0 ? "text-flame" : "text-mint"}`}>{formatTaka(r.cod_expected - r.cod_reported)}</td><td className="px-4 py-2">{r.returned}</td><td className="px-4 py-2">{r.failed}</td></tr>
            ))}
          </Table>
        ) : <Empty>No shipments yet.</Empty>}
        <p className="mt-3 text-xs text-slate">“Reported” comes from courier webhooks/status checks or manual “COD collected” entries. Match it against the courier&apos;s payment statement before marking payouts received.</p>
      </Card>
      <Card title="Shipments" className="mt-4" actions={<div className="flex gap-1 text-xs">{["", "in_transit", "delivered", "returned", "failed"].map((s) => <Link key={s} href={`/admin/couriers${s ? `?status=${s}` : ""}`} className={`rounded-full px-3 py-1 font-semibold ${status === s || (!status && !s) ? "bg-ink text-white" : "bg-paper"}`}>{s || "all"}</Link>)}</div>}>
        {shipments.length ? (
          <Table head={["Order", "Courier", "Consignment", "Status", "COD", "Updated"]}>
            {shipments.map((s) => (
              <tr key={s.id}><td className="px-4 py-2"><Link href={`/admin/orders/${s.order_id}`} className="font-mono font-semibold text-electric hover:underline">{s.order_number}</Link></td><td className="px-4 py-2 capitalize">{s.provider}{s.is_sandbox && <Badge tone="amber" className="ml-1">test</Badge>}</td><td className="px-4 py-2 font-mono text-xs">{s.consignment_id ?? "—"}</td>
                <td className="px-4 py-2"><Badge tone={s.status === "delivered" ? "green" : s.status === "failed" || s.status === "returned" ? "red" : "blue"}>{s.status}</Badge>{s.last_error && <span className="block max-w-xs truncate text-xs text-flame" title={s.last_error}>{s.last_error}</span>}</td>
                <td className="px-4 py-2 tabular-nums">{formatTaka(s.cod_amount)}{s.cod_collected !== null && <span className="block text-xs text-slate">got {formatTaka(s.cod_collected)}</span>}</td><td className="px-4 py-2 text-xs text-slate">{formatDateTime(s.updated_at)}</td></tr>
            ))}
          </Table>
        ) : <Empty>No shipments match.</Empty>}
      </Card>
      <Card title="Latest courier events" className="mt-4">
        {events.length ? <ul className="divide-y divide-line text-sm">{events.map((e) => <li key={e.id} className="flex gap-3 py-2"><span className="w-28 capitalize">{e.provider}</span><span className="font-mono">{e.order_number ?? "unmatched"}</span><span className="text-slate">{e.status}</span><span className="ml-auto text-xs text-slate">{formatDateTime(e.received_at)}</span></li>)}</ul> : <Empty>No webhook events received yet.</Empty>}
      </Card>
    </>
  );
}
