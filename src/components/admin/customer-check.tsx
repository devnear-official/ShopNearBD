import { Phone } from "lucide-react";
import { PROVIDERS } from "@/lib/couriers";
import { assessRisk, type RiskInput } from "@/lib/risk";
import { formatDate } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { Badge, Card } from "./ui";

const LEVEL = {
  new: { tone: "blue", bar: "bg-electric" },
  low: { tone: "green", bar: "bg-mint" },
  medium: { tone: "amber", bar: "bg-sun" },
  high: { tone: "red", bar: "bg-flame" },
} as const;

/**
 * "Can I trust this phone number?" — the store's own history for the phone across every courier,
 * a risk level with reasons, and one-tap WhatsApp / call to confirm the order with the customer.
 */
export function CustomerCheck({ phone, risk, confirmText }: { phone: string; risk: RiskInput; confirmText: string }) {
  const a = assessRisk(risk);
  const wa = waLink(phone, confirmText);
  const pct = a.successRate === null ? null : Math.round(a.successRate * 100);
  const L = LEVEL[a.level];
  return (
    <Card title="Customer check" actions={<Badge tone={L.tone}>{a.level === "new" ? "New" : a.level === "low" ? "Low risk" : a.level === "medium" ? "Medium risk" : "High risk"}</Badge>}>
      <p className="font-semibold">{a.headline}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-slate">{a.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>

      <div className="mt-3" aria-label={pct === null ? "No finished orders yet" : `${pct}% delivered`}>
        <div className="flex justify-between text-xs font-semibold text-slate"><span>Delivery success</span><span>{pct === null ? "—" : `${pct}%`}</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-cloud"><div className={`h-full rounded-full ${L.bar}`} style={{ width: `${pct ?? 0}%` }} /></div>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
        {([["Orders", risk.orders], ["Delivered", risk.delivered], ["Cancelled", risk.cancelled], ["Returned", risk.returned]] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-paper px-1 py-2"><dd className="font-display text-xl font-bold tabular-nums">{v}</dd><dt className="text-[0.7rem] text-slate">{k}</dt></div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-slate">
        {risk.first_order ? `First order ${formatDate(new Date(risk.first_order))}` : ""}{risk.open > 0 ? ` · ${risk.open} still open` : ""}{risk.avg_total ? ` · average ৳${risk.avg_total}` : ""}
      </p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate">By courier</h3>
      {risk.couriers.length ? (
        <table className="mt-1 w-full text-sm">
          <thead><tr className="text-left text-xs text-slate"><th className="py-1 font-medium">Courier</th><th className="font-medium">Parcels</th><th className="font-medium">Delivered</th><th className="font-medium">Returned</th><th className="text-right font-medium">Success</th></tr></thead>
          <tbody>
            {risk.couriers.map((c) => {
              const done = c.delivered + c.returned;
              return (
                <tr key={c.provider} className="border-t border-line">
                  <td className="py-1.5 font-semibold">{PROVIDERS[c.provider]?.label ?? c.provider}</td>
                  <td className="tabular-nums">{c.total}</td>
                  <td className="tabular-nums text-mint">{c.delivered}</td>
                  <td className={`tabular-nums ${c.returned ? "font-bold text-flame" : ""}`}>{c.returned}</td>
                  <td className="text-right tabular-nums">{done ? `${Math.round((c.delivered / done) * 100)}%` : c.in_flight ? "in transit" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <p className="mt-1 text-sm text-slate">No courier parcels booked for this phone yet.</p>}
      <p className="mt-3 text-xs text-slate">Built from this store&apos;s own orders and parcels. Couriers don&apos;t share other merchants&apos; delivery history through their public APIs, so a number that is new here can still be risky elsewhere — when in doubt, confirm by call or WhatsApp.</p>

      <div className="mt-4 grid grid-cols-[3fr_2fr] gap-2">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="group/cap relative flex h-11 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-[#1fae54] text-sm font-semibold text-white transition active:scale-[0.97] hover:bg-[#189b49]">
            <WhatsAppIcon className="size-5" /> Confirm on WhatsApp
          </a>
        ) : <span className="grid h-11 place-items-center rounded-full bg-cloud text-sm text-slate">No valid number</span>}
        <a href={`tel:${phone}`} className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition active:scale-[0.97] hover:bg-ink-2"><Phone className="size-4" /> Call</a>
      </div>
    </Card>
  );
}
