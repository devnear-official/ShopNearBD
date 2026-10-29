"use server";
import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { sendPurchase, trackingConfig } from "@/lib/tracking/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { bdPhone } from "@/lib/validation/common";
import type { ActionState } from "@/components/admin/form";

const STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"] as const;

async function guard<T>(fn: (admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<T>): Promise<T | ActionState> {
  try {
    const admin = await requireAdmin();
    return await fn(admin);
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function transitionOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ orderId: z.string().uuid(), to: z.enum(STATUSES), note: z.string().trim().max(500).optional(), restock: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  if ((p.data.to === "cancelled" || p.data.to === "returned") && !p.data.note) return { ok: false, error: "Add a short reason." };
  return guard(async (admin) => {
    await admin.db((tx) => tx`select public.admin_transition_order(${p.data.orderId}, ${p.data.to}, ${p.data.note ?? null}, ${p.data.restock !== "no"})`);
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    if (p.data.to === "cancelled" || p.data.to === "returned") updateTag("catalog");
    if (p.data.to === "confirmed") {
      const orderId = p.data.orderId;
      // "Purchase on confirmation" mode: only orders the team has confirmed are reported to ad platforms.
      after(async () => {
        if ((await trackingConfig()).purchaseTrigger === "confirmed") await sendPurchase(orderId);
      });
    }
    return { ok: true, message: `Order marked ${p.data.to}.` };
  }) as Promise<ActionState>;
}

export async function verifyPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ paymentId: z.string().uuid(), orderId: z.string().uuid(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  if (p.data.decision === "reject" && !p.data.note) return { ok: false, error: "Say why the payment is rejected (the customer may ask)." };
  return guard(async (admin) => {
    await admin.db((tx) => tx`select public.admin_verify_payment(${p.data.paymentId}, ${p.data.decision === "approve"}, ${p.data.note ?? null})`);
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return { ok: true, message: p.data.decision === "approve" ? "Payment verified." : "Payment rejected." };
  }) as Promise<ActionState>;
}

export async function recordCod(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ orderId: z.string().uuid(), amount: z.coerce.number().positive(), note: z.string().trim().max(300).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Enter the amount collected." };
  return guard(async (admin) => {
    await admin.db((tx) => tx`select public.admin_record_cod(${p.data.orderId}, ${p.data.amount}, ${p.data.note ?? "COD collected"})`);
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return { ok: true, message: "Cash collection recorded." };
  }) as Promise<ActionState>;
}

export async function recordRefund(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ orderId: z.string().uuid(), amount: z.coerce.number().positive(), note: z.string().trim().min(3).max(300) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Enter an amount and a reason." };
  return guard(async (admin) => {
    await admin.db((tx) => tx`select public.admin_record_refund(${p.data.orderId}, ${p.data.amount}, ${p.data.note})`);
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return { ok: true, message: "Refund recorded." };
  }) as Promise<ActionState>;
}

export async function addOrderNote(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ orderId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Write a note first." };
  return guard(async (admin) => {
    await admin.db((tx) => tx`insert into public.order_notes (order_id, body, actor_id, actor_label) values (${p.data.orderId}, ${p.data.body}, ${admin.id}, ${admin.email ?? "admin"})`);
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return { ok: true, message: "Note added." };
  }) as Promise<ActionState>;
}

/** Fix delivery details before the parcel is booked (customers often call with corrections). */
export async function updateOrderDelivery(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({
    orderId: z.string().uuid(), customer_name: z.string().trim().min(2).max(80), phone: bdPhone,
    address: z.string().trim().min(8).max(300), area: z.string().trim().max(80).optional(), delivery_note: z.string().trim().max(300).optional(),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the fields." };
  return guard(async (admin) => {
    const d = p.data;
    const rows = await admin.db(async (tx) => {
      const r = await tx`update public.orders set customer_name = ${d.customer_name}, phone = ${d.phone}, address = ${d.address}, area = ${d.area || null}, delivery_note = ${d.delivery_note || null}
        where id = ${d.orderId} and status in ('pending', 'confirmed', 'packed') returning id`;
      if (r.length) await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${admin.id}, ${admin.email ?? "admin"}, 'order.delivery_edit', 'order', ${d.orderId}, ${tx.json({ phone: d.phone, area: d.area ?? null })})`;
      return r;
    });
    if (!rows.length) return { ok: false, error: "Delivery details can't be changed after the parcel is handed to the courier." };
    revalidatePath(`/admin/orders/${d.orderId}`);
    return { ok: true, message: "Delivery details updated." };
  }) as Promise<ActionState>;
}
