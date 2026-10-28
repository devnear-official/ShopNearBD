import clsx from "clsx";

/** The three speed streaks from the logo — ShopNear's signature mark. */
export function Streaks({ className, tone = "electric" }: { className?: string; tone?: "electric" | "light" | "tangerine" }) {
  const c = tone === "light" ? ["#ffffff", "#ffffffb0", "#ffffff70"] : tone === "tangerine" ? ["#FF7A1A", "#FF7A1Ab0", "#FF7A1A70"] : ["#1E6BFF", "#2FC6FF", "#7FDBFF"];
  return (
    <svg viewBox="0 0 64 32" aria-hidden className={clsx("shrink-0", className)}>
      <rect x="10" y="2" width="54" height="7" rx="3.5" fill={c[0]} />
      <rect x="0" y="12.5" width="46" height="7" rx="3.5" fill={c[1]} />
      <rect x="14" y="23" width="36" height="7" rx="3.5" fill={c[2]} />
    </svg>
  );
}

/** The swoosh under the wordmark, used as an underline/divider. */
export function Swoosh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden className={className}>
      <defs>
        <linearGradient id="swoosh" x1="0" x2="1">
          <stop offset="0" stopColor="#0F4FD6" />
          <stop offset=".6" stopColor="#2FC6FF" />
          <stop offset="1" stopColor="#1E6BFF" />
        </linearGradient>
      </defs>
      <path d="M2 38 C 120 6, 300 2, 398 14 C 300 12, 140 18, 2 38 Z" fill="url(#swoosh)" />
    </svg>
  );
}
