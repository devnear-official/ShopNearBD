import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { RELAYABLE, type TrackEvent } from "@/lib/tracking/events";
import { requestContext, sendServerEvent, trackingConfig } from "@/lib/tracking/server";
import { clientIpHash, rateLimit } from "@/lib/rate-limit";

/**
 * Browser → server relay for non-purchase events, sent with the same event_id
 * as the pixel so Meta/TikTok deduplicate them. Purchases are never accepted
 * here; they are sent from the order record.
 */
const item = z.object({ id: z.string().min(1).max(80), name: z.string().max(160).optional(), quantity: z.number().int().min(1).max(100), price: z.number().min(0).max(10_000_000), category: z.string().max(80).optional() });
const body = z.object({
  event: z.enum(RELAYABLE as [TrackEvent, ...TrackEvent[]]),
  eventId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  url: z.string().url().max(500),
  referrer: z.string().max(500).optional(),
  ttclid: z.string().max(200).optional(),
  params: z.object({ value: z.number().min(0).max(10_000_000).optional(), items: z.array(item).max(30).optional(), search: z.string().max(120).optional() }).default({}),
});

export async function POST(req: NextRequest) {
  // sendBeacon posts text/plain; Request.json() parses the body regardless of content type.
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await rateLimit(`track:${await clientIpHash()}`, 120, 60))) return NextResponse.json({ ok: false }, { status: 429 });
  const ctx = await requestContext();
  const d = parsed.data;
  after(async () => {
    const cfg = await trackingConfig();
    if (!cfg.metaToken && !cfg.tiktokToken) return;
    await sendServerEvent({ name: d.event, eventId: d.eventId, context: { ...ctx, url: d.url, referrer: d.referrer ?? null, ttclid: d.ttclid ?? null }, params: { ...d.params, currency: "BDT" } }, cfg);
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
