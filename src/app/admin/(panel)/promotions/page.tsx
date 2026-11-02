import { requireAdminPage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/admin/form";
import { ImageField } from "@/components/admin/image-field";
import { deletePromo, movePromo, saveHeroBanner, saveTickerItem, togglePromo } from "@/actions/admin-promo";
import { LINK_LABEL, LINK_TYPES, TICKER_KINDS, TICKER_KIND_LABEL, resolveLink } from "@/lib/promo";

type Row = {
  id: string; image_url: string | null; link_type: string; link_target: string | null; sort_order: number; is_active: boolean;
  starts_at: Date | null; ends_at: Date | null;
  title?: string; description?: string | null; button_text?: string | null; kind?: string; text?: string;
};

/** datetime-local value in Bangladesh time (UTC+6). */
const bdLocal = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 16) : "");
const linkOptions = LINK_TYPES.map((t) => ({ value: t, label: LINK_LABEL[t] }));

function status(r: Row) {
  const now = Date.now();
  if (!r.is_active) return <Badge tone="gray">Hidden</Badge>;
  if (r.starts_at && r.starts_at.getTime() > now) return <Badge tone="amber">Scheduled</Badge>;
  if (r.ends_at && r.ends_at.getTime() <= now) return <Badge tone="red">Expired</Badge>;
  return <Badge tone="green">Live</Badge>;
}

function Shared({ r }: { r?: Row }) {
  return (
    <>
      <ImageField label="Image" defaultValue={r?.image_url} hint="JPG, PNG, WebP or AVIF" />
      <Select label="Links to" name="link_type" defaultValue={r?.link_type ?? "deals"} options={linkOptions} />
      <Field label="Slug or URL" name="link_target" defaultValue={r?.link_target ?? ""} hint="not needed for Deals" placeholder="e.g. summer-sale or /help" />
      <Field label="Show from (Dhaka time)" name="starts_at" type="datetime-local" defaultValue={bdLocal(r?.starts_at ?? null)} hint="optional" />
      <Field label="Hide after (Dhaka time)" name="ends_at" type="datetime-local" defaultValue={bdLocal(r?.ends_at ?? null)} hint="optional" />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? true} className="size-4 accent-electric" /> Live on the store</label>
    </>
  );
}

function HeroForm({ r }: { r?: Row }) {
  return (
    <ActionForm action={saveHeroBanner} className="grid gap-3 sm:grid-cols-2" resetOnSuccess={!r}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <Field label="Title" name="title" defaultValue={r?.title} required maxLength={120} className="sm:col-span-2" />
      <TextArea label="Description" name="description" defaultValue={r?.description ?? ""} rows={2} maxLength={300} className="sm:col-span-2" />
      <Field label="Button text" name="button_text" defaultValue={r?.button_text ?? ""} maxLength={40} placeholder="Shop now" />
      <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2"><Shared r={r} /></div>
      <div className="sm:col-span-2"><SubmitButton size="sm">{r ? "Save banner" : "Add banner"}</SubmitButton></div>
    </ActionForm>
  );
}

function TickerForm({ r }: { r?: Row }) {
  return (
    <ActionForm action={saveTickerItem} className="grid gap-3 sm:grid-cols-2" resetOnSuccess={!r}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <Select label="Type" name="kind" defaultValue={r?.kind ?? "offer"} options={TICKER_KINDS.map((k) => ({ value: k, label: TICKER_KIND_LABEL[k] }))} />
      <Field label="Message" name="text" defaultValue={r?.text} required maxLength={140} placeholder="Flash deal: 20% off all bags" />
      <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2"><Shared r={r} /></div>
      <div className="sm:col-span-2"><SubmitButton size="sm">{r ? "Save item" : "Add item"}</SubmitButton></div>
    </ActionForm>
  );
}

function Controls({ table, r, last, first }: { table: "hero_banners" | "ticker_items"; r: Row; first: boolean; last: boolean }) {
  const hidden = <><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={r.id} /></>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ActionForm action={movePromo}>{hidden}<input type="hidden" name="dir" value="up" /><SubmitButton size="sm" variant="ghost" className={first ? "pointer-events-none opacity-40" : ""}>↑ Up</SubmitButton></ActionForm>
      <ActionForm action={movePromo}>{hidden}<input type="hidden" name="dir" value="down" /><SubmitButton size="sm" variant="ghost" className={last ? "pointer-events-none opacity-40" : ""}>↓ Down</SubmitButton></ActionForm>
      <ActionForm action={togglePromo}>{hidden}<input type="hidden" name="active" value={r.is_active ? "0" : "1"} /><SubmitButton size="sm" variant="ghost">{r.is_active ? "Hide" : "Show"}</SubmitButton></ActionForm>
      <ActionForm action={deletePromo}>{hidden}<SubmitButton size="sm" variant="ghost" confirm="Delete this permanently? This can't be undone.">Delete</SubmitButton></ActionForm>
    </div>
  );
}

function List({ table, rows, title }: { table: "hero_banners" | "ticker_items"; rows: Row[]; title: (r: Row) => string }) {
  if (!rows.length) return <p className="rounded-3xl bg-white p-6 text-sm text-slate shadow-[var(--shadow-card)]">Nothing here yet. Add the first one above.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <details key={r.id} className="rounded-3xl bg-white shadow-[var(--shadow-card)]">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
            <span className="grid size-7 place-items-center rounded-full bg-cloud text-xs font-bold tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{title(r)}</span>
            {status(r)}
            <span className="hidden text-xs text-slate sm:inline">{resolveLink(r.link_type, r.link_target) ?? "no valid link"}</span>
          </summary>
          <div className="space-y-4 border-t border-line p-5">
            {table === "hero_banners" ? <HeroForm r={r} /> : <TickerForm r={r} />}
            <Controls table={table} r={r} first={i === 0} last={i === rows.length - 1} />
          </div>
        </details>
      ))}
    </div>
  );
}

export default async function PromotionsPage() {
  const admin = await requireAdminPage();
  const [heroes, ticker] = await admin.db(async (tx) => [
    await tx<Row[]>`select * from public.hero_banners order by sort_order, created_at`,
    await tx<Row[]>`select * from public.ticker_items order by sort_order, created_at`,
  ]);
  return (
    <>
      <PageHeader title="Promotions" description="Homepage hero banners and the moving ticker. Changes appear on the store within a minute." />

      <h2 className="mb-3 font-display text-xl font-bold">Hero banners</h2>
      <p className="mb-3 text-sm text-slate">With at least one live banner the homepage shows these slides. With none, it keeps the standard hero.</p>
      <Card title="New banner" className="mb-4"><HeroForm /></Card>
      <List table="hero_banners" rows={heroes} title={(r) => r.title ?? ""} />

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">Ticker</h2>
      <p className="mb-3 text-sm text-slate">The scrolling strip under the hero. With no live items it falls back to the plain ticker messages in Settings.</p>
      <Card title="New ticker item" className="mb-4"><TickerForm /></Card>
      <List table="ticker_items" rows={ticker} title={(r) => `${TICKER_KIND_LABEL[(r.kind ?? "offer") as keyof typeof TICKER_KIND_LABEL] ?? "Offer"} · ${r.text}`} />
    </>
  );
}
