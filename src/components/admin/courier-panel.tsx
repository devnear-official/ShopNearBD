import { ExternalLink } from "lucide-react";
import { PROVIDERS } from "@/lib/couriers";
import { formatDateTime, formatTaka } from "@/lib/format";
import { Badge, Card } from "./ui";
import { ActionForm, SubmitButton } from "./form";
import { cancelShipmentRecord, createShipmentAction, simulateSandboxAction, syncShipmentAction } from "@/actions/admin-couriers";

type Shipment = { id: string; provider: string; is_sandbox: boolean; status: string; consignment_id: string | null; tracking_code: string | null; tracking_url: string | null; label_url: string | null; cod_amount: number; cod_collected: number | null; last_error: string | null; created_at: Date; updated_at: Date };
type Order = { id: string; status: string; total: number; payment_method: string; payment_status: string; customer_name: string; phone: string; address: string; area: string | null; district: string; delivery_note: string | null };

const TONE: Record<string, "gray" | "blue" | "green" | "amber" | "red"> = { pending: "amber", created: "blue", picked_up: "blue", in_transit: "blue", delivered: "green", partial_delivered: "amber", returned: "red", cancelled: "gray", failed: "red" };

export function CourierPanel({ order, shipments }: { order: Order; shipments: Shipment[] }) {
  const active = shipments.find((s) => !["failed", "cancelled"].includes(s.status));
  const providers = Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label, missing: p.missingConfig(), sandbox: p.sandbox }));
  const ready = providers.filter((p) => !p.missing.length);
  const cod = order.payment_method === "cod" && order.payment_status !== "paid" ? order.total : 0;
  const canBook = !active && ["confirmed", "packed"].includes(order.status);

  return (
    <Card title="Courier shipment">
      {active ? (
        <div className="rounded-2xl bg-paper p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <b className="capitalize">{PROVIDERS[active.provider]?.label ?? active.provider}</b>
            {active.is_sandbox && <Badge tone="amber">TEST — not a real parcel</Badge>}
            <Badge tone={TONE[active.status]}>{active.status.replace("_", " ")}</Badge>
          </div>
          {active.consignment_id && <p className="mt-2">Consignment <span className="font-mono font-semibold">{active.consignment_id}</span>{active.tracking_code && active.tracking_code !== active.consignment_id && <> · Tracking <span className="font-mono">{active.tracking_code}</span></>}</p>}
          <p className="mt-1 text-slate">COD to collect {formatTaka(active.cod_amount)}{active.cod_collected !== null && <> · collected {formatTaka(active.cod_collected)}</>} · updated {formatDateTime(active.updated_at)}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {active.tracking_url && <a href={active.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-electric underline">Tracking page <ExternalLink className="size-3.5" /></a>}
            {active.label_url && <a href={active.label_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-electric underline">Shipping label</a>}
            <a href={`/admin/invoice/${order.id}?slip=1`} target="_blank" className="font-semibold text-electric underline">Packing slip</a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!active.is_sandbox && active.consignment_id && (
              <ActionForm action={syncShipmentAction}><input type="hidden" name="shipmentId" value={active.id} /><input type="hidden" name="orderId" value={order.id} /><SubmitButton size="sm" variant="ghost">Check status with courier</SubmitButton></ActionForm>
            )}
            {active.is_sandbox && (["picked_up", "in_transit", "delivered", "returned"] as const).map((s) => (
              <ActionForm key={s} action={simulateSandboxAction}><input type="hidden" name="shipmentId" value={active.id} /><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="status" value={s} /><SubmitButton size="sm" variant="ghost">Simulate {s.replace("_", " ")}</SubmitButton></ActionForm>
            ))}
          </div>
          {["pending", "created"].includes(active.status) && (
            <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-slate">Cancel this shipment record</summary>
              <ActionForm action={cancelShipmentRecord} className="mt-2 flex gap-2"><input type="hidden" name="shipmentId" value={active.id} /><input type="hidden" name="orderId" value={order.id} /><input name="note" required placeholder="Reason" className="input h-10 min-h-0 text-sm" /><SubmitButton size="sm" variant="danger">Cancel</SubmitButton></ActionForm>
            </details>
          )}
        </div>
      ) : canBook ? (
        <ActionForm action={createShipmentAction} className="space-y-3">
          <input type="hidden" name="orderId" value={order.id} />
          <div className="rounded-2xl bg-paper p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate">Recipient — check before booking</p>
            <p className="mt-1 font-semibold">{order.customer_name} · <span className="font-mono">{order.phone}</span></p>
            <p>{order.address}{order.area ? `, ${order.area}` : ""}, {order.district}</p>
            <p className="mt-1">Cash to collect: <b>{formatTaka(cod)}</b>{cod === 0 && " (prepaid)"}</p>
            {order.delivery_note && <p className="text-slate">Note: {order.delivery_note}</p>}
          </div>
          <label className="block"><span className="label">Courier</span>
            <select name="provider" className="input" defaultValue={ready.find((p) => !p.sandbox)?.id ?? ready[0]?.id}>
              {providers.map((p) => <option key={p.id} value={p.id} disabled={p.missing.length > 0}>{p.label}{p.missing.length ? " — not configured" : ""}</option>)}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required className="mt-1 accent-electric" /> I&apos;ve checked the name, phone, address and cash amount.</label>
          <SubmitButton>Book shipment</SubmitButton>
          <p className="text-xs text-slate">Booking uses the order number as the courier invoice, and an order can have only one active shipment, so a double click can&apos;t create two parcels.</p>
        </ActionForm>
      ) : (
        <p className="text-sm text-slate">{order.status === "pending" ? "Confirm the order before booking a courier." : "No active shipment."}</p>
      )}
      {shipments.filter((s) => s !== active).length > 0 && (
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-slate">Previous attempts ({shipments.filter((s) => s !== active).length})</summary>
          <ul className="mt-2 space-y-2">{shipments.filter((s) => s !== active).map((s) => <li key={s.id} className="rounded-xl bg-paper p-3"><Badge tone={TONE[s.status]}>{s.status}</Badge> <b>{s.provider}</b> · {formatDateTime(s.created_at)}{s.last_error && <p className="mt-1 text-[#a3290f]">{s.last_error}</p>}</li>)}</ul>
        </details>
      )}
    </Card>
  );
}
