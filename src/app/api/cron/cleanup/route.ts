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
  // Ad-matching data (IP, user agent, browser IDs) is useless after 8 days (Meta accepts events up to 7 days old).
  await system((tx) => tx`update public.orders set attribution = attribution - 'ip' - 'user_agent' - 'fbp' - 'fbc' - 'ttp'
    where created_at < now() - interval '8 days' and attribution ?| array['ip', 'user_agent', 'fbp', 'fbc', 'ttp']`);
  await system((tx) => tx`delete from public.tracking_events where created_at < now() - interval '90 days'`);
  // Customer login: used/expired codes, expired sessions, old SMS log rows.
  await system((tx) => tx`delete from public.customer_otps where created_at < now() - interval '1 day'`);
  await system((tx) => tx`delete from public.customer_sessions where expires_at < now()`);
  await system((tx) => tx`delete from public.dev_sms_outbox where created_at < now() - interval '1 day'`);
  await system((tx) => tx`delete from public.sms_log where created_at < now() - interval '90 days'`);
  return NextResponse.json({ ok: true, retention_days: s.retention_days });
}
