import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton, TextArea } from "@/components/admin/form";
import { saveSettings } from "@/actions/admin-settings";
import { PasswordForm } from "./password-form";
import type { HomepageSettings, PaymentSettings, PolicySettings, StoreSettings } from "@/lib/catalog";
import type { ShippingSettings } from "@/lib/shipping";

const TABS = [["store", "Store"], ["shipping", "Delivery"], ["payments", "Payments"], ["policies", "Policies"], ["homepage", "Homepage"], ["ai", "AI assistant"], ["account", "Account"], ["audit", "Audit log"]] as const;
type AiSettings = { enabled: boolean; model: string; temperature: number; max_output_tokens: number; per_ip_per_minute: number; per_conversation_per_hour: number; retention_days: number; greeting: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminPage();
  const requested = (await searchParams).tab;
  const tab = TABS.some(([k]) => k === requested) ? requested! : "store";
  const [rows, audit, products] = await admin.db((tx) => Promise.all([
    tx<{ key: string; value: Record<string, unknown>; updated_at: Date }[]>`select key, value, updated_at from public.site_settings`,
    tab === "audit" ? tx<{ id: number; actor_label: string; action: string; entity: string; entity_id: string | null; created_at: Date }[]>`select id, actor_label, action, entity, entity_id, created_at from public.audit_logs order by id desc limit 100` : Promise.resolve([]),
    tab === "homepage" ? tx<{ slug: string; name: string }[]>`select slug, name from public.products where status = 'published' order by name` : Promise.resolve([]),
  ]));
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, never>;
  const devDefaults = rows.filter((r) => (r.value as { dev_default?: boolean }).dev_default).map((r) => r.key);

  return (
    <>
      <PageHeader title="Settings" description="Everything customers see about delivery, payment and policies comes from here." />
      {devDefaults.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sun/20 p-4 text-sm font-medium text-[#7a4d05]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Development defaults still in use: <b>{devDefaults.join(", ")}</b>. Review and save each section before launch.</p>
      )}
      <nav aria-label="Settings sections" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map(([k, l]) => <Link key={k} href={`/admin/settings?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={clsx("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", tab === k ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)]")}>{l}{devDefaults.includes(k) && " •"}</Link>)}
      </nav>

      {tab === "store" && <StoreForm v={s.store as StoreSettings} />}
      {tab === "shipping" && <ShippingForm v={s.shipping as ShippingSettings} />}
      {tab === "payments" && <PaymentsForm v={s.payments as PaymentSettings} />}
      {tab === "policies" && <PoliciesForm v={s.policies as PolicySettings} />}
      {tab === "homepage" && <HomepageForm v={s.homepage as HomepageSettings} products={products} />}
      {tab === "ai" && <AiForm v={s.ai as AiSettings} />}
      {tab === "account" && <Card title="Change your password"><PasswordForm /><p className="mt-4 text-xs text-slate">Signed in as {admin.email}. Forgot it? Use “Forgot password” on the sign-in page.</p></Card>}
      {tab === "audit" && (
        <Card title="Audit log (latest 100)">
          <ul className="divide-y divide-line text-sm">
            {audit.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 py-2"><span className="w-36 text-xs text-slate">{formatDateTime(a.created_at)}</span><b>{a.action}</b><span className="text-slate">{a.entity}{a.entity_id ? ` ${a.entity_id.slice(0, 8)}` : ""}</span><span className="ml-auto text-xs">{a.actor_label}</span></li>)}
          </ul>
        </Card>
      )}
    </>
  );
}

function Form({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <Card>
      <ActionForm action={saveSettings} className="space-y-4">
        <input type="hidden" name="key" value={k} />
        {children}
        <SubmitButton>Save</SubmitButton>
      </ActionForm>
    </Card>
  );
}

function StoreForm({ v }: { v: StoreSettings }) {
  return (
    <Form k="store">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Store name" name="name" defaultValue={v.name} required />
        <Field label="Support email" name="email" type="email" defaultValue={v.email} required />
        <Field label="Phone" name="phone" defaultValue={v.phone} required />
        <Field label="WhatsApp" name="whatsapp" defaultValue={v.whatsapp} />
        <Field label="Tagline" name="tagline" defaultValue={v.tagline} />
        <Field label="Tagline (Bangla)" name="tagline_bn" defaultValue={v.tagline_bn} />
        <Field label="Address" name="address" defaultValue={v.address} required />
        <Field label="Support hours" name="hours" defaultValue={v.hours} />
        {(["facebook", "instagram", "tiktok", "youtube"] as const).map((k) => <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} URL`} name={k} type="url" defaultValue={v.social?.[k] ?? ""} />)}
      </div>
    </Form>
  );
}

