import type { SocialKey } from "@/lib/social";
import { WhatsAppIcon } from "./whatsapp-icon";

/** Simple brand marks (lucide has no brand icons). All use currentColor. */
export function SocialIcon({ name, className }: { name: SocialKey | "whatsapp"; className?: string }) {
  const p = { viewBox: "0 0 24 24", "aria-hidden": true, className } as const;
  switch (name) {
    case "whatsapp": return <WhatsAppIcon className={className} />;
    case "facebook": return <svg {...p} fill="currentColor"><path d="M13.5 21v-8h2.7l.5-3.2h-3.2V7.9c0-.9.4-1.7 1.8-1.7h1.5V3.4S15.5 3.2 14.3 3.2c-2.5 0-4.1 1.5-4.1 4.2v2.4H7.5V13h2.7v8z" /></svg>;
    case "instagram": return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>;
    case "youtube": return <svg {...p} fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" /></svg>;
    case "tiktok": return <svg {...p} fill="currentColor"><path d="M16.6 3c.3 2.2 1.6 3.6 3.8 3.8v3a7 7 0 0 1-3.7-1.1v6.2a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.7 2.4V3z" /></svg>;
    case "messenger": return <svg {...p} fill="currentColor"><path d="M12 2.5C6.7 2.5 2.5 6.5 2.5 11.5c0 2.8 1.3 5.3 3.4 6.9V22l3.1-1.7c.9.2 1.9.4 2.9.4 5.3 0 9.5-4 9.5-9s-4.2-9.2-9.4-9.2zm1 12.2-2.4-2.5-4.7 2.5 5.2-5.5 2.4 2.5 4.7-2.5z" /></svg>;
    case "telegram": return <svg {...p} fill="currentColor"><path d="M21.5 3.6 2.9 10.8c-1.3.5-1.3 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.3-2.3 4.7 3.5c.9.5 1.5.2 1.7-.8L22.4 5c.3-1.2-.5-1.8-.9-1.4zM8.8 13.4l9.1-5.7c.4-.3.8-.1.5.2l-7.5 6.8-.3 3.2z" /></svg>;
    case "x": return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l16 16M20 4 4 20" /></svg>;
    case "linkedin": return <svg {...p} fill="currentColor"><path d="M4 9h3.6v11H4zM5.8 3.5a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM10 9h3.4v1.5c.5-.9 1.7-1.8 3.5-1.8 3.7 0 4.1 2.4 4.1 5.5V20h-3.6v-5c0-1.2 0-2.7-1.7-2.7s-2 1.300-2 2.600V20H10z" /></svg>;
    case "pinterest": return <svg {...p} fill="currentColor"><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.900l1.200-5s-.3-.6-.3-1.500c0-1.400.8-2.400 1.800-2.400.9 0 1.300.6 1.300 1.400 0 .9-.5 2.100-.8 3.300-.2 1 .5 1.800 1.500 1.800 1.800 0 3.200-1.900 3.200-4.600 0-2.400-1.700-4.100-4.200-4.100-2.900 0-4.600 2.200-4.600 4.400 0 .9.300 1.800.8 2.300.1.100.1.200.1.300l-.3 1.200c0 .2-.2.2-.4.100-1.300-.6-2-2.500-2-4 0-3.300 2.400-6.300 6.900-6.300 3.600 0 6.400 2.600 6.400 6 0 3.600-2.300 6.500-5.400 6.500-1.100 0-2.100-.5-2.400-1.200l-.7 2.500c-.2.900-.9 2.100-1.300 2.800A10 10 0 1 0 12 2z" /></svg>;
  }
}
