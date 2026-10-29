import { NextResponse, type NextRequest } from "next/server";
import { CourierError, getProvider } from "@/lib/couriers";
import { applyCourierEvent } from "@/lib/couriers/service";

/** Courier status webhooks: /api/couriers/{steadfast|pathao|redx}/webhook. Authenticated per provider. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const provider = getProvider(id);
  if (!provider?.parseWebhook || provider.id === "sandbox") return NextResponse.json({ error: "not found" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const parsed = provider.parseWebhook(req.headers, body, req.nextUrl);
    const events = Array.isArray(parsed) ? parsed : [parsed];
    const results = [];
    for (const ev of events) results.push(await applyCourierEvent(provider.id, ev));
    return NextResponse.json({ ok: true, results }, { status: 202 });
  } catch (e) {
    if (e instanceof CourierError && e.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error(`courier webhook ${id}`, e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
