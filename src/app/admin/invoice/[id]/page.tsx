import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getPublicSettings } from "@/lib/catalog";
import { formatDate, formatTaka } from "@/lib/format";
import { PrintButton } from "./print-button";

const METHOD: Record<string, string> = { cod: "Cash on Delivery", bkash_manual: "bKash", nagad_manual: "Nagad" };

export default function InvoicePage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ slip?: string }> }) {
  return <Suspense><Invoice {...props} /></Suspense>;
}

async function Invoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ slip?: string }> }) {
  const admin = await requireAdminPage();
  const [{ id }, { slip }] = await Promise.all([params, searchParams]);
  const isSlip = slip === "1";
  const data = await admin.db(async (tx) => {
    const [o] = await tx<{ id: string; order_number: string; created_at: Date; customer_name: string; phone: string; address: string; area: string | null; district: string; delivery_note: string | null; subtotal: number; discount_total: number; shipping_fee: number; total: number; payment_method: string; payment_status: string; coupon_code: string | null }[]>`select * from public.orders where id = ${id}`;
    if (!o) return null;
    const items = await tx<{ product_name: string; variant_name: string; sku: string; quantity: number; unit_price: number; line_total: number }[]>`select product_name, variant_name, sku, quantity, unit_price, line_total from public.order_items where order_id = ${id} order by product_name`;
    const [ship] = await tx<{ provider: string; consignment_id: string | null }[]>`select provider, consignment_id from public.shipments where order_id = ${id} and status not in ('failed','cancelled') limit 1`;
    return { o, items, ship };
  });
  if (!data) notFound();
  const { o, items, ship } = data;
  const store = (await getPublicSettings()).store;
  const due = o.payment_method === "cod" && o.payment_status !== "paid" ? o.total : 0;
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-ink print:p-0">
      <div className="mb-6 flex justify-end gap-2 print:hidden"><PrintButton /></div>
      <header className="flex items-start justify-between border-b-2 border-ink pb-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-640.png" alt={store.name} className="h-10 w-auto" />
          <p className="mt-2 text-xs">{store.address} · {store.phone} · {store.email}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{isSlip ? "PACKING SLIP" : "INVOICE"}</p>
          <p className="font-mono text-sm">{o.order_number}</p>
          <p className="text-sm">{formatDate(o.created_at)}</p>
        </div>
      </header>
      <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-xs font-bold uppercase">Deliver to</p><p className="font-semibold">{o.customer_name}</p><p>{o.phone}</p><p>{o.address}{o.area ? `, ${o.area}` : ""}, {o.district}</p>{o.delivery_note && <p className="italic">Note: {o.delivery_note}</p>}</div>
        <div className="text-right"><p className="text-xs font-bold uppercase">Payment</p><p>{METHOD[o.payment_method]} · {o.payment_status.replace("_", " ")}</p>{ship && <p className="mt-2">Courier: {ship.provider} {ship.consignment_id}</p>}{isSlip && <p className="mt-3 text-xl font-bold">COLLECT: {formatTaka(due)}</p>}</div>
      </section>
      <table className="mt-6 w-full text-sm">
        <thead><tr className="border-b border-ink text-left"><th className="py-2">Item</th><th>SKU</th><th className="text-right">Qty</th>{!isSlip && <><th className="text-right">Price</th><th className="text-right">Total</th></>}{isSlip && <th className="text-right">Packed ✓</th>}</tr></thead>
        <tbody>{items.map((i, k) => <tr key={k} className="border-b border-line"><td className="py-2">{i.product_name}{i.variant_name !== "Default" ? ` — ${i.variant_name}` : ""}</td><td className="font-mono text-xs">{i.sku}</td><td className="text-right">{i.quantity}</td>{!isSlip && <><td className="text-right">{formatTaka(i.unit_price)}</td><td className="text-right">{formatTaka(i.line_total)}</td></>}{isSlip && <td className="text-right">☐</td>}</tr>)}</tbody>
      </table>
      {!isSlip && (
        <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatTaka(o.subtotal)}</dd></div>
          {o.discount_total > 0 && <div className="flex justify-between"><dt>Discount {o.coupon_code}</dt><dd>−{formatTaka(o.discount_total)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{formatTaka(o.shipping_fee)}</dd></div>
          <div className="flex justify-between border-t border-ink pt-1 text-base font-bold"><dt>Total</dt><dd>{formatTaka(o.total)}</dd></div>
          <div className="flex justify-between"><dt>Amount due</dt><dd>{formatTaka(due)}</dd></div>
        </dl>
      )}
      <p className="mt-10 text-center text-xs text-slate">Thank you for shopping with {store.name}. Returns within 7 days — keep this {isSlip ? "slip" : "invoice"}.</p>
    </div>
  );
}
