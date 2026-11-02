"use server";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { LINK_TYPES, TICKER_KINDS, validateTarget, type LinkType } from "@/lib/promo";
import { destroyImages } from "@/lib/cloudinary";
import type { ActionState } from "@/components/admin/form";

type Table = "hero_banners" | "ticker_items";
const TABLES = ["hero_banners", "ticker_items"] as const;

const fd = (form: FormData) => Object.fromEntries(form);
const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const imageUrl = z.preprocess(emptyToUndef, z.string().url().max(600).refine((u) => u.startsWith("https://"), "Image must be an https link").optional());
const when = z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the date picker").optional());
/** datetime-local has no zone; the store runs on Bangladesh time. */
const bdTime = (s?: string) => (s ? new Date(`${s}:00+06:00`) : null);

const base = {
  id: z.preprocess(emptyToUndef, z.string().uuid().optional()),
  image_url: imageUrl,
  link_type: z.enum(LINK_TYPES),
  link_target: z.string().trim().max(500).default(""),
  starts_at: when,
  ends_at: when,
  is_active: z.string().optional(),
};

const heroSchema = z.object({
  ...base,
  title: z.string().trim().min(1, "Add a title").max(120),
  description: z.string().trim().max(300).optional(),
  button_text: z.string().trim().max(40).optional(),
});
const tickerSchema = z.object({
  ...base,
  kind: z.enum(TICKER_KINDS),
  text: z.string().trim().min(1, "Add the message").max(140),
});

const fail = (e: unknown): ActionState => ({ ok: false, error: friendlyError(e) });
type Admin = Awaited<ReturnType<typeof requireAdmin>>;
const audit = (tx: Parameters<Parameters<Admin["db"]>[0]>[0], a: Admin, action: string, id: string | null, data: Record<string, unknown>) =>
  tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${a.id}, ${a.email ?? "admin"}, ${action}, 'promo', ${id}, ${tx.json(data as never)})`;

function refresh() {
  updateTag("promo");
  revalidatePath("/admin/promotions");
}

type Common = { id?: string; link_type: LinkType; link_target: string; starts_at?: string; ends_at?: string; image_url?: string; is_active?: string };

async function save(table: Table, d: Common, fields: Record<string, unknown>): Promise<ActionState> {
  const err = validateTarget(d.link_type, d.link_target);
  if (err) return { ok: false, error: err };
  const s = bdTime(d.starts_at);
  const e = bdTime(d.ends_at);
  if (s && e && e <= s) return { ok: false, error: "The end time must be after the start time." };
  try {
    const admin = await requireAdmin();
    const v = { ...fields, image_url: d.image_url ?? null, link_type: d.link_type, link_target: d.link_type === "deals" ? null : d.link_target, starts_at: s, ends_at: e, is_active: d.is_active === "on" };
    let oldImage: string | null = null;
    await admin.db(async (tx) => {
      if (d.id) {
        const [prev] = await tx<{ image_url: string | null }[]>`select image_url from public.${tx(table)} where id = ${d.id}`;
        oldImage = prev?.image_url ?? null;
        await tx`update public.${tx(table)} set ${tx(v as never)} where id = ${d.id}`;
      } else {
        // New items go to the end of the list.
        const [{ n }] = await tx<{ n: number }[]>`select coalesce(max(sort_order), -1) + 1 as n from public.${tx(table)}`;
        await tx`insert into public.${tx(table)} ${tx({ ...v, sort_order: n } as never)}`;
      }
      await audit(tx, admin, `${table}.${d.id ? "update" : "create"}`, d.id ?? null, { link_type: d.link_type, active: v.is_active });
    });
    if (oldImage && oldImage !== v.image_url) void destroyImages([oldImage]);
    refresh();
    return { ok: true, message: "Saved. The homepage updates within a minute." };
  } catch (x) {
    return fail(x);
  }
}

export async function saveHeroBanner(_: ActionState, form: FormData): Promise<ActionState> {
  const p = heroSchema.safeParse(fd(form));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the fields." };
  const d = p.data;
  return save("hero_banners", d, { title: d.title, description: d.description || null, button_text: d.button_text || null });
}

export async function saveTickerItem(_: ActionState, form: FormData): Promise<ActionState> {
  const p = tickerSchema.safeParse(fd(form));
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the fields." };
  const d = p.data;
  return save("ticker_items", d, { kind: d.kind, text: d.text });
}

const target = z.object({ table: z.enum(TABLES), id: z.string().uuid() });

export async function deletePromo(_: ActionState, form: FormData): Promise<ActionState> {
  const p = target.safeParse(fd(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    const admin = await requireAdmin();
    let image: string | null = null;
    await admin.db(async (tx) => {
      const [row] = await tx<{ image_url: string | null }[]>`select image_url from public.${tx(p.data.table)} where id = ${p.data.id}`;
      image = row?.image_url ?? null;
      await tx`delete from public.${tx(p.data.table)} where id = ${p.data.id}`;
      await audit(tx, admin, `${p.data.table}.delete`, p.data.id, {});
    });
    if (image) void destroyImages([image]);
    refresh();
    return { ok: true, message: "Deleted." };
  } catch (x) {
    return fail(x);
  }
}

/** Swap with the neighbour, then renumber 0..n-1 so the order is always unambiguous. */
export async function movePromo(_: ActionState, form: FormData): Promise<ActionState> {
  const p = target.extend({ dir: z.enum(["up", "down"]) }).safeParse(fd(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      const rows = await tx<{ id: string }[]>`select id from public.${tx(p.data.table)} order by sort_order, created_at for update`;
      const i = rows.findIndex((r) => r.id === p.data.id);
      const j = p.data.dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= rows.length) return;
      [rows[i], rows[j]] = [rows[j], rows[i]];
      for (let k = 0; k < rows.length; k++) await tx`update public.${tx(p.data.table)} set sort_order = ${k} where id = ${rows[k].id}`;
      await audit(tx, admin, `${p.data.table}.reorder`, p.data.id, { dir: p.data.dir });
    });
    refresh();
    return { ok: true, message: "Order updated." };
  } catch (x) {
    return fail(x);
  }
}

export async function togglePromo(_: ActionState, form: FormData): Promise<ActionState> {
  const p = target.extend({ active: z.enum(["1", "0"]) }).safeParse(fd(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      await tx`update public.${tx(p.data.table)} set is_active = ${p.data.active === "1"} where id = ${p.data.id}`;
      await audit(tx, admin, `${p.data.table}.toggle`, p.data.id, { active: p.data.active === "1" });
    });
    refresh();
    return { ok: true, message: p.data.active === "1" ? "Now live." : "Hidden from the store." };
  } catch (x) {
    return fail(x);
  }
}
