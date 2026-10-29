import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer/auth";
import { customerOrders } from "@/lib/customer/orders";

/** The signed-in customer's details for pre-filling checkout. Never cached. */
export async function GET() {
  const me = await currentCustomer();
  if (!me) return NextResponse.json({ signedIn: false }, { headers: { "cache-control": "private, no-store" } });
  const { last } = await customerOrders(me.phone);
  return NextResponse.json({
    signedIn: true,
    delivery: { name: me.name ?? last?.name ?? "", phone: me.phone, email: me.email ?? last?.email ?? "", district: last?.district ?? "", zone: last?.zone ?? "", area: last?.area ?? "", address: last?.address ?? "" },
  }, { headers: { "cache-control": "private, no-store" } });
}
