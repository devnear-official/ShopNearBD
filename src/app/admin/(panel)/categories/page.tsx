import { requireAdminPage } from "@/lib/auth";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton } from "@/components/admin/form";
import { deleteCategory, saveCategory } from "@/actions/admin-catalog";

type Cat = { id: string; name: string; name_bn: string | null; slug: string; description: string | null; accent: string | null; sort_order: number; is_active: boolean; products: number };

function CategoryForm({ c }: { c?: Cat }) {
  return (
    <ActionForm action={saveCategory} className="grid gap-3 sm:grid-cols-6" resetOnSuccess={!c}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name" name="name" defaultValue={c?.name} required className="sm:col-span-2" />
      <Field label="Bangla name" name="name_bn" defaultValue={c?.name_bn ?? ""} className="sm:col-span-2" />
      <Field label="Slug" name="slug" defaultValue={c?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="sm:col-span-2" />
      <Field label="Description" name="description" defaultValue={c?.description ?? ""} className="sm:col-span-4" />
      <Field label="Colour" name="accent" type="color" defaultValue={c?.accent ?? "#1E6BFF"} className="[&_input]:h-12 [&_input]:p-1" />
      <Field label="Order" name="sort_order" type="number" min={0} defaultValue={c?.sort_order ?? 0} />
      <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-3"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="size-4 accent-electric" /> Visible in store</label>
      <div className="flex gap-2 sm:col-span-3 sm:justify-end"><SubmitButton size="sm">{c ? "Save" : "Add category"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function CategoriesPage() {
  const admin = await requireAdminPage();
  const cats = await admin.db((tx) => tx<Cat[]>`select c.*, (select count(*)::int from public.products p where p.category_id = c.id) as products from public.categories c order by sort_order, name`);
  return (
    <>
      <PageHeader title="Categories" description="Shown as lanes on the homepage and as filters in the shop." />
      <Card title="New category" className="mb-4"><CategoryForm /></Card>
      <div className="space-y-3">
        {cats.map((c) => (
          <details key={c.id} className="rounded-3xl bg-white shadow-[var(--shadow-card)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5">
              <span className="size-8 rounded-xl" style={{ background: c.accent ?? "#1E6BFF" }} />
              <span className="font-semibold">{c.name}</span><span className="bn text-slate" lang="bn">{c.name_bn}</span>
              <span className="ml-auto text-sm text-slate">{c.products} products{!c.is_active && " · hidden"}</span>
            </summary>
            <div className="border-t border-line p-5">
              <CategoryForm c={c} />
              <ActionForm action={deleteCategory} className="mt-3"><input type="hidden" name="id" value={c.id} /><SubmitButton size="sm" variant="ghost" confirm="Delete this category?">Delete</SubmitButton></ActionForm>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
