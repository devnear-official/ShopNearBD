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