function ShippingForm({ v }: { v: ShippingSettings }) {
  const zones = [...v.zones, ...Array(Math.max(0, 5 - v.zones.length)).fill(null)].slice(0, 5);
  return (
    <Form k="shipping">
      <p className="text-sm text-slate">Up to five zones. The checkout charges the fee of the zone the customer&apos;s district maps to. Leave a row&apos;s ID empty to remove it.</p>
      <div className="space-y-2">
        {zones.map((z, i) => (
          <div key={i} className="grid gap-2 rounded-2xl bg-paper p-3 sm:grid-cols-6">
            <Field label="Zone ID" name={`zone_${i}_id`} defaultValue={z?.id ?? ""} placeholder="e.g. inside_dhaka" />
            <Field label="Label" name={`zone_${i}_label`} defaultValue={z?.label ?? ""} className="sm:col-span-2" />
            <Field label="Bangla label" name={`zone_${i}_label_bn`} defaultValue={z?.label_bn ?? ""} />
            <Field label="Fee ৳" name={`zone_${i}_fee`} type="number" min={0} defaultValue={z?.fee ?? ""} />
            <Field label="Delivery time" name={`zone_${i}_eta`} defaultValue={z?.eta ?? ""} />
          </div>
        ))}
      </div>
      <TextArea label="District → zones" hint="One per line: District: zone_a, zone_b (first is default). Other districts use the default zone." name="district_zones" rows={5} className="font-mono"
        defaultValue={Object.entries(v.district_zones).map(([d, z]) => `${d}: ${z.join(", ")}`).join("\n")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default zone ID" name="default_zone" defaultValue={v.default_zone} required />
        <Field label="Free delivery from ৳" hint="blank = never" name="free_shipping_threshold" type="number" min={0} defaultValue={v.free_shipping_threshold ?? ""} />
      </div>
    </Form>
  );
}

function PaymentsForm({ v }: { v: PaymentSettings }) {
  return (
    <Form k="payments">
      <fieldset className="rounded-2xl bg-paper p-4">
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="cod_enabled" defaultChecked={v.cod?.enabled} className="size-4 accent-electric" /> Cash on Delivery</label>
        <Field label="Note shown to customers" name="cod_note" defaultValue={v.cod?.note ?? ""} className="mt-2" />
      </fieldset>
      {(["bkash_manual", "nagad_manual"] as const).map((k) => (
        <fieldset key={k} className="rounded-2xl bg-paper p-4">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name={`${k}_enabled`} defaultChecked={v[k]?.enabled} className="size-4 accent-electric" /> {k === "bkash_manual" ? "bKash" : "Nagad"} — manual Send Money, verified by staff</label>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Field label="Merchant/personal number" name={`${k}_number`} defaultValue={v[k]?.number} />
            <Field label="Account type" name={`${k}_type`} defaultValue={v[k]?.account_type} placeholder="Personal / Merchant / Agent" />
          </div>
          <TextArea label="Instructions" name={`${k}_instructions`} rows={2} defaultValue={v[k]?.instructions} className="mt-2" />
        </fieldset>
      ))}
      <p className="text-xs text-slate">Automatic gateway verification (bKash Tokenized Checkout, SSLCommerz) requires a merchant account and a server callback; see the README. Until then every advance payment is checked by a person.</p>
    </Form>
  );
}

function PoliciesForm({ v }: { v: PolicySettings }) {
  return (
    <Form k="policies">
      {(["returns", "refunds", "cancellation", "warranty"] as const).map((k) => <TextArea key={k} label={k[0].toUpperCase() + k.slice(1)} name={k} rows={3} defaultValue={v[k]} />)}
    </Form>
  );
}

function HomepageForm({ v, products }: { v: HomepageSettings; products: { slug: string; name: string }[] }) {
  return (
    <Form k="homepage">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hero eyebrow" name="hero_eyebrow" defaultValue={v.hero_eyebrow} />
        <label className="block"><span className="label">Hero product</span>
          <select name="hero_product_slug" defaultValue={v.hero_product_slug ?? ""} className="input"><option value="">Most popular featured product</option>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
        </label>
        <Field label="Hero title" name="hero_title" defaultValue={v.hero_title} />
        <Field label="Hero title (accent line)" name="hero_title_accent" defaultValue={v.hero_title_accent} />
      </div>
      <TextArea label="Hero subtitle" name="hero_subtitle" rows={2} defaultValue={v.hero_subtitle} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campaign title" name="campaign_title" defaultValue={v.campaign_title} />
        <Field label="Campaign collection" hint="products tagged with this collection" name="campaign_collection" defaultValue={v.campaign_collection} />
      </div>
      <TextArea label="Campaign story" name="campaign_body" rows={3} defaultValue={v.campaign_body} />
      <TextArea label="Ticker messages" hint="one per line" name="marquee" rows={4} defaultValue={v.marquee.join("\n")} />
    </Form>
  );
}

function AiForm({ v }: { v: AiSettings }) {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  return (
    <Form k="ai">
      <p className={clsx("rounded-2xl p-3 text-sm font-medium", configured ? "bg-mint/10 text-[#0b7a55]" : "bg-sun/20 text-[#7a4d05]")}>{configured ? "GEMINI_API_KEY is set on the server." : "GEMINI_API_KEY is not set — the chat answers from FAQs/products only and offers a human hand-off."}</p>
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="enabled" defaultChecked={v.enabled} className="size-4 accent-electric" /> AI replies enabled</label>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Model" name="model" defaultValue={v.model} />
        <Field label="Temperature (0–1)" name="temperature" type="number" step="0.1" min={0} max={1} defaultValue={v.temperature} />
        <Field label="Max reply tokens" name="max_output_tokens" type="number" min={100} max={2000} defaultValue={v.max_output_tokens} />
        <Field label="Messages per IP / minute" name="per_ip_per_minute" type="number" min={1} defaultValue={v.per_ip_per_minute} />
        <Field label="Messages per chat / hour" name="per_conversation_per_hour" type="number" min={5} defaultValue={v.per_conversation_per_hour} />
        <Field label="Keep conversations (days)" name="retention_days" type="number" min={7} defaultValue={v.retention_days} />
      </div>
      <TextArea label="Greeting" name="greeting" rows={2} defaultValue={v.greeting} />
    </Form>
  );
}
