import { requireAdminPage } from "@/lib/auth";
import { formatDate, formatTaka } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { ActionForm, Field, Select, SubmitButton } from "@/components/admin/form";
import { saveCoupon } from "@/actions/admin-catalog";

type C = { id: string; code: string; description: string | null; type: "percent" | "fixed"; value: number; min_subtotal: number; max_discount: number | null; starts_at: Date | null; ends_at: Date | null; usage_limit: number | null; per_phone_limit: number | null; used_count: number; is_active: boolean; discount_total: number };
const d = (x: Date | null) => (x ? new Date(x).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) : "");

function CouponForm({ c }: { c?: C }) {
  return (
    <ActionForm action={saveCoupon} className="grid gap-3 sm:grid-cols-4" resetOnSuccess={!c}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Code" name="code" defaultValue={c?.code} required className="uppercase" />
      <Select label="Type" name="type" defaultValue={c?.type ?? "percent"} options={[{ value: "percent", label: "Percent off" }, { value: "fixed", label: "Fixed ৳ off" }]} />
      <Field label="Value" name="value" type="number" step="1" min={1} defaultValue={c?.value} required />
      <Field label="Max discount ৳" name="max_discount" type="number" min={1} defaultValue={c?.max_discount ?? ""} />
      <Field label="Min. subtotal ৳" name="min_subtotal" type="number" min={0} defaultValue={c?.min_subtotal ?? 0} />
      <Field label="Starts" name="starts_at" type="date" defaultValue={d(c?.starts_at ?? null)} />
      <Field label="Ends" name="ends_at" type="date" defaultValue={d(c?.ends_at ?? null)} />
      <Field label="Total uses" name="usage_limit" type="number" min={1} defaultValue={c?.usage_limit ?? ""} hint="blank = unlimited" />
      <Field label="Uses per phone" name="per_phone_limit" type="number" min={1} defaultValue={c?.per_phone_limit ?? ""} />
      <Field label="Description" name="description" defaultValue={c?.description ?? ""} className="sm:col-span-2" />
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="size-4 accent-electric" /> Active</label>
      <div className="sm:col-span-4"><SubmitButton size="sm">{c ? "Save coupon" : "Create coupon"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function CouponsPage() {
  const admin = await requireAdminPage();
  const rows = await admin.db((tx) => tx<C[]>`select c.*, coalesce((select sum(amount) from public.coupon_redemptions r where r.coupon_id = c.id), 0) as discount_total from public.coupons c order by created_at desc`);
  return (
    <>
      <PageHeader title="Coupons" description="Discounts are recalculated on the server at checkout; a coupon use is released if the order is cancelled." />
      <Card title="New coupon" className="mb-4"><CouponForm /></Card>
      <div className="space-y-3">
        {rows.map((c) => (
          <details key={c.id} className="rounded-3xl bg-white shadow-[var(--shadow-card)]">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-5">
              <span className="font-mono text-lg font-bold">{c.code}</span>
              <Badge tone={c.is_active ? "green" : "gray"}>{c.is_active ? "Active" : "Off"}</Badge>
              <span className="text-sm">{c.type === "percent" ? `${c.value}% off` : `${formatTaka(c.value)} off`}{c.min_subtotal > 0 && ` over ${formatTaka(c.min_subtotal)}`}{c.max_discount && ` (max ${formatTaka(c.max_discount)})`}</span>
              <span className="ml-auto text-sm text-slate">Used {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ""} · {formatTaka(c.discount_total)} given{c.ends_at && ` · ends ${formatDate(c.ends_at)}`}</span>
            </summary>
            <div className="border-t border-line p-5"><CouponForm c={c} /></div>
          </details>
        ))}
      </div>
    </>
  );
}
