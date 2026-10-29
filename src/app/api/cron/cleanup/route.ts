import { NextResponse, type NextRequest } from "next/server";
import { aiSettings, purgeOld } from "@/lib/ai/chat-service";
import { system } from "@/lib/db";
import { safeEqual } from "@/lib/tokens";

/** Daily housekeeping (Vercel Cron: set CRON_SECRET). Deletes expired chats and old rate-limit windows. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await aiSettings();
  await purgeOld(s.retention_days);
  await system((tx) => tx`delete from public.rate_limits where window_start < now() - interval '1 day'`);
  return NextResponse.json({ ok: true, retention_days: s.retention_days });
}
