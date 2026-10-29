"use server";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { slug } from "@/lib/validation/common";
import type { ActionState } from "@/components/admin/form";

const fd = (form: FormData) => Object.fromEntries(form);
const fail = (e: unknown): ActionState => {
  const err = e as { code?: string };
  if (err?.code === "23505") return { ok: false, error: "That code/slug is already in use." };
  if (err?.code === "23503") return { ok: false, error: "It's still in use, so it can't be deleted." };
  return { ok: false, error: friendlyError(e) };
};

async function audit(tx: Parameters<Parameters<Awaited<ReturnType<typeof requireAdmin>>["db"]>[0]>[0], admin: { id: string; email: string | null }, action: string, entity: string, id: string | null, data: Record<string, unknown>) {
  await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${admin.id}, ${admin.email ?? "admin"}, ${action}, ${entity}, ${id}, ${tx.json(data as never)})`;
}

// ---------------- Categories ----------------
const categorySchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(80), name_bn: z.string().trim().max(80).optional(), slug,
  description: z.string().trim().max(400).optional(), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  sort_order: z.coerce.number().int().min(0).max(999), is_active: z.string().optional(),
});

export async function saveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const p = categorySchema.safeParse(fd(form));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the fields." };
  try {
    const admin = await requireAdmin();
    const v = { name: p.data.name, name_bn: p.data.name_bn || null, slug: p.data.slug, description: p.data.description || null, accent: p.data.accent || null, sort_order: p.data.sort_order, is_active: p.data.is_active === "on" };
    await admin.db(async (tx) => {
      if (p.data.id) await tx`update public.categories set ${tx(v as never)} where id = ${p.data.id}`;
      else await tx`insert into public.categories ${tx(v as never)}`;
      await audit(tx, admin, p.data.id ? "category.update" : "category.create", "category", p.data.id || null, v);
    });
    updateTag("catalog");
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category saved." };
  } catch (e) { return fail(e); }
}

export async function deleteCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, error: "Invalid." };
  try {
    const admin = await requireAdmin();
    const n = await admin.db(async (tx) => {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from public.products where category_id = ${id.data}`;
      if (n === 0) { await tx`delete from public.categories where id = ${id.data}`; await audit(tx, admin, "category.delete", "category", id.data, {}); }
      return n;
    });
    if (n) return { ok: false, error: `${n} product(s) use this category. Move them first or hide the category.` };
    updateTag("catalog");
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category deleted." };
  } catch (e) { return fail(e); }
}

// ---------------- Inventory ----------------
export async function adjustStock(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ variantId: z.string().uuid(), delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero amount"), reason: z.enum(["restock", "adjustment", "return"]), note: z.string().trim().max(200).optional() }).safeParse(fd(form));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the amount." };
  try {
    const admin = await requireAdmin();
    const [{ s }] = await admin.db((tx) => tx<{ s: number }[]>`select public.admin_adjust_stock(${p.data.variantId}, ${p.data.delta}, ${p.data.reason}, ${p.data.note ?? null}) as s`);
    updateTag("catalog");
    revalidatePath("/admin/inventory");
    return { ok: true, message: `Stock is now ${s}.` };
  } catch (e) { return fail(e); }
}

// ---------------- Coupons ----------------
const couponSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, numbers, - or _"),
  description: z.string().trim().max(200).optional(), type: z.enum(["percent", "fixed"]), value: z.coerce.number().positive(),
  min_subtotal: z.coerce.number().min(0), max_discount: z.union([z.literal(""), z.coerce.number().positive()]).optional(),
  starts_at: z.string().optional(), ends_at: z.string().optional(),
  usage_limit: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(), per_phone_limit: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(),
  is_active: z.string().optional(),
}).refine((c) => c.type !== "percent" || c.value <= 100, { message: "A percentage can't exceed 100", path: ["value"] });

export async function saveCoupon(_: ActionState, form: FormData): Promise<ActionState> {
  const p = couponSchema.safeParse(fd(form));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the fields." };
  const d = p.data;
  const dt = (s?: string) => (s ? new Date(`${s}T00:00:00+06:00`) : null);
  try {
    const admin = await requireAdmin();
    const v = {
      code: d.code, description: d.description || null, type: d.type, value: d.value, min_subtotal: d.min_subtotal,
      max_discount: d.max_discount === "" || d.max_discount === undefined ? null : d.max_discount, starts_at: dt(d.starts_at), ends_at: d.ends_at ? new Date(`${d.ends_at}T23:59:59+06:00`) : null,
      usage_limit: d.usage_limit === "" || d.usage_limit === undefined ? null : d.usage_limit, per_phone_limit: d.per_phone_limit === "" || d.per_phone_limit === undefined ? null : d.per_phone_limit,
      is_active: d.is_active === "on",
    };
    await admin.db(async (tx) => {
      if (d.id) await tx`update public.coupons set ${tx(v as never)} where id = ${d.id}`;
      else await tx`insert into public.coupons ${tx(v as never)}`;
      await audit(tx, admin, d.id ? "coupon.update" : "coupon.create", "coupon", d.id || null, { code: d.code, type: d.type, value: d.value });
    });
    revalidatePath("/admin/coupons");
    return { ok: true, message: `Coupon ${d.code} saved.` };
  } catch (e) { return fail(e); }
}

// ---------------- Reviews ----------------
export async function moderateReview(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).safeParse(fd(form));
  if (!p.success) return { ok: false, error: "Invalid." };
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      await tx`update public.reviews set status = ${p.data.status} where id = ${p.data.id}`;
      await audit(tx, admin, `review.${p.data.status}`, "review", p.data.id, {});
    });
    updateTag("reviews");
    revalidatePath("/admin/products");
    return { ok: true, message: `Review ${p.data.status}.` };
  } catch (e) { return fail(e); }
}

// ---------------- FAQs ----------------
export async function saveFaq(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ id: z.string().uuid().optional().or(z.literal("")), question: z.string().trim().min(5).max(300), answer: z.string().trim().min(5).max(2000), tags: z.string().max(300).optional(), sort_order: z.coerce.number().int().min(0).max(999), is_active: z.string().optional(), delete: z.string().optional() }).safeParse(fd(form));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the fields." };
  try {
    const admin = await requireAdmin();
    const d = p.data;
    await admin.db(async (tx) => {
      if (d.id && d.delete === "1") { await tx`delete from public.support_faqs where id = ${d.id}`; await audit(tx, admin, "faq.delete", "faq", d.id, {}); return; }
      const v = { question: d.question, answer: d.answer, tags: (d.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean), sort_order: d.sort_order, is_active: d.is_active === "on" };
      if (d.id) await tx`update public.support_faqs set ${tx(v as never)} where id = ${d.id}`;
      else await tx`insert into public.support_faqs ${tx(v as never)}`;
      await audit(tx, admin, d.id ? "faq.update" : "faq.create", "faq", d.id || null, { question: d.question });
    });
    updateTag("faqs");
    revalidatePath("/admin/chat");
    return { ok: true, message: d.delete === "1" ? "FAQ deleted." : "FAQ saved." };
  } catch (e) { return fail(e); }
}
