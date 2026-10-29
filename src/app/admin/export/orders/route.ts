import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { orderWhere, parseOrderFilters } from "@/lib/admin-orders";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const f = parseOrderFilters(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await admin.db((tx) => tx`
    select o.order_number, o.created_at, o.status, o.payment_method, o.payment_status, o.customer_name, o.phone, o.district, o.area, o.address,
      o.subtotal, o.discount_total, o.shipping_fee, o.total, o.coupon_code,
      (select string_agg(i.product_name || ' / ' || i.variant_name || ' x' || i.quantity, '; ') from public.order_items i where i.order_id = o.id) as items,
      (select s.provider || ':' || coalesce(s.consignment_id, '') from public.shipments s where s.order_id = o.id and s.status not in ('failed','cancelled') limit 1) as shipment
    from public.orders o ${orderWhere(tx, f)} order by o.created_at desc limit 10000`);
  const cols = ["order_number", "created_at", "status", "payment_method", "payment_status", "customer_name", "phone", "district", "area", "address", "subtotal", "discount_total", "shipping_fee", "total", "coupon_code", "items", "shipment"];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
  await admin.db((tx) => tx`insert into public.audit_logs (actor_id, actor_label, action, entity, data) values (${admin.id}, ${admin.email ?? "admin"}, 'orders.export', 'order', ${tx.json({ count: rows.length, filters: { ...f } })})`);
  return new NextResponse("﻿" + csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}
