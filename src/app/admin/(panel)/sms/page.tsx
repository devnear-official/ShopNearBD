import { requireAdminPage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { formatDateTime } from "@/lib/format";
import { DEFAULT_TEMPLATES, SMS_EVENTS, SMS_EVENT_LABEL, renderSms, smsTemplates, type SmsEvent } from "@/lib/order-sms";
import { smsProvider } from "@/lib/sms";
import { resendOrderSms, saveSmsTemplates } from "@/actions/admin-sms";

type Log = { id: number; event: SmsEvent; status: string; detail: string | null; attempts: number; created_at: Date; order_number: string };

export default async function SmsPage() {
  const admin = await requireAdminPage();
  const [{ templates, enabled }, logs] = await Promise.all([
    smsTemplates(),
    admin.db((tx) => tx<Log[]>`select s.id, s.event, s.status, s.detail, s.attempts, s.created_at, o.order_number from public.order_sms s join public.orders o on o.id = s.order_id order by s.id desc limit 60`),
  ]);
  const provider = smsProvider();
  return (
    <>
      <PageHeader title="Order SMS" description="Messages sent to customers as their order moves. Each one ends with the order's private Track Order link." />
      <p className="mb-4 rounded-2xl bg-white p-4 text-sm shadow-[var(--shadow-card)]">
        Gateway: {provider ? <Badge tone={provider === "console" ? "amber" : "green"}>{provider === "console" ? "console (development — nothing is really sent)" : provider}</Badge> : <Badge tone="red">not configured — set SMS_PROVIDER and its keys</Badge>}
      </p>
      <Card title="Templates" className="mb-6">
        <ActionForm action={saveSmsTemplates} className="space-y-4">
          {SMS_EVENTS.map((e) => {
            const preview = renderSms(templates[e], { name: "Rahim Uddin", order: "SN20261102001", link: "https://your-site/order/SN20261102001?s=xxxxxxxxxxxxxxxxxxxxxx" });
            return (
              <div key={e} className="rounded-2xl bg-paper p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="label !mb-0">{SMS_EVENT_LABEL[e]}</span>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name={`on_${e}`} defaultChecked={enabled[e]} className="size-4 accent-electric" /> Send</label>
                </div>
                <textarea name={`t_${e}`} defaultValue={templates[e]} rows={2} maxLength={160} className="input" aria-label={`${SMS_EVENT_LABEL[e]} message`} />
                <p className="mt-1 text-xs text-slate">Preview ({preview.length} characters{/[^\x00-\x7f]/.test(preview) ? ", Bangla text makes it a Unicode SMS: 70 characters per part" : ", 160 per part"}): {preview}</p>
                {templates[e] !== DEFAULT_TEMPLATES[e] && <p className="text-xs text-mist">Customised.</p>}
              </div>
            );
          })}
          <p className="text-xs text-slate">Use {"{name}"} (first name) and {"{order}"}. The link is added automatically at the end. Long messages are sent as several parts by the gateway.</p>
          <SubmitButton>Save templates</SubmitButton>
        </ActionForm>
      </Card>
      <Card title="Recent order SMS" pad={false} className="overflow-hidden">
        <div className="overflow-x-auto p-5 pt-0">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate"><tr><th className="py-2">When</th><th>Order</th><th>Event</th><th>Status</th><th>Detail</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td className="pr-3 font-mono">{l.order_number}</td>
                  <td className="pr-3">{SMS_EVENT_LABEL[l.event]}</td>
                  <td className="pr-3"><Badge tone={l.status === "sent" ? "green" : l.status === "failed" ? "red" : "gray"}>{l.status}</Badge></td>
                  <td className="pr-3 text-slate">{l.detail ?? "—"}</td>
                  <td>{l.status !== "sent" && <ActionForm action={resendOrderSms}><input type="hidden" name="id" value={l.id} /><SubmitButton size="sm" variant="ghost">Resend</SubmitButton></ActionForm>}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={6} className="py-6 text-center text-slate">No order SMS yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
