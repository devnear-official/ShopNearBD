/** Social networks the store can link to. Admin → Settings edits the URLs; the footer shows every one that is set. */
export const SOCIALS = [
  { key: "facebook", label: "Facebook", color: "#1877f2" },
  { key: "instagram", label: "Instagram", color: "#e4405f" },
  { key: "tiktok", label: "TikTok", color: "#111111" },
  { key: "youtube", label: "YouTube", color: "#ff0000" },
  { key: "messenger", label: "Messenger", color: "#0a7cff" },
  { key: "telegram", label: "Telegram", color: "#229ed9" },
  { key: "x", label: "X (Twitter)", color: "#111111" },
  { key: "linkedin", label: "LinkedIn", color: "#0a66c2" },
  { key: "pinterest", label: "Pinterest", color: "#e60023" },
] as const;
export type SocialKey = (typeof SOCIALS)[number]["key"];

/** The configured Messenger link, formatted to directly open the Messenger chat (m.me/username). */
export function messengerLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // If user entered just username (e.g. "shopnearbd" or "@shopnearbd")
  if (/^@?[a-zA-Z0-9._-]+$/.test(trimmed)) {
    const username = trimmed.replace(/^@/, "");
    return `https://m.me/${username}`;
  }

  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase();
    const ok = /^(m\.me|(www\.|m\.)?(facebook|messenger)\.com|fb\.me)$/i.test(host);
    if (!ok) return null;

    if (host === "m.me") return u.toString();

    // If it's facebook.com or messenger.com or fb.me, extract page username/slug to route to m.me
    const pathParts = u.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      if (pathParts[0] === "messages" && pathParts[1] === "t" && pathParts[2]) {
        return `https://m.me/${pathParts[2]}`;
      }
      if (pathParts[0] !== "profile.php" && pathParts[0] !== "messages" && pathParts[0] !== "p") {
        return `https://m.me/${pathParts[0]}`;
      }
    }

    return u.toString();
  } catch {
    return null;
  }
}
