import type { Metadata } from "next";
import { getFaqs, getPublicSettings } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { Streaks } from "@/components/ui/streaks";

export const metadata: Metadata = {
  title: "Help, delivery & returns",
  description: "Delivery charges, payment options, returns, refunds and answers to common questions.",
  alternates: { canonical: "/help" },
};

export default async function HelpPage() {
  const [s, faqs] = await Promise.all([getPublicSettings(), getFaqs()]);
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) };
  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <Streaks className="h-6 w-12" />
      <h1 className="display mt-4 text-[clamp(2.4rem,9vw,6rem)]">How can we help?</h1>
      <p className="bn mt-1 text-lg text-slate" lang="bn">সাহায্য ও নীতিমালা</p>
      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        {[["delivery", "Delivery"], ["payments", "Payments"], ["returns", "Returns & refunds"], ["faq", "FAQ"], ["contact", "Contact"]].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-full bg-white px-4 py-2 shadow-[var(--shadow-card)] hover:bg-cloud">{l}</a>
        ))}
      </nav>

      <Section id="delivery" title="Delivery & charges">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-slate"><th className="py-2 font-semibold">Area</th><th className="py-2 font-semibold">Time</th><th className="py-2 text-right font-semibold">Charge</th></tr></thead>
          <tbody className="divide-y divide-line">
            {s.shipping.zones.map((z) => <tr key={z.id}><td className="py-3 font-medium">{z.label} {z.label_bn && <span className="bn text-slate" lang="bn">({z.label_bn})</span>}</td><td className="py-3 text-slate">{z.eta}</td><td className="py-3 text-right font-bold">{formatTaka(z.fee)}</td></tr>)}
          </tbody>
        </table>
        {s.shipping.free_shipping_threshold ? <p className="mt-4 text-sm">Free delivery on orders of {formatTaka(s.shipping.free_shipping_threshold)} or more (after discounts).</p> : null}
      </Section>

      <Section id="payments" title="Payments">
        <ul className="space-y-3 text-ink-2">
          {s.payments.cod?.enabled && <li><b>Cash on Delivery</b> — {s.payments.cod.note}</li>}
          {s.payments.bkash_manual?.enabled && <li><b>bKash</b> — {s.payments.bkash_manual.instructions}</li>}
          {s.payments.nagad_manual?.enabled && <li><b>Nagad</b> — {s.payments.nagad_manual.instructions}</li>}
        </ul>
        <p className="mt-4 rounded-2xl bg-sun/15 p-4 text-sm font-medium text-[#7a4d05]">Advance payments are matched against our account statement by a person before your order is confirmed. We will never ask for your PIN, OTP or password.</p>
      </Section>

      <Section id="returns" title="Returns, refunds & cancellation">
        <h3 className="font-semibold">Returns</h3><p className="mt-1 text-ink-2">{s.policies.returns}</p>
        <h3 className="mt-4 font-semibold">Refunds</h3><p className="mt-1 text-ink-2">{s.policies.refunds}</p>
        <h3 className="mt-4 font-semibold">Cancellation</h3><p className="mt-1 text-ink-2">{s.policies.cancellation}</p>
        <h3 className="mt-4 font-semibold">Warranty</h3><p className="mt-1 text-ink-2">{s.policies.warranty}</p>
      </Section>

      <Section id="faq" title="Frequently asked questions">
        <div className="divide-y divide-line">
          {faqs.map((f) => (
            <details key={f.id} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{f.question}<span aria-hidden className="text-xl transition group-open:rotate-45">+</span></summary>
              <p className="mt-2 text-ink-2">{f.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section id="contact" title="Contact">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm text-slate">Phone</dt><dd className="font-semibold">{s.store.phone}</dd></div>
          <div><dt className="text-sm text-slate">Email</dt><dd className="font-semibold">{s.store.email}</dd></div>
          <div><dt className="text-sm text-slate">Address</dt><dd className="font-semibold">{s.store.address}</dd></div>
          <div><dt className="text-sm text-slate">Hours</dt><dd className="font-semibold">{s.store.hours}</dd></div>
        </dl>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-10 scroll-mt-28 rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
      <h2 id={`${id}-h`} className="display mb-4 text-3xl">{title}</h2>
      {children}
    </section>
  );
}
