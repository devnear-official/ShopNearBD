import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { categoryOptions, loadProductForAdmin, toEditorValues } from "@/lib/admin-products";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/product-editor";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, categories] = await Promise.all([loadProductForAdmin(admin, id), categoryOptions(admin)]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.name} back={{ href: "/admin/products", label: "Products" }}
        description={<>{p.status === "published" ? <Link href={`/shop/${p.slug}`} target="_blank" className="text-electric underline">View in store</Link> : "Not visible in the store"} · <Link href={`/admin/inventory?q=${encodeURIComponent(p.sku)}`} className="underline">Stock history</Link></>} />
      <ProductEditor key={p.id + p.image_rows.length + p.all_variants.length} categories={categories} initial={toEditorValues(p)} />
    </>
  );
}
