"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { saveProduct, uploadProductImage } from "@/actions/admin-products";
import { buttonClass } from "@/components/ui/button";
import { toast } from "./form";

type Variant = { id?: string | null; key: string; name: string; sku: string; options: Record<string, string>; price: string | number | null; sale_price: string | number | null; stock: number; is_active: boolean };
type Img = { id?: string | null; url: string; storage_path?: string | null; alt: string; variant_key?: string | null; width?: number | null; height?: number | null };
export type EditorValues = {
  id?: string | null; name: string; name_bn: string; slug: string; sku: string; category_id: string; status: "draft" | "published" | "archived"; is_featured: boolean;
  price: string | number; sale_price: string | number | null; cost_price: string | number | null; low_stock_threshold: number;
  short_description: string; description: string; specifications: { label: string; value: string }[]; tags: string; collections: string;
  option_names: string[]; variants: Variant[]; images: Img[]; seo_title: string; seo_description: string; og_image_url: string;
};

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-").slice(0, 80);
const key = () => Math.random().toString(36).slice(2, 10);

export function ProductEditor({ initial, categories }: { initial: EditorValues; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const form = useForm<EditorValues>({ defaultValues: initial });
  const { register, control, setValue, getValues } = form;
  const specs = useFieldArray({ control, name: "specifications" });
  const variants = useFieldArray({ control, name: "variants", keyName: "_k" });
  const images = useFieldArray({ control, name: "images", keyName: "_k" });
  const optionNames = useWatch({ control, name: "option_names" });
  const variantList = useWatch({ control, name: "variants" });
  const name = useWatch({ control, name: "name" });
  const [optionText, setOptionText] = useState(initial.option_names.join(", "));
  const slugTouched = Boolean(initial.id);

  const err = (k: string) => errors[k] ? <span className="field-error block">{errors[k]}</span> : null;

  const submit = form.handleSubmit((values) => {
    setErrors({});
    start(async () => {
      // Fill blank variant SKUs/names from the product so a simple product needs no variant setup.
      const variants = values.variants.map((v, i) => ({
        ...v,
        name: v.name.trim() || (i === 0 ? "Default" : `Option ${i + 1}`),
        sku: v.sku.trim() || `${values.sku}-${i === 0 ? "STD" : i + 1}`.toUpperCase(),
      }));
      const r = await saveProduct({ ...values, variants, id: values.id || undefined });
      if (r.ok) {
        toast("Product saved.");
        if (!initial.id) router.replace(`/admin/products/${r.id}`);
        else router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast(r.error, "error");
      }
    });
  });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 20 - images.fields.length);
    setUploading(list.length);
    for (const f of list) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadProductImage(fd);
      if (r.ok) images.append({ url: r.url, storage_path: r.path, alt: getValues("name"), variant_key: null, width: r.width, height: r.height });
      else toast(r.error, "error");
      setUploading((n) => n - 1);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1fr_22rem]" noValidate>
      <div className="space-y-4">
        <Section title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Name" error={err("name")}><input {...register("name", { onChange: (e) => { if (!slugTouched && !getValues("id")) setValue("slug", slugify(e.target.value)); } })} className="input" /></L>
            <L label="Name (Bangla)"><input {...register("name_bn")} className="input bn" lang="bn" /></L>
            <L label="URL slug" hint={`/shop/${useWatch({ control, name: "slug" }) || "…"}`} error={err("slug")}><input {...register("slug")} className="input font-mono text-sm" /></L>
            <L label="Product SKU" error={err("sku")}><input {...register("sku")} className="input font-mono text-sm uppercase" /></L>
            <L label="Short description" hint="Shown on cards and search results" className="sm:col-span-2"><input {...register("short_description")} maxLength={300} className="input" /></L>
            <L label="Description" className="sm:col-span-2"><textarea {...register("description")} rows={6} className="input" /></L>
          </div>
        </Section>

        <Section title="Images" hint="First image is the main one. Max 20, resized to 1600px WebP.">
          {errors.images && <p className="field-error mb-2">{errors.images}</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {images.fields.map((f, i) => (
              <li key={f._k} className="flex gap-3 rounded-2xl bg-paper p-3">
                <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-cloud"><Image src={f.url} alt="" fill sizes="80px" className="object-cover" /></span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input {...register(`images.${i}.alt`)} placeholder="Alt text — describe the image" aria-label={`Alt text for image ${i + 1}`} className="input h-9 min-h-0 py-1 text-sm" />
                  <select {...register(`images.${i}.variant_key`)} aria-label={`Variant for image ${i + 1}`} className="input h-9 min-h-0 py-1 text-sm">
                    <option value="">All variants</option>
                    {variantList.map((v) => <option key={v.key} value={v.key}>{v.name}</option>)}
                  </select>
                  <div className="flex gap-1">
                    <IconBtn label="Move up" disabled={i === 0} onClick={() => images.move(i, i - 1)}><ArrowUp className="size-4" /></IconBtn>
                    <IconBtn label="Move down" disabled={i === images.fields.length - 1} onClick={() => images.move(i, i + 1)}><ArrowDown className="size-4" /></IconBtn>
                    <IconBtn label="Remove image" onClick={() => images.remove(i)} danger><Trash2 className="size-4" /></IconBtn>
                    {i === 0 && <span className="ml-auto self-center text-xs font-semibold text-electric">Main</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <label className={clsx(buttonClass("ghost", "sm"), "mt-3 cursor-pointer")}>
            {uploading ? <><Loader2 className="size-4 animate-spin" /> Uploading {uploading}…</> : <><ImagePlus className="size-4" /> Add images</>}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </Section>

        <Section title="Pricing">
          <div className="grid gap-4 sm:grid-cols-4">
            <L label="Price (৳)" error={err("price")}><input {...register("price")} inputMode="decimal" className="input" /></L>
            <L label="Sale price (৳)" error={err("sale_price")}><input {...register("sale_price")} inputMode="decimal" placeholder="—" className="input" /></L>
            <L label="Cost price (৳)" hint="Private"><input {...register("cost_price")} inputMode="decimal" placeholder="—" className="input" /></L>
            <L label="Low-stock alert at"><input {...register("low_stock_threshold", { valueAsNumber: true })} type="number" min={0} className="input" /></L>
          </div>
        </Section>

        <Section title="Variants & stock" hint="Variant prices are optional overrides. Stock changes here are logged as adjustments.">
          <L label="Option names" hint="Comma separated, e.g. Color, Size (max 3)">
            <input value={optionText} onChange={(e) => setOptionText(e.target.value)} onBlur={() => setValue("option_names", [...new Set(optionText.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 3))} className="input" />
          </L>
          {errors.variants && <p className="field-error">{errors.variants}</p>}
          <div className="mt-4 space-y-3">
            {variants.fields.map((f, i) => (
              <VariantRow key={f._k} i={i} register={register} control={control} optionNames={optionNames} errors={errors} onRemove={variants.fields.length > 1 ? () => variants.remove(i) : undefined} />
            ))}
          </div>
          <button type="button" onClick={() => variants.append({ key: key(), name: "", sku: `${getValues("sku")}-${variants.fields.length + 1}`.toUpperCase(), options: {}, price: null, sale_price: null, stock: 0, is_active: true })} className={clsx(buttonClass("ghost", "sm"), "mt-3")}>
            <Plus className="size-4" /> Add variant
          </button>
        </Section>

        <Section title="Specifications">
          <div className="space-y-2">
            {specs.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <input {...register(`specifications.${i}.label`)} placeholder="e.g. Battery" aria-label="Specification name" className="input w-2/5" />
                <input {...register(`specifications.${i}.value`)} placeholder="e.g. 20 hours" aria-label="Specification value" className="input flex-1" />
                <IconBtn label="Remove" onClick={() => specs.remove(i)} danger><Trash2 className="size-4" /></IconBtn>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => specs.append({ label: "", value: "" })} className={clsx(buttonClass("ghost", "sm"), "mt-3")}><Plus className="size-4" /> Add row</button>
        </Section>

        <Section title="Search engines & sharing">
          <div className="grid gap-4">
            <L label="SEO title" hint="≤ 70 characters"><input {...register("seo_title")} maxLength={70} placeholder={name} className="input" /></L>
            <L label="SEO description" hint="≤ 170 characters"><textarea {...register("seo_description")} maxLength={170} rows={2} className="input" /></L>
            <L label="Social share image URL" hint="Optional — defaults to the main image"><input {...register("og_image_url")} className="input" /></L>
          </div>
        </Section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:h-max">
        <Section title="Publishing">
          <L label="Status">
            <select {...register("status")} className="input">
              <option value="draft">Draft — hidden</option>
              <option value="published">Published — visible</option>
              <option value="archived">Archived — hidden</option>
            </select>
          </L>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" {...register("is_featured")} className="size-4 accent-electric" /> Featured on the homepage</label>
          <L label="Category" className="mt-3">
            <select {...register("category_id")} className="input"><option value="">— None —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </L>
          <L label="Tags" hint="Comma separated, used by search & chat" className="mt-3"><input {...register("tags")} className="input" /></L>
          <L label="Collections" hint="e.g. commute-kit" className="mt-3"><input {...register("collections")} className="input" /></L>
          <button type="submit" disabled={saving || uploading > 0} className={clsx(buttonClass("primary", "md"), "mt-5 w-full")}>{saving && <Loader2 className="size-4 animate-spin" />} Save product</button>
          {initial.id && <Link href={`/admin/products/${initial.id}/preview`} target="_blank" className={clsx(buttonClass("ghost", "sm"), "mt-2 w-full")}><Eye className="size-4" /> Preview (works for drafts)</Link>}
          {Object.keys(errors).length > 0 && <p className="field-error mt-3">Some fields need attention: {Object.keys(errors).slice(0, 4).join(", ")}</p>}
        </Section>
      </aside>
    </form>
  );
}

function VariantRow({ i, register, control, optionNames, errors, onRemove }: { i: number; register: UseFormRegister<EditorValues>; control: Control<EditorValues>; optionNames: string[]; errors: Record<string, string>; onRemove?: () => void }) {
  const active = useWatch({ control, name: `variants.${i}.is_active` });
  const e = (k: string) => errors[`variants.${i}.${k}`];
  return (
    <div className={clsx("rounded-2xl p-3 ring-1", active ? "bg-paper ring-transparent" : "bg-white opacity-70 ring-line")}>
      <div className="grid gap-2 sm:grid-cols-6">
        <label className="sm:col-span-2"><span className="text-xs text-slate">Name{i === 0 && " (default)"}</span><input {...register(`variants.${i}.name`)} className="input h-10 min-h-0" placeholder="e.g. Black" /></label>
        <label className="sm:col-span-2"><span className="text-xs text-slate">SKU</span><input {...register(`variants.${i}.sku`)} className="input h-10 min-h-0 font-mono text-sm uppercase" aria-invalid={!!e("sku")} />{e("sku") && <span className="field-error block">{e("sku")}</span>}</label>
        <label><span className="text-xs text-slate">Stock</span><input {...register(`variants.${i}.stock`, { valueAsNumber: true })} type="number" min={0} className="input h-10 min-h-0" /></label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" {...register(`variants.${i}.is_active`)} className="size-4 accent-electric" /> Active</label>
        {optionNames.map((o) => (
          <label key={o} className="sm:col-span-2"><span className="text-xs text-slate">{o}</span><input {...register(`variants.${i}.options.${o}` as `variants.${number}.name`)} className="input h-10 min-h-0" aria-invalid={!!e("options")} /></label>
        ))}
        <label><span className="text-xs text-slate">Price override</span><input {...register(`variants.${i}.price`)} inputMode="decimal" placeholder="—" className="input h-10 min-h-0" /></label>
        <label><span className="text-xs text-slate">Sale override</span><input {...register(`variants.${i}.sale_price`)} inputMode="decimal" placeholder="—" className="input h-10 min-h-0" />{e("sale_price") && <span className="field-error block">{e("sale_price")}</span>}</label>
      </div>
      {e("options") && <p className="field-error">{e("options")}</p>}
      {onRemove && <button type="button" onClick={onRemove} className="mt-2 text-xs font-semibold text-flame">Remove variant (kept inactive if it has orders)</button>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {hint && <p className="mb-3 text-xs text-slate">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function L({ label, hint, error, className, children }: { label: string; hint?: string; error?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}{hint && <span className="ml-1 font-normal text-mist">· {hint}</span>}</span>
      {children}
      {error}
    </label>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={clsx("grid size-9 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-line disabled:opacity-30", danger && "text-flame")}>{children}</button>;
}
