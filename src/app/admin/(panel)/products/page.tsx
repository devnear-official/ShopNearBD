import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { formatTaka } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Pager, Table } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { setProductStatus } from "@/actions/admin-products";
import { buttonClass } from "@/components/ui/button";

type Row = { id: string; slug: string; name: string; sku: string; status: string; is_featured: boolean; price: number; sale_price: number | null; image: string | null; category: string | null; stock: number; low: number; variants: number; updated_at: Date };
const TONE = { draft: "amber", published: "green", archived: "gray" } as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60);
  const status = ["draft", "published", "archived"].includes(sp.status ?? "") ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const size = 25;
  const [rows, [{ total }]] = await admin.db((tx) => {
    const where = tx`where true ${q ? tx`and (p.name ilike ${"%" + q + "%"} or p.sku ilike ${"%" + q + "%"} or exists (select 1 from public.product_variants v where v.product_id = p.id and v.sku ilike ${"%" + q + "%"}))` : tx``} ${status ? tx`and p.status = ${status}` : tx``}`;
    return Promise.all([
      tx<Row[]>`select p.id, p.slug, p.name, p.sku, p.status, p.is_featured, p.price, p.sale_price, p.updated_at,
        (select url from public.product_images i where i.product_id = p.id order by sort_order limit 1) as image,
        (select name from public.categories c where c.id = p.category_id) as category,
        (select coalesce(sum(stock), 0)::int from public.product_variants v where v.product_id = p.id and v.is_active) as stock,
        (select count(*)::int from public.product_variants v where v.product_id = p.id and v.is_active and v.stock <= p.low_stock_threshold) as low,
        (select count(*)::int from public.product_variants v where v.product_id = p.id and v.is_active) as variants
        from public.products p ${where} order by p.updated_at desc limit ${size} offset ${(page - 1) * size}`,
      tx<{ total: number }[]>`select count(*)::int as total from public.products p ${where}`,
    ]);
  });
  const qs = (patch: Record<string, string | undefined>) => new URLSearchParams(Object.entries({ q, status, ...patch }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader title="Products" description={`${total} product${total === 1 ? "" : "s"}`} actions={<Link href="/admin/products/new" className={buttonClass("primary", "sm")}><Plus className="size-4" /> New product</Link>} />
      <Card className="mb-4">
        <form className="flex flex-wrap gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Name or SKU" className="input max-w-xs" aria-label="Search products" />
          <select name="status" defaultValue={status ?? ""} className="input max-w-[12rem]" aria-label="Status"><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
          <button className={buttonClass("dark", "sm")}>Filter</button>
        </form>
      </Card>
      {!rows.length ? <Empty>No products found. <Link href="/admin/products/new" className="font-semibold text-electric underline">Create one</Link>.</Empty> : (
        <Card pad={false}>
          <Table head={["", "Product", "Price", "Stock", "Status", ""]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-paper">
                <td className="w-16 px-4 py-2"><span className="relative block size-12 overflow-hidden rounded-xl bg-cloud">{p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}</span></td>
                <td className="px-4 py-2"><Link href={`/admin/products/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>{p.is_featured && <Badge tone="violet" className="ml-2">Featured</Badge>}<span className="block text-xs text-slate"><span className="font-mono">{p.sku}</span> · {p.category ?? "No category"} · {p.variants} variant{p.variants === 1 ? "" : "s"}</span></td>
                <td className="px-4 py-2 tabular-nums">{formatTaka(p.sale_price ?? p.price)}{p.sale_price && <s className="ml-1 text-xs text-mist">{formatTaka(p.price)}</s>}</td>
                <td className="px-4 py-2"><span className="tabular-nums">{p.stock}</span>{p.low > 0 && <Badge tone={p.stock === 0 ? "red" : "amber"} className="ml-2">{p.low} low</Badge>}</td>
                <td className="px-4 py-2"><Badge tone={TONE[p.status as keyof typeof TONE]}>{p.status}</Badge></td>
                <td className="px-4 py-2 text-right">
                  <ActionForm action={setProductStatus} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === "published" ? "draft" : "published"} />
                    <SubmitButton size="sm" variant="ghost">{p.status === "published" ? "Unpublish" : "Publish"}</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <Pager page={page} pages={Math.ceil(total / size)} href={(p) => `/admin/products?${qs({ page: String(p) })}`} />
    </>
  );
}
