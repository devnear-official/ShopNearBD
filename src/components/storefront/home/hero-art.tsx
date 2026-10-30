import type { CSSProperties } from "react";
import { Gift, ShoppingCart } from "lucide-react";

/*
 * Hand-drawn vector scene for the hero: the cart, the things in it, and the shopping bag.
 * Everything is SVG/CSS (no bitmap), so it stays crisp at any size and weighs a few KB.
 * Motion lives in globals.css (.hero-*) and is switched off for reduced-motion users.
 */

/** The orange cart. Its wheels roll in on load, then idle; the goods hop one after another. */
export function CartArt({ className }: { className?: string }) {
  const slats = Array.from({ length: 9 }, (_, i) => i + 1);
  return (
    <svg viewBox="0 0 440 410" aria-hidden className={className}>
      <defs>
        <linearGradient id="ha-basket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb13b" /><stop offset=".55" stopColor="#ff8a1f" /><stop offset="1" stopColor="#f26a00" /></linearGradient>
        <linearGradient id="ha-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffc766" /><stop offset="1" stopColor="#ff9a2e" /></linearGradient>
        <linearGradient id="ha-pink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8d9c" /><stop offset="1" stopColor="#ee3d5e" /></linearGradient>
        <linearGradient id="ha-shoe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe8fb" /></linearGradient>
        <radialGradient id="ha-shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#0b1530" stopOpacity=".35" /><stop offset="1" stopColor="#0b1530" stopOpacity="0" /></radialGradient>
      </defs>

      <ellipse cx="230" cy="402" rx="190" ry="12" fill="url(#ha-shadow)" />

      {/* goods, drawn first so the basket hides their lower half */}
      <g className="hero-hop fb" style={{ "--hd": "1.5s" } as CSSProperties}>
        {/* headphones */}
        <path d="M110 160 C96 38 206 38 192 160" fill="none" stroke="#c8d1e6" strokeWidth="19" strokeLinecap="round" />
        <path d="M110 160 C96 38 206 38 192 160" fill="none" stroke="#fbfcff" strokeWidth="14" strokeLinecap="round" />
        <rect x="92" y="104" width="38" height="70" rx="19" fill="#fff" stroke="#cdd5e8" strokeWidth="2" />
        <rect x="172" y="104" width="38" height="70" rx="19" fill="#fff" stroke="#cdd5e8" strokeWidth="2" />
        <rect x="100" y="116" width="14" height="46" rx="7" fill="#e5eaf6" />
        <rect x="188" y="116" width="14" height="46" rx="7" fill="#e5eaf6" />
      </g>
      <g className="hero-hop fb" style={{ "--hd": "1.85s" } as CSSProperties}>
        {/* smartwatch */}
        <rect x="216" y="30" width="46" height="190" rx="12" fill="#222b43" />
        <rect x="204" y="78" width="70" height="86" rx="22" fill="#0e1322" stroke="#46526f" strokeWidth="4" />
        <rect x="210" y="84" width="58" height="74" rx="17" fill="#04060d" />
        <rect x="274" y="104" width="6" height="16" rx="3" fill="#46526f" />
        <g strokeLinecap="round">
          <circle cx="239" cy="121" r="22" fill="none" stroke="#1c2540" strokeWidth="2" />
          <circle cx="239" cy="99" r="2.4" fill="#ff4d6a" /><circle cx="261" cy="121" r="2.4" fill="#2fc6ff" />
          <circle cx="239" cy="143" r="2.4" fill="#ffb020" /><circle cx="217" cy="121" r="2.4" fill="#34d399" />
          <path d="M239 121 L239 106" stroke="#fff" strokeWidth="2.6" /><path d="M239 121 L252 127" stroke="#2fc6ff" strokeWidth="2.6" />
          <circle cx="239" cy="121" r="2.6" fill="#ff4d6a" />
        </g>
      </g>
      <g className="hero-hop fb" style={{ "--hd": "2.2s" } as CSSProperties}>
        {/* pink handbag */}
        <path d="M290 112 C290 58 342 58 342 112" fill="none" stroke="#e23556" strokeWidth="9" strokeLinecap="round" />
        <rect x="272" y="104" width="88" height="100" rx="16" fill="url(#ha-pink)" />
        <path d="M272 128 H360" stroke="#fff" strokeOpacity=".25" strokeWidth="3" />
        <circle cx="316" cy="132" r="6" fill="#ffd36e" />
      </g>
      <g className="hero-hop fb" style={{ "--hd": "2.55s" } as CSSProperties}>
        {/* sneaker */}
        <g transform="translate(336 96) rotate(-9)">
          <path d="M2 54 C2 28 18 14 34 14 L52 22 C66 30 80 30 94 38 C102 43 104 54 104 54 Z" fill="url(#ha-shoe)" stroke="#c5d2ee" strokeWidth="2" />
          <path d="M34 14 L52 22 C48 34 36 40 22 37 Z" fill="#2f6bff" />
          <path d="M22 50 C46 42 70 44 98 50" fill="none" stroke="#2f6bff" strokeWidth="5" strokeLinecap="round" />
          <path d="M56 28 l8 4 M64 24 l8 4" stroke="#9fb4e0" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="0" y="52" width="106" height="14" rx="7" fill="#fff" stroke="#c5d2ee" strokeWidth="2" />
        </g>
      </g>

      {/* basket */}
      <path d="M78 172 H394 L358 306 Q354 320 338 320 H134 Q118 320 114 306 Z" fill="url(#ha-basket)" />
      {slats.map((i) => {
        const top = 78 + i * (316 / 10), bottom = 114 + i * (244 / 10);
        return <path key={i} d={`M${top} 176 L${bottom} 316`} stroke="#d85a00" strokeOpacity=".42" strokeWidth="9" strokeLinecap="round" />;
      })}
      <path d="M92 240 H378" stroke="#d85a00" strokeOpacity=".42" strokeWidth="9" strokeLinecap="round" />
      <path d="M86 196 H388" stroke="#fff" strokeOpacity=".28" strokeWidth="4" strokeLinecap="round" />
      <rect x="62" y="146" width="344" height="32" rx="16" fill="url(#ha-rim)" />
      <rect x="70" y="150" width="328" height="6" rx="3" fill="#fff" fillOpacity=".5" />
      <path d="M70 160 L40 94 Q36 84 26 84 H8" fill="none" stroke="#c94f00" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 84 H30" fill="none" stroke="#ffd7a1" strokeWidth="13" strokeLinecap="round" />

      {/* chassis + wheels */}
      <path d="M136 322 L154 356 H322" fill="none" stroke="#1b2b55" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {[160, 322].map((cx) => (
        <g key={cx} transform={`translate(${cx} 372)`}>
          <circle r="29" fill="#14203f" />
          <g className="hero-wheel">
            <circle r="17" fill="#d3dbee" />
            <path d="M0 -15 V15 M-15 0 H15" stroke="#8a97b6" strokeWidth="3" strokeLinecap="round" />
            <circle r="5" fill="#8a97b6" />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Orange branded shopping bag. */
export function BagArt({ className, small }: { className?: string; small?: boolean }) {
  const id = small ? "b2" : "b1";
  return (
    <svg viewBox="0 0 210 250" aria-hidden className={className}>
      <defs>
        <linearGradient id={`ha-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={small ? "#ffc27a" : "#ffa631"} /><stop offset="1" stopColor={small ? "#ffa04a" : "#f06a00"} /></linearGradient>
      </defs>
      <path d="M62 56 C62 6 150 6 150 56" fill="none" stroke="#c75300" strokeWidth="7" strokeLinecap="round" />
      <path d="M22 52 L176 38 L196 226 Q197 236 187 238 L50 248 Q40 249 38 240 Z" fill={`url(#ha-${id})`} />
      <path d="M176 38 L196 226 Q197 236 187 238 L170 240 Z" fill="#000" fillOpacity=".12" />
      <path d="M22 52 L176 38" stroke="#fff" strokeOpacity=".4" strokeWidth="3" />
      <circle cx="58" cy="58" r="4" fill="#fff" fillOpacity=".7" /><circle cx="138" cy="50" r="4" fill="#fff" fillOpacity=".7" />
      {small ? (
        <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity=".92" transform="translate(52 100)"><path d="M0 0 H16 L28 54 H84 L96 20 H20" /><circle cx="36" cy="72" r="6" fill="#fff" /><circle cx="76" cy="72" r="6" fill="#fff" /></g>
      ) : (
        <g transform="rotate(-6 110 150)" fill="#fff">
          <text x="46" y="150" fontFamily="var(--font-bricolage), system-ui, sans-serif" fontWeight="800" fontSize="29" fontStyle="italic" letterSpacing="-1">ShopNear</text>
          <rect x="116" y="158" width="38" height="20" rx="6" fill="#fff" fillOpacity=".95" /><text x="121" y="173" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="14" fill="#f06a00">BD</text>
          <path d="M44 170 h56" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" /><path d="M44 178 h36" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
        </g>
      )}
    </svg>
  );
}

/** Cardboard parcel with a tape stripe and a printed cart. */
export function Parcel({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`relative block aspect-square rounded-[14%] bg-gradient-to-br from-[#e8b87a] to-[#c98f4f] shadow-[inset_0_-0.5rem_0_rgb(0_0_0/0.1),0_1rem_1.5rem_-0.8rem_rgb(11_21_48/0.5)] ${className ?? ""}`}>
      <span className="absolute inset-x-0 top-[38%] h-[14%] bg-[#f5dcb4]/70" />
      <ShoppingCart className="absolute left-[24%] top-[52%] size-[42%] text-white/70" strokeWidth={2.4} />
    </span>
  );
}

/** Gift box with a ribbon. */
export function GiftBox({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`relative block aspect-square rounded-[16%] bg-[repeating-linear-gradient(135deg,#ff4d6a_0_0.55rem,#fff_0.55rem_1.1rem)] shadow-[0_1rem_1.5rem_-0.8rem_rgb(11_21_48/0.6)] ${className ?? ""}`}>
      <span className="absolute -top-[14%] left-1/2 grid size-[46%] -translate-x-1/2 place-items-center rounded-full bg-[#ff4d6a] text-white"><Gift className="size-[60%]" /></span>
    </span>
  );
}
