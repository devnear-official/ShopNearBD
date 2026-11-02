import "server-only";
import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import { CUSTOMER_STATUS, METHOD_LABEL, PAYMENT_STATUS } from "./order-status";
import { formatDateTime } from "./format";

export type InvoiceOrder = {
  order_number: string; status: string; payment_status: string; payment_method: string; customer_name: string; phone_masked: string;
  address: string; district: string; area: string | null; subtotal: number; discount_total: number; shipping_fee: number; total: number;
  coupon_code: string | null; created_at: string;
  items: { product_name: string; variant_name: string; quantity: number; unit_price: number; line_total: number }[];
};
export type InvoiceStore = { name: string; phone: string; email: string; address: string };

const FONTS = path.join(process.cwd(), "src/lib/invoice-fonts");
const LOGO = path.join(process.cwd(), "public/brand/logo-640.png");
const BN = /[ঀ-৿]/;
const INK = "#0b1530", SLATE = "#5b6479", LINE = "#e3e7ef", BLUE = "#1e6bff";

/**
 * Hind Siliguri ships Latin and Bengali glyphs in separate files; the Taka sign (৳) and Bangla text live in the
 * Bengali one. Text is split into runs so each run uses the file that has its glyphs.
 */
export function renderInvoice(o: InvoiceOrder, store: InvoiceStore): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 44, info: { Title: `Invoice ${o.order_number}`, Author: store.name } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (const w of ["400", "700"]) {
      doc.registerFont(`L${w}`, path.join(FONTS, `hind-siliguri-latin-${w}-normal.woff`));
      doc.registerFont(`B${w}`, path.join(FONTS, `hind-siliguri-bengali-${w}-normal.woff`));
    }

    const W = doc.page.width, M = 44, R = W - M;
    const runs = (s: string) => s.match(/[ঀ-৿]+|[^ঀ-৿]+/g) ?? [];
    const widthOf = (s: string, size: number, w: "400" | "700") => runs(s).reduce((a, r) => a + doc.font(`${BN.test(r) ? "B" : "L"}${w}`).fontSize(size).widthOfString(r), 0);
    /** Single-line text, optionally right-aligned at x. */
    const put = (s: string, x: number, y: number, o2: { size?: number; w?: "400" | "700"; color?: string; align?: "left" | "right"; width?: number } = {}) => {
      const size = o2.size ?? 10, w = o2.w ?? "400";
      doc.fillColor(o2.color ?? INK);
      let cx = o2.align === "right" ? x - widthOf(s, size, w) : x;
      for (const r of runs(s)) {
        doc.font(`${BN.test(r) ? "B" : "L"}${w}`).fontSize(size).text(r, cx, y, { lineBreak: false });
        cx += doc.widthOfString(r);
      }
    };
    const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
    /** Wrapped text block (used for names and addresses); returns its height. */
    const block = (s: string, x: number, y: number, width: number, size = 10, w: "400" | "700" = "400", color = INK) => {
      const lines: string[] = [];
      let line = "";
      for (const word of s.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (widthOf(t, size, w) > width && line) { lines.push(line); line = word; } else line = t;
      }
      if (line) lines.push(line);
      lines.forEach((l, i) => put(l, x, y + i * (size + 4), { size, w, color }));
      return lines.length * (size + 4);
    };

    // Header
    if (fs.existsSync(LOGO)) doc.image(LOGO, M, 40, { width: 150 });
    else put(store.name, M, 44, { size: 20, w: "700" });
    put("INVOICE", R, 44, { size: 24, w: "700", color: BLUE, align: "right" });
    put(o.order_number, R, 74, { size: 11, w: "700", align: "right" });
    put(`Date: ${formatDateTime(o.created_at)}`, R, 90, { size: 9, color: SLATE, align: "right" });
    doc.moveTo(M, 118).lineTo(R, 118).strokeColor(LINE).lineWidth(1).stroke();

    // Parties
    put("BILLED / DELIVERED TO", M, 132, { size: 8, w: "700", color: SLATE });
    put(o.customer_name, M, 146, { size: 12, w: "700" });
    put(o.phone_masked, M, 163, { size: 10, color: SLATE });
    const h = block([o.address, o.area, o.district].filter(Boolean).join(", "), M, 178, 250);
    put("FROM", 330, 132, { size: 8, w: "700", color: SLATE });
    put(store.name, 330, 146, { size: 12, w: "700" });
    let sy = 163;
    for (const l of [store.phone, store.email, store.address]) sy += block(l, 330, sy, R - 330, 9, "400", SLATE);

    // Items table
    let y = Math.max(178 + h, sy) + 22;
    const cols = { qty: 340, unit: 440, total: R };
    doc.rect(M, y, R - M, 24).fill("#f1f4fa");
    put("ITEM", M + 8, y + 7, { size: 8, w: "700", color: SLATE });
    put("QTY", cols.qty, y + 7, { size: 8, w: "700", color: SLATE, align: "right" });
    put("PRICE", cols.unit, y + 7, { size: 8, w: "700", color: SLATE, align: "right" });
    put("AMOUNT", cols.total - 8, y + 7, { size: 8, w: "700", color: SLATE, align: "right" });
    y += 24;
    for (const i of o.items) {
      const name = i.variant_name && i.variant_name !== "Default" ? `${i.product_name} (${i.variant_name})` : i.product_name;
      const rowH = Math.max(26, block(name, M + 8, y + 7, 250) + 14);
      if (y + rowH > doc.page.height - 200) { doc.addPage(); y = 60; block(name, M + 8, y + 7, 250); }
      put(String(i.quantity), cols.qty, y + 7, { align: "right" });
      put(taka(i.unit_price), cols.unit, y + 7, { align: "right" });
      put(taka(i.line_total), cols.total - 8, y + 7, { w: "700", align: "right" });
      y += rowH;
      doc.moveTo(M, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
    }

    // Totals
    y += 14;
    if (y > doc.page.height - 180) { doc.addPage(); y = 60; }
    const line = (label: string, value: string, bold = false, color = INK) => {
      put(label, 380, y, { size: bold ? 12 : 10, w: bold ? "700" : "400", color: bold ? INK : SLATE });
      put(value, R - 8, y, { size: bold ? 13 : 10, w: bold ? "700" : "400", color, align: "right" });
      y += bold ? 24 : 18;
    };
    line("Subtotal", taka(o.subtotal));
    if (o.discount_total > 0) line(`Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`, `-${taka(o.discount_total)}`, false, "#0b7a55");
    line("Delivery charge", o.shipping_fee === 0 ? "Free" : taka(o.shipping_fee));
    y += 2;
    doc.moveTo(380, y).lineTo(R, y).strokeColor(INK).lineWidth(1).stroke();
    y += 10;
    line("Total", taka(o.total), true);

    // Payment / status
    y += 8;
    const pay = PAYMENT_STATUS[o.payment_status]?.label ?? o.payment_status;
    put("PAYMENT", M, y, { size: 8, w: "700", color: SLATE });
    put(`${METHOD_LABEL[o.payment_method] ?? o.payment_method} — ${pay}`, M, y + 14, { size: 10 });
    put("ORDER STATUS", 330, y, { size: 8, w: "700", color: SLATE });
    put(CUSTOMER_STATUS[o.status]?.label ?? o.status, 330, y + 14, { size: 10 });
    put("Amounts are in Bangladeshi Taka (৳). This invoice reflects the order at the time of download.", M, doc.page.height - 70, { size: 8, color: SLATE });
    put(`Thank you for shopping with ${store.name}.`, M, doc.page.height - 56, { size: 9, w: "700", color: INK });
    doc.end();
  });
}
