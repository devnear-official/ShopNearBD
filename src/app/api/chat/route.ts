import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadThread, sendMessage } from "@/lib/ai/chat-service";
import { clientIpHash } from "@/lib/rate-limit";
import { currentCustomer } from "@/lib/customer/auth";

const noStore = { "cache-control": "no-store" };

/** GET /api/chat?since=<id> with header x-chat-token → greeting, mode and new messages. */
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-chat-token") ?? undefined;
  const since = Math.max(0, Number(req.nextUrl.searchParams.get("since")) || 0);
  try {
    return NextResponse.json(await loadThread(token, since), { headers: noStore });
  } catch (e) {
    console.error("chat GET", e);
    return NextResponse.json({ error: "Chat is unavailable right now." }, { status: 503, headers: noStore });
  }
}

const body = z.object({
  message: z.string().max(2000).default(""),
  human: z.boolean().optional(),
  orders: z.array(z.object({ number: z.string().max(20), token: z.string().max(200) })).max(5).default([]),
});

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400, headers: noStore });
  try {
    const r = await sendMessage({ token: req.headers.get("x-chat-token") ?? undefined, message: parsed.data.message, orders: parsed.data.orders, wantHuman: parsed.data.human, ipHash: await clientIpHash(), customerPhone: (await currentCustomer())?.phone ?? null });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
    return NextResponse.json(r, { headers: noStore });
  } catch (e) {
    console.error("chat POST", e);
    return NextResponse.json({ error: "Sorry — the assistant is unavailable. Please call us or try again shortly." }, { status: 503, headers: noStore });
  }
}
