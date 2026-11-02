import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime, formatTaka } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, Empty, ORDER_TONE, PageHeader, PAY_LABEL, PAY_TONE, STATUS_LABEL } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton, TextArea } from "@/components/admin/form";
import { addOrderNote, postOrderUpdate, recordCod, recordRefund, saveManualShipment, transitionOrder, updateOrderDelivery, verifyPayment } from "@/actions/admin-orders";
import { SMS_EVENT_LABEL, type SmsEvent } from "@/lib/order-sms";
import { buttonClass } from "@/components/ui/button";
import { CourierPanel } from "@/components/admin/courier-panel";
import { CustomerCheck } from "@/components/admin/customer-check";
import { getPublicSettings } from "@/lib/catalog";
import { confirmMessage } from "@/lib/whatsapp";
import type { RiskInput } from "@/lib/risk";

const NEXT: Record<string, { to: string; label: string; variant: "primary" | "dark" | "danger" | "ghost" }[]> = {
  pending: [{ to: "confirmed", label: "Confirm order", variant: "primary" }, { to: "cancelled", label: "Reject / cancel", variant: "danger" }],
  confirmed: [{ to: "packed", label: "Mark packed", variant: "primary" }, { to: "shipped", label: "Mark shipped (manual)", variant: "ghost" }, { to: "cancelled", label: "Cancel", variant: "danger" }],
  packed: [{ to: "shipped", label: "Mark shipped (manual)", variant: "ghost" }, { to: "cancelled", label: "Cancel", variant: "danger" }],
  shipped: [{ to: "delivered", label: "Mark delivered", variant: "primary" }, { to: "returned", label: "Mark returned", variant: "danger" }],
  delivered: [{ to: "returned", label: "Record return", variant: "danger" }],
};
const METHOD: Record<string, string> = { cod: "Cash on Delivery", bkash_manual: "bKash (manual)", nagad_manual: "Nagad (manual)" };

