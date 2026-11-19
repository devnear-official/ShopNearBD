import "server-only";
import nodemailer from "nodemailer";
import { system } from "./db";

type Order = {
  id: string; order_number: string; customer_name: string; phone: string; email: string | null;
  address: string; area: string | null; district: string; delivery_note: string | null;
  subtotal: number; discount_total: number; shipping_fee: number; total: number;
  payment_method: string; created_at: Date;
};
type Item = { product_name: string; variant_name: string; sku: string; quantity: number; unit_price: number; line_total: number };

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const taka = (n: number) => `৳${Number(n).toLocaleString("en-BD")}`;

/** Sends a new-order alert to the store inbox. Missing SMTP settings disable alerts without affecting checkout. */
export async function notifyNewOrderEmail(orderId: string): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, ORDER_NOTIFICATION_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !ORDER_NOTIFICATION_EMAIL) return;

  try {
    const [order] = await system((tx) => tx<Order[]>`select id, order_number, customer_name, phone, email, address, area, district, delivery_note,
      subtotal, discount_total, shipping_fee, total, payment_method, created_at from public.orders where id = ${orderId}`);
    if (!order) return;
    const items = await system((tx) => tx<Item[]>`select product_name, variant_name, sku, quantity, unit_price, line_total from public.order_items where order_id = ${orderId} order by product_name`);
    const method = ({ cod: "Cash on Delivery", bkash_manual: "bKash", nagad_manual: "Nagad" } as Record<string, string>)[order.payment_method] ?? order.payment_method;
    const lines = items.map((i) => `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""} × ${i.quantity} — ${taka(Number(i.line_total))}`);
    const address = [order.address, order.area, order.district].filter(Boolean).join(", ");
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const adminUrl = siteUrl ? `${siteUrl}/admin/orders/${order.id}` : "";
    const html = `<h2>New order ${escapeHtml(order.order_number)}</h2>
      <p><strong>${escapeHtml(order.customer_name)}</strong> · ${escapeHtml(order.phone)}${order.email ? ` · ${escapeHtml(order.email)}` : ""}</p>
      <p>${escapeHtml(address)}${order.delivery_note ? `<br>Delivery note: ${escapeHtml(order.delivery_note)}` : ""}</p>
      <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse"><thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Total</th></tr></thead><tbody>${items.map((i) => `<tr><td>${escapeHtml(i.product_name)}${i.variant_name ? ` (${escapeHtml(i.variant_name)})` : ""}</td><td>${escapeHtml(i.sku)}</td><td>${i.quantity}</td><td>${taka(Number(i.line_total))}</td></tr>`).join("")}</tbody></table>
      <p>Subtotal: ${taka(Number(order.subtotal))}<br>Discount: ${taka(Number(order.discount_total))}<br>Delivery: ${taka(Number(order.shipping_fee))}<br><strong>Total: ${taka(Number(order.total))}</strong><br>Payment: ${escapeHtml(method)}</p>
      ${adminUrl ? `<p><a href="${escapeHtml(adminUrl)}">Open order in admin</a></p>` : ""}`;
    const text = [`New order ${order.order_number}`, `Customer: ${order.customer_name} · ${order.phone}${order.email ? ` · ${order.email}` : ""}`, `Address: ${address}`, order.delivery_note ? `Delivery note: ${order.delivery_note}` : "", "Items:", ...lines, `Subtotal: ${taka(Number(order.subtotal))}`, `Discount: ${taka(Number(order.discount_total))}`, `Delivery: ${taka(Number(order.shipping_fee))}`, `Total: ${taka(Number(order.total))}`, `Payment: ${method}`, adminUrl].filter(Boolean).join("\n");

    const port = Number(SMTP_PORT);
    const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to: ORDER_NOTIFICATION_EMAIL, subject: `New order ${order.order_number} — ${taka(Number(order.total))}`, text, html });
  } catch (e) {
    console.error("Order email failed", (e as Error).message);
  }
}
