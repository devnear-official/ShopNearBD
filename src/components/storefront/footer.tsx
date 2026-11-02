import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import type { Category, PublicSettings } from "@/lib/catalog";
import { Logo } from "@/components/ui/logo";
import { Streaks, Swoosh } from "@/components/ui/streaks";
import { Year } from "@/components/ui/year";
import { SocialIcon } from "@/components/ui/social-icon";
import { SOCIALS } from "@/lib/social";
import { waLink } from "@/lib/whatsapp";

export function Footer({ settings, categories }: { settings: PublicSettings; categories: Category[] }) {
  const s = settings.store;
  const wa = waLink(s.whatsapp, "Hi ShopNear BD!");
  const socials = [
    ...(wa ? [{ key: "whatsapp" as const, label: "WhatsApp", href: wa, color: "#1fae54" }] : []),
    ...SOCIALS.filter((x) => s.social?.[x.key]).map((x) => ({ key: x.key, label: x.label, href: s.social[x.key], color: x.color })),
  ];
  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-white">
      <Swoosh className="pointer-events-none absolute -top-px left-0 h-10 w-full rotate-180 opacity-90" />
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          <div>
            <Logo tone="dark" className="h-12" />
            <p className="mt-5 max-w-xs text-white/70">{s.tagline}</p>
            <p className="bn mt-1 text-white/50" lang="bn">{s.tagline_bn}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              {["Cash on Delivery", settings.payments.bkash_manual?.enabled && "bKash", settings.payments.nagad_manual?.enabled && "Nagad"].filter(Boolean).map((p) => (
                <span key={String(p)} className="rounded-full bg-white/10 px-3 py-1.5">{p}</span>
              ))}
            </div>
          </div>
          <FooterCol title="Shop">
            <FooterLink href="/shop">All products</FooterLink>
            {categories.map((c) => <FooterLink key={c.slug} href={`/shop?category=${c.slug}`}>{c.name}</FooterLink>)}
          </FooterCol>
          <FooterCol title="Help">
            <FooterLink href="/order">Track my order</FooterLink>
            <FooterLink href="/help#delivery">Delivery & charges</FooterLink>
            <FooterLink href="/help#returns">Returns & refunds</FooterLink>
            <FooterLink href="/help#payments">Payments</FooterLink>
            <FooterLink href="/help#faq">FAQ</FooterLink>
          </FooterCol>
          <FooterCol title="Contact">
            <p className="flex items-start gap-2 text-white/75"><Phone className="mt-0.5 size-4 shrink-0" /> {s.phone}</p>
            <p className="flex items-start gap-2 text-white/75"><Mail className="mt-0.5 size-4 shrink-0" /> {s.email}</p>
            <p className="flex items-start gap-2 text-white/75"><MapPin className="mt-0.5 size-4 shrink-0" /> {s.address}</p>
            <p className="text-white/50">{s.hours}</p>
          </FooterCol>
        </div>

        {socials.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
            <span className="eyebrow mr-2 text-white/45">Follow us</span>
            {socials.map(({ key, label, href, color }) => (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
                className="grid size-11 place-items-center rounded-full bg-white/10 text-white transition duration-200 hover:-translate-y-1 hover:bg-[var(--c)] hover:shadow-[0_10px_20px_-8px_var(--c)]" style={{ "--c": color } as React.CSSProperties}>
                <SocialIcon name={key} className="size-5" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© <Year /> {s.name}. All prices in BDT (৳).</p>
          <div className="flex items-center gap-4">
            {s.dev_default && <span className="rounded-full bg-sun/20 px-3 py-1 text-xs font-semibold text-sun">Demo store details — set them in Admin → Settings</span>}
            <Streaks tone="light" className="h-4 w-8 opacity-50" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="eyebrow mb-4 text-white/45">{title}</h2>
      <div className="flex flex-col gap-2.5 text-[0.95rem]">{children}</div>
    </div>
  );
}
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-white/75 transition hover:text-white">{children}</Link>;
}
