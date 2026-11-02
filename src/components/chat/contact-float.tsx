"use client";
import { usePathname } from "next/navigation";
import { SocialIcon } from "@/components/ui/social-icon";
import { track } from "@/lib/tracking/client";

/**
 * WhatsApp and Messenger shortcuts, stacked directly above the "Ask ShopNear" launcher.
 * Links come from Admin → Settings; a button is only shown when its link is configured.
 * Hidden on checkout so nothing covers the order controls (the chat launcher hides there too).
 */
export function ContactFloat({ whatsapp, messenger }: { whatsapp: string | null; messenger: string | null }) {
  const onCheckout = usePathname().startsWith("/checkout");
  if (onCheckout || (!whatsapp && !messenger)) return null;
  const items = [
    messenger && { key: "messenger" as const, label: "Message us on Messenger", href: messenger, bg: "#0a7cff" },
    whatsapp && { key: "whatsapp" as const, label: "Chat on WhatsApp", href: whatsapp, bg: "#1fae54" },
  ].filter(Boolean) as { key: "messenger" | "whatsapp"; label: string; href: string; bg: string }[];
  return (
    <div
      className="fixed right-4 z-40 flex flex-col gap-3"
      // 3.5rem launcher + 0.75rem gap above it; --sticky-bar lifts everything above sticky purchase bars.
      style={{ bottom: "calc(1rem + 3.5rem + 0.75rem + env(safe-area-inset-bottom) + var(--sticky-bar, 0px))" }}
    >
      {items.map((it) => (
        <a
          key={it.key}
          href={it.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={it.label}
          onClick={() => track("Contact")}
          title={it.label}
          className="grid size-12 place-items-center rounded-full text-white shadow-[0_14px_30px_-12px_rgba(11,21,48,.6)] ring-2 ring-white transition hover:-translate-y-0.5 focus-visible:outline-offset-4 active:scale-95"
          style={{ background: it.bg }}
        >
          <SocialIcon name={it.key} className="size-6" />
        </a>
      ))}
    </div>
  );
}
