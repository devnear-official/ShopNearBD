"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { applyCourierEvent, bookShipment } from "@/lib/couriers/service";
import { getProvider, type ShipmentStatus } from "@/lib/couriers";
import type { ActionState } from "@/components/admin/form";

export async function createShipmentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ orderId: z.string().uuid(), provider: z.string().min(2).max(20), confirm: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Tick the box to confirm the recipient details first." };
  try {
    const admin = await requireAdmin();
    const r = await bookShipment(admin, p.data.orderId, p.data.provider);
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return r.ok ? { ok: true, message: `Booked. Consignment ${r.consignmentId}.` } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "You don't have permission to do that." };
  }
}

export async function syncShipmentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ shipmentId: z.string().uuid(), orderId: z.string().uuid() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    const admin = await requireAdmin();
    const [s] = await admin.db((tx) => tx<{ provider: string; consignment_id: string | null }[]>`select provider, consignment_id from public.shipments where id = ${p.data.shipmentId}`);
    const provider = s ? getProvider(s.provider) : null;
    if (!s?.consignment_id || !provider?.getStatus) return { ok: false, error: "This courier doesn't support status lookup — rely on webhooks or update manually." };
    const st = await provider.getStatus(s.consignment_id);
    const r = await applyCourierEvent(s.provider, { consignmentId: s.consignment_id, invoice: null, providerStatus: st.providerStatus, status: st.status, codCollected: st.codCollected, dedupeKey: `sync:${p.data.shipmentId}:${st.providerStatus}`, raw: st.raw });
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return { ok: true, message: `Courier says “${st.providerStatus}”${r.applied ? " — updated." : " — no change."}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 300) };
  }
}

/** Sandbox only: simulate courier progress through the same code path as a webhook. */
export async function simulateSandboxAction(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ shipmentId: z.string().uuid(), orderId: z.string().uuid(), status: z.enum(["picked_up", "in_transit", "delivered", "returned"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    const admin = await requireAdmin();
    const [s] = await admin.db((tx) => tx<{ provider: string; consignment_id: string; cod_amount: number }[]>`select provider, consignment_id, cod_amount from public.shipments where id = ${p.data.shipmentId}`);
    if (s?.provider !== "sandbox") return { ok: false, error: "Simulation is only available for sandbox shipments." };
    const status = p.data.status as ShipmentStatus;
    await applyCourierEvent("sandbox", { consignmentId: s.consignment_id, invoice: null, providerStatus: `sandbox:${status}`, status, codCollected: status === "delivered" ? Number(s.cod_amount) : null, dedupeKey: `sandbox:${p.data.shipmentId}:${status}`, raw: { simulated: true, status } });
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return { ok: true, message: `Simulated “${status}”.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 300) };
  }
}

export async function cancelShipmentRecord(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ shipmentId: z.string().uuid(), orderId: z.string().uuid(), note: z.string().trim().min(3).max(300) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Add a reason." };
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      await tx`update public.shipments set status = 'cancelled', last_error = ${"Cancelled by admin: " + p.data.note} where id = ${p.data.shipmentId} and status in ('pending','created')`;
      await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${admin.id}, ${admin.email ?? "admin"}, 'shipment.cancel', 'shipment', ${p.data.shipmentId}, ${tx.json({ note: p.data.note })})`;
    });
    revalidatePath(`/admin/orders/${p.data.orderId}`);
    return { ok: true, message: "Shipment record cancelled. Also cancel it in the courier's panel if it was booked there." };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 200) };
  }
}
