"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { notifyOrderEvent, SMS_EVENTS, type SmsEvent } from "@/lib/order-sms";
import { system } from "@/lib/db";
import type { ActionState } from "@/components/admin/form";

/** Templates may use {name} {order}; the Track Order link is always added at the end by the sender. */
export async function saveSmsTemplates(_: ActionState, form: FormData): Promise<ActionState> {
  const templates: Record<string, string> = {};
  const disabled: string[] = [];
  for (const e of SMS_EVENTS) {
    const t = String(form.get(`t_${e}`) ?? "").trim();
    if (t.length < 5 || t.length > 160) return { ok: false, error: `“${e}” message must be 5–160 characters (the tracking link is added after it).` };
    if (/\{(?!name\}|order\}|link\})/.test(t)) return { ok: false, error: `“${e}”: only {name}, {order} and {link} can be used.` };
    templates[e] = t;
    if (form.get(`on_${e}`) !== "on") disabled.push(e);
  }
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      await tx`insert into public.site_settings (key, value, is_public) values ('sms_templates', ${tx.json({ templates, disabled })}, false)
        on conflict (key) do update set value = excluded.value, is_public = false`;
      await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${admin.id}, ${admin.email ?? "admin"}, 'sms.templates', 'settings', null, ${tx.json({ disabled })})`;
    });
    revalidatePath("/admin/sms");
    return { ok: true, message: "SMS templates saved." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Retry a failed order SMS. Only sends if the order is still in the state the message announces. */
export async function resendOrderSms(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ id: z.coerce.number().int().positive() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    await requireAdmin();
    const [row] = await system((tx) => tx<{ order_id: string; event: SmsEvent; status: string }[]>`select order_id, event, status from public.order_sms where id = ${p.data.id}`);
    if (!row) return { ok: false, error: "Not found." };
    if (row.status === "sent") return { ok: false, error: "That SMS was already delivered to the gateway." };
    await system((tx) => tx`update public.order_sms set status = 'failed', attempts = 0 where id = ${p.data.id}`);
    const r = await notifyOrderEvent(row.order_id, row.event);
    revalidatePath("/admin/sms");
    return r === "sent" ? { ok: true, message: "SMS sent." } : { ok: false, error: r === "skipped" ? "Skipped: the order is no longer in that state." : "The gateway reported an error — see the log." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
