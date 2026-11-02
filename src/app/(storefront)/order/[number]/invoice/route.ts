import { NextResponse, type NextRequest } from "next/server";
import { asAnon } from "@/lib/db";
import { resolveOrderHash } from "@/lib/customer/order-access";
import { getPublicSettings } from "@/lib/catalog";
import { renderInvoice, type InvoiceOrder } from "@/lib/invoice-pdf";
import { clientIpHash, rateLimit } from "@/lib/rate-limit";

/**
 * Customer invoice PDF. Same proof of access as the order page (private token, signed link, or the signed-in
 * customer's own order). Every failure returns the same 404, so order numbers can't be probed.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const { number } = await ctx.params;
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  if (!(await rateLimit(`invoice:${await clientIpHash()}`, 30, 600))) return new NextResponse("Too many requests", { status: 429 });
  const sp = req.nextUrl.searchParams;
  const hash = await resolveOrderHash(number, { t: sp.get("t"), s: sp.get("s") });
  if (!hash) return notFound();
  const [row] = await asAnon((tx) => tx<{ o: InvoiceOrder | null }[]>`select public.get_order_public(${number}, ${hash}) as o`);
  if (!row?.o) return notFound();
  const store = (await getPublicSettings()).store;
  const pdf = await renderInvoice(row.o, { name: store.name, phone: store.phone, email: store.email, address: store.address });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="invoice-${number}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
