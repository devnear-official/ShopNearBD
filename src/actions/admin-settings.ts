"use server";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { DISTRICTS } from "@/lib/shipping";
import type { ActionState } from "@/components/admin/form";

const bdNumber = z.string().trim().regex(/^(01[3-9]\d{8}|01X{9})$/, "Enter an 11-digit mobile number");
const on = (v: FormDataEntryValue | null) => v === "on";
import { SOCIALS } from "@/lib/social";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function build(key: string, f: FormData): { value?: unknown; error?: string; isPublic: boolean } {
  switch (key) {
    case "store": {
      const r = z.object({
        name: z.string().min(2).max(60), tagline: z.string().max(140), tagline_bn: z.string().max(140), phone: z.string().min(5).max(30),
        whatsapp: z.string().max(30), email: z.string().email(), address: z.string().min(3).max(200), hours: z.string().max(80),
        social: z.object(Object.fromEntries(SOCIALS.map((x) => [x.key, z.string().url().or(z.literal(""))]))),
      }).safeParse({ name: str(f, "name"), tagline: str(f, "tagline"), tagline_bn: str(f, "tagline_bn"), phone: str(f, "phone"), whatsapp: str(f, "whatsapp"), email: str(f, "email"), address: str(f, "address"), hours: str(f, "hours"), social: Object.fromEntries(SOCIALS.map((x) => [x.key, str(f, x.key)])) });
      return r.success ? { value: { ...r.data, dev_default: false }, isPublic: true } : { error: `${r.error.issues[0].path.join(".")}: ${r.error.issues[0].message}`, isPublic: true };
    }
    case "shipping": {
      const zones = [0, 1, 2, 3, 4].map((i) => ({ id: str(f, `zone_${i}_id`), label: str(f, `zone_${i}_label`), label_bn: str(f, `zone_${i}_label_bn`), fee: Number(str(f, `zone_${i}_fee`)), eta: str(f, `zone_${i}_eta`) })).filter((z) => z.id);
      const zr = z.array(z.object({ id: z.string().regex(/^[a-z_]{2,30}$/, "Zone id: lowercase letters/underscores"), label: z.string().min(2).max(60), label_bn: z.string().max(60), fee: z.number().min(0).max(5000), eta: z.string().max(40) })).min(1).safeParse(zones);
      if (!zr.success) return { error: zr.error.issues[0].message, isPublic: true };
      const ids = new Set(zones.map((z) => z.id));
      const district_zones: Record<string, string[]> = {};
      for (const line of str(f, "district_zones").split("\n").map((l) => l.trim()).filter(Boolean)) {
        const [d, rest] = line.split(":").map((s) => s.trim());
        if (!DISTRICTS.includes(d)) return { error: `Unknown district “${d}”`, isPublic: true };
        const list = (rest ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        for (const z of list) if (!ids.has(z)) return { error: `Unknown zone “${z}” for ${d}`, isPublic: true };
        district_zones[d] = list;
      }
      const def = str(f, "default_zone");
      if (!ids.has(def)) return { error: "Default zone must be one of the zones", isPublic: true };
      const free = str(f, "free_shipping_threshold");
      return { value: { zones, district_zones, default_zone: def, free_shipping_threshold: free ? Math.max(0, Number(free)) : null, dev_default: false }, isPublic: true };
    }
    case "payments": {
      const m = (k: string) => ({ enabled: on(f.get(`${k}_enabled`)), number: str(f, `${k}_number`), account_type: str(f, `${k}_type`) || "Personal", instructions: str(f, `${k}_instructions`) });
      const value = { cod: { enabled: on(f.get("cod_enabled")), note: str(f, "cod_note") }, bkash_manual: m("bkash_manual"), nagad_manual: m("nagad_manual"), dev_default: false };
      for (const k of ["bkash_manual", "nagad_manual"] as const) {
        if (value[k].enabled) {
          const n = bdNumber.safeParse(value[k].number);
          if (!n.success || /X/.test(value[k].number)) return { error: `Set a real ${k === "bkash_manual" ? "bKash" : "Nagad"} number before enabling it`, isPublic: true };
        }
      }
      if (!value.cod.enabled && !value.bkash_manual.enabled && !value.nagad_manual.enabled) return { error: "Keep at least one payment method enabled", isPublic: true };
      return { value, isPublic: true };
    }
    case "policies":
      return { value: { returns: str(f, "returns"), refunds: str(f, "refunds"), cancellation: str(f, "cancellation"), warranty: str(f, "warranty"), dev_default: false }, isPublic: true };
    case "homepage":
      return {
        value: {
          hero_eyebrow: str(f, "hero_eyebrow"), hero_title: str(f, "hero_title") || "Shop near.", hero_title_accent: str(f, "hero_title_accent"), hero_subtitle: str(f, "hero_subtitle"),
          hero_product_slug: str(f, "hero_product_slug") || null, campaign_title: str(f, "campaign_title"), campaign_body: str(f, "campaign_body"),
          campaign_collection: str(f, "campaign_collection").toLowerCase().replace(/\s+/g, "-"), marquee: str(f, "marquee").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8),
        }, isPublic: true,
      };
    case "ai": {
      const r = z.object({
        enabled: z.boolean(), model: z.string().regex(/^gemini-[a-z0-9.\-]+$/, "Use a Gemini model id, e.g. gemini-2.5-flash"), temperature: z.number().min(0).max(1),
        max_output_tokens: z.number().int().min(100).max(2000), per_ip_per_minute: z.number().int().min(1).max(60), per_conversation_per_hour: z.number().int().min(5).max(500),
        retention_days: z.number().int().min(7).max(730), greeting: z.string().max(300),
      }).safeParse({ enabled: on(f.get("enabled")), model: str(f, "model"), temperature: Number(str(f, "temperature")), max_output_tokens: Number(str(f, "max_output_tokens")), per_ip_per_minute: Number(str(f, "per_ip_per_minute")), per_conversation_per_hour: Number(str(f, "per_conversation_per_hour")), retention_days: Number(str(f, "retention_days")), greeting: str(f, "greeting") });
      return r.success ? { value: r.data, isPublic: false } : { error: r.error.issues[0].message, isPublic: false };
    }
    case "tracking": {
      const r = z.object({
        meta_pixel_id: z.string().regex(/^(\d{10,20})?$/, "Meta Pixel ID is the 15–16 digit number from Events Manager"),
        tiktok_pixel_id: z.string().regex(/^([A-Z0-9]{10,30})?$/, "TikTok Pixel ID looks like C1A2B3C4D5E6F7G8H9I0 (letters and digits)"),
        ga4_id: z.string().regex(/^(G-[A-Z0-9]{6,14})?$/, "Google Analytics ID looks like G-ABC123XYZ"),
        purchase_trigger: z.enum(["placed", "confirmed"]), tiktok_purchase_event: z.enum(["Purchase", "CompletePayment"]), server_events: z.boolean(),
      }).safeParse({ meta_pixel_id: str(f, "meta_pixel_id").replace(/\s/g, ""), tiktok_pixel_id: str(f, "tiktok_pixel_id").replace(/\s/g, "").toUpperCase(), ga4_id: str(f, "ga4_id").replace(/\s/g, "").toUpperCase(), purchase_trigger: str(f, "purchase_trigger"), tiktok_purchase_event: str(f, "tiktok_purchase_event"), server_events: on(f.get("server_events")) });
      return r.success ? { value: r.data, isPublic: true } : { error: r.error.issues[0].message, isPublic: true };
    }
    case "tracking_secrets": {
      // Blank token fields keep the saved token (they are never sent back to the browser).
      const r = z.object({
        meta_access_token: z.string().max(400).regex(/^[A-Za-z0-9_-]*$/, "That doesn't look like a Meta access token"),
        meta_test_event_code: z.string().max(40).regex(/^[A-Za-z0-9]*$/, "Test event code: letters and digits only"),
        tiktok_access_token: z.string().max(400).regex(/^[A-Za-z0-9_-]*$/, "That doesn't look like a TikTok access token"),
        tiktok_test_event_code: z.string().max(40).regex(/^[A-Za-z0-9]*$/, "Test event code: letters and digits only"),
      }).safeParse({ meta_access_token: str(f, "meta_access_token"), meta_test_event_code: str(f, "meta_test_event_code"), tiktok_access_token: str(f, "tiktok_access_token"), tiktok_test_event_code: str(f, "tiktok_test_event_code") });
      if (!r.success) return { error: r.error.issues[0].message, isPublic: false };
      return { value: { ...r.data, clear_meta: on(f.get("clear_meta")), clear_tiktok: on(f.get("clear_tiktok")) }, isPublic: false };
    }
  }
  return { error: "Unknown settings section", isPublic: false };
}

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const key = str(form, "key");
  const built = build(key, form);
  if (built.error) return { ok: false, error: built.error };
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      if (key === "tracking_secrets") {
        const [old] = await tx<{ value: Record<string, string> }[]>`select value from public.site_settings where key = 'tracking_secrets'`;
        const v = built.value as Record<string, string | boolean>;
        const keep = (k: string, clear: boolean) => (clear ? "" : (v[k] as string) || old?.value?.[k] || "");
        built.value = { meta_access_token: keep("meta_access_token", v.clear_meta === true), meta_test_event_code: v.meta_test_event_code, tiktok_access_token: keep("tiktok_access_token", v.clear_tiktok === true), tiktok_test_event_code: v.tiktok_test_event_code };
      }
      // Never copy access tokens into the audit log.
      const audited = key === "tracking_secrets" ? { tokens: "updated" } : built.value;
      await tx`insert into public.site_settings (key, value, is_public, updated_by, updated_at) values (${key}, ${tx.json(built.value as never)}, ${built.isPublic}, ${admin.id}, now())
        on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
      await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${admin.id}, ${admin.email ?? "admin"}, 'settings.update', 'settings', ${key}, ${tx.json(audited as never)})`;
    });
    updateTag("settings");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Saved. The store is updated." };
  } catch {
    return { ok: false, error: "Couldn't save settings." };
  }
}
