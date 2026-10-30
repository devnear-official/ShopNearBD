import { SOCIALS } from "@/lib/social";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/admin/form";
import { sendTrackingTest } from "@/actions/admin-tracking";
import { siteUrl } from "@/lib/env";
import { smsProvider } from "@/lib/sms";
import { Badge } from "@/components/admin/ui";
import { saveSettings } from "@/actions/admin-settings";
import { PasswordForm } from "./password-form";
import type { HomepageSettings, PaymentSettings, PolicySettings, StoreSettings } from "@/lib/catalog";
import type { ShippingSettings } from "@/lib/shipping";

const TABS = [["store", "Store"], ["shipping", "Delivery"], ["payments", "Payments"], ["policies", "Policies"], ["homepage", "Homepage"], ["ai", "AI assistant"], ["tracking", "Ads tracking"], ["sms", "Customer login (SMS)"], ["account", "Account"], ["audit", "Audit log"]] as const;
type SmsRow = { id: number; phone_masked: string; purpose: string; provider: string; status: string; detail: string | null; created_at: Date };
type TrackingRow = { id: number; platform: string; event_name: string; event_id: string; status: string; http_status: number | null; detail: string | null; test_mode: boolean; created_at: Date; order_number: string | null };
type TrackingSettingsRow = { meta_pixel_id: string; tiktok_pixel_id: string; purchase_trigger: "placed" | "confirmed"; tiktok_purchase_event: "Purchase" | "CompletePayment"; server_events: boolean };
type AiSettings = { enabled: boolean; model: string; temperature: number; max_output_tokens: number; per_ip_per_minute: number; per_conversation_per_hour: number; retention_days: number; greeting: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminPage();
  const requested = (await searchParams).tab;
  const tab = TABS.some(([k]) => k === requested) ? requested! : "store";
  const [rows, audit, products, events, sms] = await admin.db((tx) => Promise.all([
    tx<{ key: string; value: Record<string, unknown>; updated_at: Date }[]>`select key, value, updated_at from public.site_settings`,
    tab === "audit" ? tx<{ id: number; actor_label: string; action: string; entity: string; entity_id: string | null; created_at: Date }[]>`select id, actor_label, action, entity, entity_id, created_at from public.audit_logs order by id desc limit 100` : Promise.resolve([]),
    tab === "homepage" ? tx<{ slug: string; name: string }[]>`select slug, name from public.products where status = 'published' order by name` : Promise.resolve([]),
    tab === "tracking" ? tx<TrackingRow[]>`select e.id, e.platform, e.event_name, e.event_id, e.status, e.http_status, e.detail, e.test_mode, e.created_at, o.order_number
      from public.tracking_events e left join public.orders o on o.id = e.order_id order by e.id desc limit 40` : Promise.resolve([] as TrackingRow[]),
    tab === "sms" ? tx<SmsRow[]>`select id, phone_masked, purpose, provider, status, detail, created_at from public.sms_log order by id desc limit 40` : Promise.resolve([] as SmsRow[]),
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
      {tab === "sms" && <SmsTab log={sms} />}
      {tab === "tracking" && <TrackingTab v={s.tracking as TrackingSettingsRow} secrets={s.tracking_secrets as Record<string, string> | undefined} events={events} />}
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
        {SOCIALS.map((x) => <Field key={x.key} label={`${x.label} link`} name={x.key} type="url" placeholder="https://" defaultValue={v.social?.[x.key] ?? ""} />)}
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

const mask = (t?: string) => (t ? `saved · ends in …${t.slice(-4)}` : "not set");

function TrackingTab({ v, secrets, events }: { v: TrackingSettingsRow; secrets?: Record<string, string>; events: TrackingRow[] }) {
  const env = {
    meta: Boolean(process.env.META_PIXEL_ID), tiktok: Boolean(process.env.TIKTOK_PIXEL_ID),
    metaToken: Boolean(process.env.META_CAPI_ACCESS_TOKEN), tiktokToken: Boolean(process.env.TIKTOK_EVENTS_ACCESS_TOKEN),
  };
  const feed = `${siteUrl()}/feeds/products.xml`;
  return (
    <div className="space-y-4">
      <Card title="Pixels">
        <ActionForm action={saveSettings} className="space-y-4">
          <input type="hidden" name="key" value="tracking" />
          <p className="text-sm text-slate">The browser pixels load on every storefront page. Every event is also sent from the server (Conversions API / Events API) with the same event ID, so ad blockers and iOS don&apos;t lose your sales and the platforms count each event once.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta (Facebook) Pixel ID" name="meta_pixel_id" defaultValue={v?.meta_pixel_id ?? ""} inputMode="numeric" placeholder="e.g. 123456789012345" hint={env.meta ? "META_PIXEL_ID env var overrides this" : "Events Manager → Data sources"} />
            <Field label="TikTok Pixel ID" name="tiktok_pixel_id" defaultValue={v?.tiktok_pixel_id ?? ""} placeholder="e.g. C1A2B3C4D5E6F7G8H9I0" hint={env.tiktok ? "TIKTOK_PIXEL_ID env var overrides this" : "Ads Manager → Assets → Events"} />
            <Select label="Count a Purchase when…" name="purchase_trigger" defaultValue={v?.purchase_trigger ?? "placed"} options={[{ value: "placed", label: "the order is placed (recommended for ad optimisation)" }, { value: "confirmed", label: "the order is confirmed by our team (fewer fake COD orders)" }]} />
            <Select label="TikTok purchase event name" name="tiktok_purchase_event" defaultValue={v?.tiktok_purchase_event ?? "Purchase"} options={[{ value: "Purchase", label: "Purchase (current standard)" }, { value: "CompletePayment", label: "CompletePayment (older campaigns)" }]} />
          </div>
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="server_events" defaultChecked={v?.server_events !== false} className="size-4 accent-electric" /> Send server-side events (Conversions API + Events API)</label>
          <SubmitButton>Save pixels</SubmitButton>
        </ActionForm>
      </Card>

      <Card title="Server access tokens">
        <ActionForm action={saveSettings} className="space-y-4">
          <input type="hidden" name="key" value="tracking_secrets" />
          <p className="text-sm text-slate">Tokens are stored server-side only and never shown again. Leave a token field empty to keep the saved one.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta Conversions API access token" name="meta_access_token" type="password" autoComplete="off" placeholder={mask(secrets?.meta_access_token)} hint={env.metaToken ? "META_CAPI_ACCESS_TOKEN env var overrides this" : "Events Manager → Settings → Generate access token"} />
            <Field label="Meta test event code (optional)" name="meta_test_event_code" defaultValue={secrets?.meta_test_event_code ?? ""} placeholder="e.g. TEST12345" hint="Remove after testing" />
            <Field label="TikTok Events API access token" name="tiktok_access_token" type="password" autoComplete="off" placeholder={mask(secrets?.tiktok_access_token)} hint={env.tiktokToken ? "TIKTOK_EVENTS_ACCESS_TOKEN env var overrides this" : "Events Manager → Settings → Generate access token"} />
            <Field label="TikTok test event code (optional)" name="tiktok_test_event_code" defaultValue={secrets?.tiktok_test_event_code ?? ""} placeholder="e.g. TEST12345" hint="Remove after testing" />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="clear_meta" className="size-4 accent-electric" /> Remove saved Meta token</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="clear_tiktok" className="size-4 accent-electric" /> Remove saved TikTok token</label>
          </div>
          <SubmitButton>Save tokens</SubmitButton>
        </ActionForm>
        <ActionForm action={sendTrackingTest} className="mt-5 border-t border-line pt-5">
          <p className="mb-3 text-sm text-slate">Sends one test <b>ViewContent</b> event to each platform with a token. With a test event code set, it appears under “Test events”.</p>
          <SubmitButton variant="dark">Send test event</SubmitButton>
        </ActionForm>
      </Card>

      <Card title="What gets tracked">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["PageView", "every page (browser)"], ["ViewContent", "product page"], ["Search", "typed, voice and photo search"], ["AddToCart", "add to bag"],
            ["AddToWishlist", "heart button"], ["InitiateCheckout", "checkout or product-page order form"], ["AddPaymentInfo", "payment chosen"], ["Purchase", "thank-you page + server, value = order total in BDT"],
          ].map(([e, d]) => <li key={e} className="rounded-xl bg-paper px-3 py-2"><b className="font-mono">{e}</b> <span className="text-slate">— {d}</span></li>)}
        </ul>
        <p className="mt-3 text-sm text-slate">Content IDs are your variant SKUs, matching the catalogue feed: <a href={feed} className="break-all font-mono text-electric underline">{feed}</a> — add it in Meta Commerce Manager and TikTok Catalog for dynamic product ads. Orders keep their UTM source and click IDs (fbclid / ttclid), shown on each order and in Analytics.</p>
      </Card>

      <Card title="Recent server events">
        {events.length === 0 ? <p className="text-sm text-slate">No server events yet. They appear here once a token is saved and customers browse or order.</p> : (
          <ul className="divide-y divide-line text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-32 text-xs text-slate">{formatDateTime(e.created_at)}</span>
                <Badge tone={e.status === "sent" ? "green" : e.status === "failed" ? "red" : "gray"}>{e.status}</Badge>
                <b>{e.platform === "meta" ? "Meta" : "TikTok"}</b>
                <span className="font-mono">{e.event_name}</span>
                {e.order_number && <span className="text-slate">{e.order_number}</span>}
                {e.test_mode && <Badge tone="amber">test</Badge>}
                {e.detail && <span className="min-w-0 basis-full truncate text-xs text-slate sm:basis-auto sm:flex-1">{e.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SmsTab({ log }: { log: SmsRow[] }) {
  const provider = smsProvider();
  const label = provider === "bulksmsbd" ? `BulkSMSBD (sender ID ${process.env.BULKSMSBD_SENDER_ID})` : provider === "sslwireless" ? `SSL Wireless (SID ${process.env.SSL_SMS_SID})` : provider === "console" ? "Development outbox — no real SMS is sent" : null;
  return (
    <div className="space-y-4">
      <Card title="Customer accounts">
        <p className={clsx("rounded-2xl p-3 text-sm font-medium", provider && provider !== "console" ? "bg-mint/10 text-[#0b7a55]" : "bg-sun/20 text-[#7a4d05]")}>
          {label ? `SMS gateway: ${label}.` : "No SMS gateway is configured, so customers can't log in yet (ordering and private order links still work)."}
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate">
          <li>Every phone number that orders gets an account automatically. Customers log in at <span className="font-mono">/account/login</span> with a 6-digit code sent by SMS — no password — and see every order on their number, its status and their total.</li>
          <li>Codes expire after 5 minutes and allow 5 tries. Limits: 1 code per number per minute, 5 per number and 10 per device per hour, 300 per hour store-wide (protects your SMS balance).</li>
          <li>Set the gateway with environment variables on the server: <span className="font-mono">SMS_PROVIDER=bulksmsbd</span> + <span className="font-mono">BULKSMSBD_API_KEY</span>, <span className="font-mono">BULKSMSBD_SENDER_ID</span> — or <span className="font-mono">SMS_PROVIDER=sslwireless</span> + <span className="font-mono">SSL_SMS_API_TOKEN</span>, <span className="font-mono">SSL_SMS_SID</span>. Some gateways need your server&apos;s IP whitelisted.</li>
        </ul>
      </Card>
      <Card title="Recent SMS">
        {log.length === 0 ? <p className="text-sm text-slate">No SMS sent yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-32 text-xs text-slate">{formatDateTime(l.created_at)}</span>
                <Badge tone={l.status === "sent" ? "green" : "red"}>{l.status}</Badge>
                <span className="font-mono">{l.phone_masked}</span>
                <span className="text-slate">{l.provider}</span>
                {l.detail && <span className="min-w-0 basis-full truncate text-xs text-slate sm:basis-auto sm:flex-1">{l.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
