"use server";
import { revalidatePath, updateTag } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { productSchema } from "@/lib/validation/product";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomToken } from "@/lib/tokens";
import type { ActionState } from "@/components/admin/form";

export type SaveResult = { ok: true; id: string; slug: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveProduct(input: unknown): Promise<SaveResult> {
  let admin;
  try { admin = await requireAdmin(); } catch { return { ok: false, error: "Your session expired. Sign in again." }; }
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const p = parsed.data;
  try {
    const result = await admin.db(async (tx) => {
      const values = {
        name: p.name, name_bn: p.name_bn || null, slug: p.slug, sku: p.sku, category_id: p.category_id, status: p.status, is_featured: p.is_featured,
        price: p.price, sale_price: p.sale_price, cost_price: p.cost_price, low_stock_threshold: p.low_stock_threshold,
        short_description: p.short_description || null, description: p.description || null, specifications: tx.json(p.specifications),
        tags: p.tags, collections: p.collections, option_names: p.option_names,
        seo_title: p.seo_title || null, seo_description: p.seo_description || null, og_image_url: p.og_image_url || null,
      };
      let id = p.id ?? null;
      let previousStatus: string | null = null;
      if (id) {
        const [prev] = await tx<{ status: string; slug: string }[]>`select status, slug from public.products where id = ${id} for update`;
        if (!prev) throw new Error("NOT_FOUND");
        previousStatus = prev.status;
        await tx`update public.products set ${tx(values as never)}, published_at = case when ${p.status} = 'published' and published_at is null then now() else published_at end where id = ${id}`;
      } else {
        const [row] = await tx<{ id: string }[]>`insert into public.products ${tx({ ...values, published_at: p.status === "published" ? new Date() : null } as never)} returning id`;
        id = row.id;
      }

      // Variants: update, insert, and deactivate (not delete) the removed ones so past orders keep their link.
      const existing = await tx<{ id: string; stock: number }[]>`select id, stock from public.product_variants where product_id = ${id}`;
      const keep = new Set(p.variants.map((v) => v.id).filter(Boolean));
      const gone = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
      if (gone.length) await tx`update public.product_variants set is_active = false, is_default = false, sku = sku || '-OLD-' || left(id::text, 6) where id = any(${gone}) and sku not like '%-OLD-%'`;
      await tx`update public.product_variants set is_default = false where product_id = ${id}`;
      const keyToId = new Map<string, string>();
      for (const [i, v] of p.variants.entries()) {
        const row = { name: v.name, sku: v.sku, options: tx.json(v.options), price: v.price, sale_price: v.sale_price, is_active: v.is_active, is_default: i === 0, sort_order: i };
        if (v.id && existing.some((e) => e.id === v.id)) {
          const before = existing.find((e) => e.id === v.id)!.stock;
          await tx`update public.product_variants set ${tx(row as never)} where id = ${v.id}`;
          if (before !== v.stock) {
            const delta = v.stock - before;
            await tx`update public.product_variants set stock = ${v.stock} where id = ${v.id}`;
            await tx`insert into public.inventory_movements (variant_id, delta, stock_after, reason, note, actor_id) values (${v.id}, ${delta}, ${v.stock}, 'adjustment', 'Set in product editor', ${admin.id})`;
          }
          keyToId.set(v.key, v.id);
        } else {
          const [nv] = await tx<{ id: string }[]>`insert into public.product_variants ${tx({ ...row, product_id: id, stock: v.stock } as never)} returning id`;
          if (v.stock > 0) await tx`insert into public.inventory_movements (variant_id, delta, stock_after, reason, note, actor_id) values (${nv.id}, ${v.stock}, ${v.stock}, 'initial', 'New variant', ${admin.id})`;
          keyToId.set(v.key, nv.id);
        }
      }

      // Images in the order given.
      const oldImages = await tx<{ id: string; storage_path: string | null }[]>`select id, storage_path from public.product_images where product_id = ${id}`;
      const keepImg = new Set(p.images.map((i) => i.id).filter(Boolean));
      const removed = oldImages.filter((o) => !keepImg.has(o.id));
      if (removed.length) await tx`delete from public.product_images where id = any(${removed.map((r) => r.id)})`;
      for (const [i, im] of p.images.entries()) {
        const row = { url: im.url, storage_path: im.storage_path ?? null, alt: im.alt || p.name, variant_id: im.variant_key ? keyToId.get(im.variant_key) ?? null : null, sort_order: i, width: im.width ?? null, height: im.height ?? null };
        if (im.id && oldImages.some((o) => o.id === im.id)) await tx`update public.product_images set ${tx(row as never)} where id = ${im.id}`;
        else await tx`insert into public.product_images ${tx({ ...row, product_id: id } as never)}`;
      }

      await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data)
        values (${admin.id}, ${admin.email ?? "admin"}, ${p.id ? "product.update" : "product.create"}, 'product', ${id}, ${tx.json({ status: p.status, previous_status: previousStatus, price: p.price, sale_price: p.sale_price })})`;
      return { id: id!, removedPaths: removed.map((r) => r.storage_path).filter(Boolean) as string[] };
    });
    if (result.removedPaths.length) await supabaseAdmin().storage.from("product-images").remove(result.removedPaths).catch(() => {});
    updateTag("catalog");
    updateTag(`product:${p.slug}`);
    revalidatePath("/admin/products");
    return { ok: true, id: result.id, slug: p.slug };
  } catch (e) {
    const err = e as { code?: string; constraint_name?: string; message?: string };
    if (err.code === "23505") {
      const field = err.constraint_name?.includes("slug") ? "slug" : "sku";
      return { ok: false, error: `That ${field.toUpperCase()} is already used by another product or variant.`, fieldErrors: { [field]: "Already in use" } };
    }
    console.error("saveProduct", e);
    return { ok: false, error: "Couldn't save the product. Please try again." };
  }
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Validates, normalises (max 1600px, WebP) and stores a product image. */
export async function uploadProductImage(form: FormData): Promise<{ ok: true; url: string; path: string; width: number; height: number } | { ok: false; error: string }> {
  try { await requireAdmin(); } catch { return { ok: false, error: "Not allowed." }; }
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file." };
  if (!IMAGE_TYPES.includes(file.type)) return { ok: false, error: `${file.name}: use JPG, PNG, WebP or AVIF.` };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: `${file.name}: larger than 8 MB.` };
  try {
    const img = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" }).rotate().resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true });
    const { data, info } = await img.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const path = `products/${new Date().toISOString().slice(0, 7)}/${randomToken(10)}.webp`;
    const sb = supabaseAdmin();
    const { error } = await sb.storage.from("product-images").upload(path, data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (error) throw error;
    return { ok: true, url: sb.storage.from("product-images").getPublicUrl(path).data.publicUrl, path, width: info.width, height: info.height };
  } catch (e) {
    console.error("uploadProductImage", e);
    return { ok: false, error: `${file.name}: couldn't process this image.` };
  }
}

export async function setProductStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Invalid request." };
  try {
    const admin = await requireAdmin();
    const ok = await admin.db(async (tx) => {
      if (p.data.status === "published") {
        const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from public.product_images where product_id = ${p.data.id}`;
        if (!n) return false;
      }
      await tx`update public.products set status = ${p.data.status}, published_at = case when ${p.data.status} = 'published' and published_at is null then now() else published_at end where id = ${p.data.id}`;
      await tx`insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data) values (${admin.id}, ${admin.email ?? "admin"}, 'product.status', 'product', ${p.data.id}, ${tx.json({ status: p.data.status })})`;
      return true;
    });
    if (!ok) return { ok: false, error: "Add an image before publishing." };
    updateTag("catalog");
    revalidatePath("/admin/products");
    return { ok: true, message: `Product ${p.data.status}.` };
  } catch {
    return { ok: false, error: "Couldn't update the product." };
  }
}
