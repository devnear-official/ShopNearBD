"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { requestContext, sendServerEvent, trackingConfig } from "@/lib/tracking/server";
import type { ActionState } from "@/components/admin/form";

/**
 * Sends one ViewContent event through the Conversions API / Events API so the
 * admin can confirm the token works. With a test event code set, it shows up
 * under "Test events" in Meta Events Manager / TikTok Events Manager.
 */
export async function sendTrackingTest(): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Sign in again." };
  }
  const cfg = await trackingConfig();
  if (!cfg.metaToken && !cfg.tiktokToken) return { ok: false, error: "Add a Meta or TikTok access token first." };
  const ctx = await requestContext();
  const results = await sendServerEvent({
    name: "ViewContent",
    eventId: `test-${Date.now().toString(36)}`,
    context: ctx,
    params: { value: 100, currency: "BDT", items: [{ id: "TEST-SKU", name: "Tracking test", quantity: 1, price: 100 }] },
  }, { ...cfg, serverEvents: true });
  revalidatePath("/admin/settings");
  const lines = results.map((r) => `${r.platform === "meta" ? "Meta" : "TikTok"}: ${r.status}${r.detail ? ` (${r.detail})` : ""}`);
  const ok = results.some((r) => r.status === "sent") && !results.some((r) => r.status === "failed");
  return ok ? { ok: true, message: lines.join(" · ") } : { ok: false, error: lines.join(" · ") || "Nothing was sent." };
}