type Order = {
  id: string; order_number: string; status: string; payment_status: string; payment_method: string; customer_name: string; phone: string; email: string | null;
  address: string; district: string; area: string | null; zone: string; delivery_note: string | null; subtotal: number; discount_total: number; shipping_fee: number;
  total: number; coupon_code: string | null; created_at: Date; cancel_reason: string | null; ip_hash: string | null;
  attribution: Record<string, string> | null; purchase_tracked_at: Date | null;
};

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await admin.db(async (tx) => {
    const [o] = await tx<Order[]>`select * from public.orders where id = ${id}`;
    if (!o) return null;
    const [items, payments, history, notes, shipments, prior, updates, sms] = await Promise.all([
      tx<{ id: string; product_id: string | null; product_name: string; variant_name: string; sku: string; quantity: number; unit_price: number; line_total: number; image_url: string | null }[]>`select * from public.order_items where order_id = ${id} order by product_name`,
      tx<{ id: string; method: string; status: string; amount: number; sender_number: string | null; transaction_id: string | null; proof_path: string | null; note: string | null; verified_at: Date | null; created_at: Date }[]>`select * from public.payments where order_id = ${id} order by created_at`,
      tx<{ id: number; from_status: string | null; to_status: string; note: string | null; actor_label: string; created_at: Date }[]>`select * from public.order_status_history where order_id = ${id} order by id`,
      tx<{ id: number; body: string; actor_label: string; created_at: Date }[]>`select * from public.order_notes where order_id = ${id} order by id desc`,
      tx<{ id: string; provider: string; courier_name: string | null; is_sandbox: boolean; status: string; consignment_id: string | null; tracking_code: string | null; tracking_url: string | null; label_url: string | null; cod_amount: number; cod_collected: number | null; last_error: string | null; attempts: number; created_at: Date; updated_at: Date }[]>`
        select id, provider, courier_name, is_sandbox, status, consignment_id, tracking_code, tracking_url, label_url, cod_amount, cod_collected, last_error, attempts, created_at, updated_at from public.shipments where order_id = ${id} order by created_at desc`,
      tx<{ r: RiskInput }[]>`select public.customer_risk(${o.phone}) as r`.then((x) => x[0].r),
      tx<{ id: number; stage: string; message: string | null; actor_label: string; created_at: Date }[]>`select id, stage, message, actor_label, created_at from public.order_updates where order_id = ${id} order by id desc`,
      tx<{ id: number; event: SmsEvent; status: string; detail: string | null; attempts: number; created_at: Date }[]>`select id, event, status, detail, attempts, created_at from public.order_sms where order_id = ${id} order by id desc`,
    ]);
    return { o, items, payments, history, notes, shipments, risk: prior, updates, sms };
  });
  if (!data) notFound();
  const { o, items, payments, history, notes, shipments, risk, updates, sms } = data;
  const store = (await getPublicSettings()).store;
  const confirmText = confirmMessage({
    store: store.name, name: o.customer_name, orderNumber: o.order_number, total: o.total, method: o.payment_method as "cod" | "bkash_manual" | "nagad_manual", address: o.address + (o.area ? `, ${o.area}` : ""), district: o.district,
    items: items.map((i) => `• ${i.product_name}${i.variant_name !== "Default" ? ` (${i.variant_name})` : ""} × ${i.quantity}`).join("\n"),
  });

  const proofUrls = new Map<string, string>();
  for (const p of payments.filter((x) => x.proof_path)) {
    try {
      const { data: s } = await supabaseAdmin().storage.from("payment-proofs").createSignedUrl(p.proof_path!, 300);
      if (s?.signedUrl) proofUrls.set(p.id, s.signedUrl);
    } catch {}
  }
  const paid = payments.filter((p) => p.status === "verified").reduce((a, p) => a + p.amount, 0);
  const refunded = -payments.filter((p) => p.status === "refund").reduce((a, p) => a + p.amount, 0);
  const editable = ["pending", "confirmed", "packed"].includes(o.status);

  return (
    <>
      <PageHeader title={o.order_number} back={{ href: "/admin/orders", label: "Orders" }}
        description={<>Placed {formatDateTime(o.created_at)} · <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge> <Badge tone={PAY_TONE[o.payment_status]}>{PAY_LABEL[o.payment_status]}</Badge></>}
        actions={<a href={`/admin/invoice/${o.id}`} target="_blank" className={buttonClass("ghost", "sm")}><Printer className="size-4" /> Invoice / packing slip</a>} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card title="Items">
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cloud">{i.image_url && <Image src={i.image_url} alt="" fill sizes="56px" className="object-cover" />}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="font-semibold hover:underline">{i.product_name}</Link> : <span className="font-semibold">{i.product_name}</span>}
                    <span className="block text-slate">{i.variant_name} · <span className="font-mono text-xs">{i.sku}</span></span>
                  </span>
                  <span className="text-sm tabular-nums">{i.quantity} × {formatTaka(i.unit_price)}</span>
                  <span className="w-20 text-right font-semibold tabular-nums">{formatTaka(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd>{formatTaka(o.subtotal)}</dd></div>
              {o.discount_total > 0 && <div className="flex justify-between"><dt className="text-slate">Discount ({o.coupon_code})</dt><dd>−{formatTaka(o.discount_total)}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate">Delivery ({o.zone.replace(/_/g, " ")})</dt><dd>{formatTaka(o.shipping_fee)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatTaka(o.total)}</dd></div>
            </dl>
          </Card>

          <Card title="Payment" actions={<span className="text-sm text-slate">{METHOD[o.payment_method]}</span>}>
            <p className="text-sm">Collected <b>{formatTaka(paid)}</b>{refunded > 0 && <> · refunded <b>{formatTaka(refunded)}</b></>} of {formatTaka(o.total)}</p>
            {payments.length === 0 && <p className="mt-2 text-sm text-slate">{o.payment_method === "cod" ? "Cash is collected on delivery. Record it below once the courier settles." : "The customer hasn't submitted a transaction yet."}</p>}
            <ul className="mt-3 space-y-3">
              {payments.map((p) => (
                <li key={p.id} className="rounded-2xl bg-paper p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={p.status === "verified" ? "green" : p.status === "pending" ? "amber" : p.status === "refund" ? "gray" : "red"}>{p.status === "refund" ? "Refund" : p.status}</Badge>
                    <b className="tabular-nums">{formatTaka(p.amount)}</b>
                    <span className="text-slate">{METHOD[p.method]} · {formatDateTime(p.created_at)}</span>
                  </div>
                  {p.transaction_id && <p className="mt-2">TrxID <span className="font-mono font-semibold">{p.transaction_id}</span> from <span className="font-mono">{p.sender_number}</span></p>}
                  {p.note && <p className="mt-1 text-slate">{p.note}</p>}
                  {proofUrls.get(p.id) && <a href={proofUrls.get(p.id)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold text-electric underline">View screenshot (link expires in 5 min)</a>}
                  {p.status === "pending" && (
                    <ActionForm action={verifyPayment} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="orderId" value={o.id} />
                      <label className="min-w-48 flex-1"><span className="label">Note</span><input name="note" placeholder="e.g. matched in statement 14:20" className="input" /></label>
                      <SubmitButton size="sm" name="decision" value="approve" className="bg-mint hover:bg-[#0e9f6e]">✓ Matched — verify</SubmitButton>
                      <SubmitButton size="sm" name="decision" value="reject" variant="danger">Reject</SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
            {o.payment_method !== "cod" && <p className="mt-3 text-xs text-slate">Verify only after you have matched the TrxID and amount in the merchant account. A screenshot alone is not proof.</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {o.payment_method === "cod" && o.payment_status !== "paid" && ["shipped", "delivered"].includes(o.status) && (
                <ActionForm action={recordCod} className="rounded-2xl bg-paper p-4">
                  <input type="hidden" name="orderId" value={o.id} />
                  <p className="mb-2 text-sm font-semibold">Record COD collected</p>
                  <Field label="Amount (৳)" name="amount" type="number" min={1} step="1" defaultValue={o.total} required />
                  <Field label="Note" name="note" placeholder="Courier settlement ref." className="mt-2" />
                  <SubmitButton size="sm" className="mt-3">Record collection</SubmitButton>
                </ActionForm>
              )}
              {paid - refunded > 0 && (
                <ActionForm action={recordRefund} className="rounded-2xl bg-paper p-4">
                  <input type="hidden" name="orderId" value={o.id} />
                  <p className="mb-2 text-sm font-semibold">Record a refund</p>
                  <Field label="Amount (৳)" name="amount" type="number" min={1} max={paid - refunded} step="1" required />
                  <Field label="Reason & how it was sent" name="note" required placeholder="e.g. bKash to 017… for damaged item" className="mt-2" />
                  <SubmitButton size="sm" variant="danger" className="mt-3" confirm="Record this refund? It is permanent.">Record refund</SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>

          <CourierPanel order={{ id: o.id, status: o.status, total: o.total, payment_method: o.payment_method, payment_status: o.payment_status, customer_name: o.customer_name, phone: o.phone, address: o.address, area: o.area, district: o.district, delivery_note: o.delivery_note }} shipments={shipments} />

          <Card title="Customer tracking">
            <p className="mb-3 text-xs text-slate">What you publish here appears on the customer&apos;s Track Order page. Internal notes stay private.</p>
            {!["delivered", "cancelled", "returned"].includes(o.status) && (
              <ActionForm action={postOrderUpdate} className="space-y-2 rounded-2xl bg-paper p-3" resetOnSuccess>
                <input type="hidden" name="orderId" value={o.id} />
                <label className="block"><span className="label">Progress update</span>
                  <select name="stage" className="input"><option value="processing">Processing (after confirmed)</option><option value="out_for_delivery">Out for delivery (after shipped)</option><option value="info">Message only</option></select></label>
                <Field label="Message shown to customer" name="message" maxLength={300} placeholder="Optional for Processing / Out for delivery" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sms" value="yes" defaultChecked className="accent-electric" /> Also send the customer an SMS</label>
                <SubmitButton size="sm">Publish update</SubmitButton>
              </ActionForm>
            )}
            {!shipments.some((x) => x.provider !== "manual" && !["failed", "cancelled"].includes(x.status)) && !["cancelled", "returned"].includes(o.status) && (
              <ActionForm action={saveManualShipment} className="mt-3 grid gap-2 rounded-2xl bg-paper p-3">
                <p className="text-sm font-semibold">Courier details (manual)</p>
                <input type="hidden" name="orderId" value={o.id} />
                <Field label="Courier name" name="courier_name" required maxLength={60} defaultValue={shipments.find((x) => x.provider === "manual")?.courier_name ?? ""} />
                <Field label="Tracking / consignment ID" name="tracking_code" required maxLength={80} defaultValue={shipments.find((x) => x.provider === "manual")?.tracking_code ?? ""} />
                <Field label="Tracking link" name="tracking_url" type="url" placeholder="https://" hint="optional" defaultValue={shipments.find((x) => x.provider === "manual")?.tracking_url ?? ""} />
                <SubmitButton size="sm" variant="dark">Save courier details</SubmitButton>
              </ActionForm>
            )}
            {updates.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {updates.map((u) => <li key={u.id}><b>{u.stage === "out_for_delivery" ? "Out for delivery" : u.stage === "processing" ? "Processing" : "Message"}</b>{u.message && <> — {u.message}</>} <span className="text-xs text-mist">· {u.actor_label} · {formatDateTime(u.created_at)}</span></li>)}
              </ul>
            )}
            {sms.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate">SMS sent</p>
                <ul className="space-y-1 text-sm">
                  {sms.map((m) => <li key={m.id}>{SMS_EVENT_LABEL[m.event]} · <Badge tone={m.status === "sent" ? "green" : m.status === "failed" ? "red" : "gray"}>{m.status}</Badge> <span className="text-xs text-mist">{formatDateTime(m.created_at)}{m.detail ? ` · ${m.detail}` : ""}</span></li>)}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Timeline">
            <ol className="relative space-y-4 border-l-2 border-line pl-5 text-sm">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[1.6rem] top-1 size-3 rounded-full bg-electric ring-4 ring-white" />
                  <p><b>{STATUS_LABEL[h.to_status]}</b>{h.from_status && <span className="text-slate"> from {STATUS_LABEL[h.from_status]}</span>} · <span className="text-slate">{h.actor_label}</span></p>
                  {h.note && <p className="text-slate">“{h.note}”</p>}
                  <p className="text-xs text-mist">{formatDateTime(h.created_at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card title="Next step">
            {NEXT[o.status] ? (
              <div className="space-y-3">
                {NEXT[o.status].map((n) => (
                  <ActionForm key={n.to} action={transitionOrder} className="rounded-2xl bg-paper p-3">
                    <input type="hidden" name="orderId" value={o.id} /><input type="hidden" name="to" value={n.to} />
                    <input name="note" placeholder={n.variant === "danger" ? "Reason (required)" : "Note (optional)"} className="input mb-2 h-10 min-h-0 text-sm" required={n.variant === "danger"} />
                    {n.to === "returned" && <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" name="restock" value="no" className="accent-electric" /> Item damaged — don&apos;t return to stock</label>}
                    <SubmitButton size="sm" variant={n.variant} className="w-full" confirm={n.variant === "danger" ? `Mark this order ${n.to}?` : undefined}>{n.label}</SubmitButton>
                  </ActionForm>
                ))}
              </div>
            ) : <p className="text-sm text-slate">This order is closed ({STATUS_LABEL[o.status]}).{o.cancel_reason ? ` Reason: ${o.cancel_reason}` : ""}</p>}
            {o.payment_method !== "cod" && o.status === "pending" && o.payment_status !== "paid" && <p className="mt-3 rounded-xl bg-sun/15 p-3 text-xs font-medium text-[#7a4d05]">Advance payment not verified yet. Verify it before confirming, or confirm only after calling the customer.</p>}
          </Card>

          <CustomerCheck phone={o.phone} risk={risk} confirmText={confirmText} />

          <Card title="Customer & delivery">
            <p className="font-semibold">{o.customer_name}</p>
            <p className="text-sm"><a href={`tel:${o.phone}`} className="font-mono text-electric">{o.phone}</a>{o.email && <> · {o.email}</>}</p>
            <p className="mt-2 text-sm">{o.address}{o.area ? `, ${o.area}` : ""}, <b>{o.district}</b></p>
            {o.delivery_note && <p className="mt-2 rounded-xl bg-sun/15 p-2 text-sm">Note: {o.delivery_note}</p>}
            {editable && (
              <details className="mt-3 rounded-2xl bg-paper p-3">
                <summary className="cursor-pointer text-sm font-semibold">Edit delivery details</summary>
                <ActionForm action={updateOrderDelivery} className="mt-3 space-y-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <Field label="Name" name="customer_name" defaultValue={o.customer_name} required />
                  <Field label="Phone" name="phone" defaultValue={o.phone} required />
                  <TextArea label="Address" name="address" defaultValue={o.address} rows={2} required />
                  <Field label="Area" name="area" defaultValue={o.area ?? ""} />
                  <Field label="Delivery note" name="delivery_note" defaultValue={o.delivery_note ?? ""} />
                  <SubmitButton size="sm">Save</SubmitButton>
                </ActionForm>
              </details>
            )}
          </Card>

          <Card title="Source">
            <SourceDetails a={o.attribution ?? {}} tracked={o.purchase_tracked_at} />
          </Card>

          <Card title="Internal notes">
            <ActionForm action={addOrderNote} resetOnSuccess className="mb-3">
              <input type="hidden" name="orderId" value={o.id} />
              <textarea name="body" rows={2} placeholder="Visible to admins only" className="input" required />
              <SubmitButton size="sm" variant="dark" className="mt-2">Add note</SubmitButton>
            </ActionForm>
            {notes.length ? (
              <ul className="space-y-2 text-sm">{notes.map((n) => <li key={n.id} className="rounded-xl bg-paper p-3"><p className="whitespace-pre-line">{n.body}</p><p className="mt-1 text-xs text-slate">{n.actor_label} · {formatDateTime(n.created_at)}</p></li>)}</ul>
            ) : <Empty>No notes yet.</Empty>}
          </Card>
        </div>
      </div>
    </>
  );
}

const CHANNEL: Record<string, string> = { facebook: "Facebook / Instagram ad", tiktok: "TikTok ad", google: "Google", utm_source: "Tagged link", referral: "Referral", direct: "Direct / unknown" };

function SourceDetails({ a, tracked }: { a: Record<string, string>; tracked: Date | null }) {
  const rows: [string, string | undefined][] = [
    ["Campaign", a.utm_campaign], ["Source / medium", [a.utm_source, a.utm_medium].filter(Boolean).join(" / ") || undefined], ["Ad set / content", a.utm_content], ["Term", a.utm_term],
    ["Landing page", a.landing], ["Referrer", a.referrer], ["Click ID", a.fbclid ? "fbclid ✓" : a.ttclid ? "ttclid ✓" : a.gclid ? "gclid ✓" : undefined],
  ];
  return (
    <div className="text-sm">
      <p className="font-semibold">{CHANNEL[a.channel ?? "direct"] ?? a.channel}</p>
      <dl className="mt-2 space-y-1">
        {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-32 shrink-0 text-slate">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}
      </dl>
      <p className="mt-2 text-xs text-slate">{tracked ? `Purchase sent to ad platforms (server) at ${formatDateTime(tracked)}.` : "Purchase not sent from the server yet."}</p>
    </div>
  );
}
