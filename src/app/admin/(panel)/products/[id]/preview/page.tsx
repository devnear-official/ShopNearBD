import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { loadProductForAdmin } from "@/lib/admin-products";
import { getPublicSettings } from "@/lib/catalog";
import { ProductExperience } from "@/components/products/product-experience";

/** Shows a product exactly as customers would, including drafts. Admin only. */
export default async function PreviewProduct({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const p = await loadProductForAdmin(admin, id);
  if (!p) notFound();
  const settings = await getPublicSettings();
  return (
    <div className="rounded-3xl bg-paper p-4 sm:p-6">
      <p className="mb-4 rounded-2xl bg-sun/20 px-4 py-2 text-sm font-semibold text-[#7a4d05]">Preview — status: {p.status}. Customers {p.status === "published" ? "can" : "cannot"} see this product.</p>
      <ProductExperience product={{ ...p, variants: p.variants.length ? p.variants : [] }} shipping={settings.shipping} payments={settings.payments}>
        <div className="mt-6 rounded-3xl bg-white p-5 text-sm whitespace-pre-line">{p.description}</div>
      </ProductExperience>
    </div>
  );
}
