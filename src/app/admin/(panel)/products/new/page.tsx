import { requireAdminPage } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin-products";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/product-editor";

export default async function NewProduct() {
  const admin = await requireAdminPage();
  const categories = await categoryOptions(admin);
  return (
    <>
      <PageHeader title="New product" back={{ href: "/admin/products", label: "Products" }} description="Saved as a draft until you publish it." />
      <ProductEditor categories={categories} initial={{
        name: "", name_bn: "", slug: "", sku: "", category_id: "", status: "draft", is_featured: false, price: "", sale_price: null, cost_price: null,
        low_stock_threshold: 5, short_description: "", description: "", specifications: [], tags: "", collections: "", option_names: [],
        variants: [{ key: "v1", name: "Default", sku: "", options: {}, price: null, sale_price: null, stock: 0, is_active: true }], images: [],
        seo_title: "", seo_description: "", og_image_url: "",
      }} />
    </>
  );
}
