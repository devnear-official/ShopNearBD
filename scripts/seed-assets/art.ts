/**
 * Stylised product renders for development seed data. Real stores replace these
 * with product photography uploaded through /admin/products.
 * Each function returns SVG markup for the object, drawn around (500, 620)
 * on a 1000 × 1250 canvas.
 */

export type Palette = { body: string; accent: string; dark?: string };

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

let gid = 0;
const lin = (c1: string, c2: string, angle = 90) => {
  const id = `g${gid++}`;
  const rad = (angle * Math.PI) / 180;
  const x2 = 0.5 + Math.cos(rad) / 2, y2 = 0.5 + Math.sin(rad) / 2;
  return {
    id,
    def: `<linearGradient id="${id}" x1="${1 - x2}" y1="${1 - y2}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`,
  };
};
const rad = (c1: string, c2: string, cx = 0.35, cy = 0.3) => {
  const id = `g${gid++}`;
  return { id, def: `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.85"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>` };
};

function wrap(defs: string[], body: string) {
  return { defs: defs.join(""), body };
}

const shadow = (cx: number, cy: number, rx: number, ry: number, o = 0.28) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#0B1530" opacity="${o}" filter="url(#blur)"/>`;

export const art: Record<string, (p: Palette) => { defs: string; body: string }> = {
  earphones({ body, accent }) {
    const b = rad(shade(body, 50), shade(body, -40));
    const plug = lin("#E8EEF7", "#9AA7BC", 0);
    return wrap([b.def, plug.def], `
      ${shadow(500, 1000, 300, 26)}
      <path d="M380 420 C 360 620, 520 640, 500 820 C 490 900, 520 940, 520 960" stroke="${shade(body, -20)}" stroke-width="16" fill="none" stroke-linecap="round"/>
      <path d="M640 440 C 680 640, 520 660, 500 820" stroke="${shade(body, -20)}" stroke-width="16" fill="none" stroke-linecap="round"/>
      <rect x="488" y="940" width="64" height="40" rx="10" fill="${shade(body, -30)}"/>
      <rect x="494" y="975" width="52" height="70" rx="14" fill="url(#${plug.id})"/>
      <rect x="510" y="1040" width="20" height="10" rx="4" fill="#5B6678"/>
      <g transform="rotate(-18 360 380)">
        <ellipse cx="360" cy="380" rx="92" ry="78" fill="url(#${b.id})"/>
        <ellipse cx="330" cy="355" rx="34" ry="22" fill="#fff" opacity=".35"/>
        <rect x="335" y="430" width="50" height="70" rx="22" fill="${shade(body, -25)}"/>
        <circle cx="400" cy="395" r="10" fill="${accent}"/>
      </g>
      <g transform="rotate(20 650 400)">
        <ellipse cx="650" cy="400" rx="92" ry="78" fill="url(#${b.id})"/>
        <ellipse cx="620" cy="375" rx="34" ry="22" fill="#fff" opacity=".35"/>
        <rect x="625" y="450" width="50" height="70" rx="22" fill="${shade(body, -25)}"/>
        <circle cx="690" cy="415" r="10" fill="${accent}"/>
      </g>`);
  },
  earbuds({ body, accent }) {
    const c = lin(shade(body, 40), shade(body, -35), 90);
    const lid = lin(shade(body, 55), shade(body, -10), 90);
    const bud = rad(shade(body, 60), shade(body, -30));
    return wrap([c.def, lid.def, bud.def], `
      ${shadow(500, 985, 270, 28)}
      <path d="M260 520 Q 260 450 330 450 L 670 450 Q 740 450 740 520 L 740 560 L 260 560 Z" fill="url(#${lid.id})"/>
      <rect x="250" y="560" width="500" height="380" rx="150" fill="url(#${c.id})"/>
      <path d="M300 600 Q 500 580 700 600" stroke="#fff" stroke-opacity=".35" stroke-width="10" fill="none" stroke-linecap="round"/>
      <rect x="470" y="880" width="60" height="8" rx="4" fill="${accent}"/>
      <ellipse cx="400" cy="560" rx="70" ry="22" fill="${shade(body, -60)}"/>
      <ellipse cx="600" cy="560" rx="70" ry="22" fill="${shade(body, -60)}"/>
      <g transform="rotate(-12 395 470)"><ellipse cx="395" cy="470" rx="62" ry="70" fill="url(#${bud.id})"/><rect x="372" y="490" width="44" height="90" rx="20" fill="${shade(body, -10)}"/><circle cx="420" cy="455" r="9" fill="${accent}"/></g>
      <g transform="rotate(12 605 470)"><ellipse cx="605" cy="470" rx="62" ry="70" fill="url(#${bud.id})"/><rect x="583" y="490" width="44" height="90" rx="20" fill="${shade(body, -10)}"/><circle cx="580" cy="455" r="9" fill="${accent}"/></g>`);
  },
  speaker({ body, accent }) {
    const c = lin(shade(body, 30), shade(body, -45), 0);
    let dots = "";
    for (let y = 520; y <= 860; y += 26) for (let x = 330; x <= 670; x += 26) dots += `<circle cx="${x}" cy="${y}" r="6" fill="${shade(body, -55)}"/>`;
    return wrap([c.def], `
      ${shadow(500, 1000, 260, 30)}
      <path d="M380 420 Q 380 330 500 330 Q 620 330 620 420" stroke="${accent}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <rect x="290" y="420" width="420" height="560" rx="120" fill="url(#${c.id})"/>
      <clipPath id="sp"><rect x="315" y="500" width="370" height="380" rx="60"/></clipPath>
      <g clip-path="url(#sp)">${dots}</g>
      <rect x="315" y="905" width="370" height="40" rx="20" fill="${shade(body, -35)}"/>
      <circle cx="430" cy="925" r="9" fill="#fff" opacity=".8"/><circle cx="500" cy="925" r="12" fill="${accent}"/><circle cx="570" cy="925" r="9" fill="#fff" opacity=".8"/>
      <rect x="320" y="440" width="40" height="500" rx="20" fill="#fff" opacity=".18"/>`);
  },
  watch({ body, accent }) {
    const strap = lin(shade(body, 25), shade(body, -40), 0);
    const caseG = lin("#E9EEF6", "#8F9BB0", 45);
    return wrap([strap.def, caseG.def], `
      ${shadow(500, 1040, 200, 22)}
      <rect x="395" y="230" width="210" height="300" rx="50" fill="url(#${strap.id})"/>
      <rect x="395" y="720" width="210" height="300" rx="50" fill="url(#${strap.id})"/>
      ${[300, 360, 420].map((y) => `<rect x="440" y="${y + 560}" width="120" height="12" rx="6" fill="${shade(body, -55)}"/>`).join("")}
      <rect x="330" y="420" width="340" height="400" rx="96" fill="url(#${caseG.id})"/>
      <rect x="352" y="442" width="296" height="356" rx="80" fill="#0A0F1E"/>
      <rect x="672" y="540" width="24" height="70" rx="10" fill="#9AA7BC"/>
      <circle cx="500" cy="620" r="105" fill="none" stroke="${accent}" stroke-width="16" stroke-dasharray="470 700" stroke-linecap="round" transform="rotate(-90 500 620)"/>
      <circle cx="500" cy="620" r="78" fill="none" stroke="#2FC6FF" stroke-width="14" stroke-dasharray="330 600" stroke-linecap="round" transform="rotate(-90 500 620)"/>
      <text x="500" y="636" text-anchor="middle" font-family="Arial" font-weight="700" font-size="54" fill="#fff">10:09</text>
      <path d="M375 470 Q 430 450 470 455" stroke="#fff" stroke-opacity=".3" stroke-width="10" fill="none" stroke-linecap="round"/>`);
  },
  band({ body, accent }) {
    const strap = lin(shade(body, 25), shade(body, -45), 0);
    return wrap([strap.def], `
      ${shadow(500, 1020, 230, 24)}
      <path d="M500 260 C 760 260, 820 980, 500 980 C 180 980, 240 260, 500 260 Z" fill="none" stroke="url(#${strap.id})" stroke-width="110"/>
      <rect x="400" y="470" width="200" height="330" rx="90" fill="#141B2E"/>
      <rect x="420" y="490" width="160" height="290" rx="76" fill="#05070D"/>
      <text x="500" y="610" text-anchor="middle" font-family="Arial" font-weight="700" font-size="44" fill="#fff">8,412</text>
      <text x="500" y="655" text-anchor="middle" font-family="Arial" font-size="24" fill="${accent}">steps</text>
      <path d="M455 700 l20 0 l12 -24 l16 44 l12 -20 l30 0" stroke="${accent}" stroke-width="6" fill="none" stroke-linejoin="round"/>`);
  },
  powerbank({ body, accent }) {
    const top = lin(shade(body, 45), shade(body, 5), 90);
    const side = lin(shade(body, -10), shade(body, -55), 90);
    return wrap([top.def, side.def], `
      ${shadow(520, 1010, 300, 30)}
      <path d="M290 380 L 640 300 L 760 380 L 410 470 Z" fill="url(#${top.id})"/>
      <path d="M290 380 L 410 470 L 410 990 L 290 900 Z" fill="${shade(body, -30)}"/>
      <path d="M410 470 L 760 380 L 760 900 L 410 990 Z" fill="url(#${side.id})"/>
      ${[0, 1, 2, 3].map((i) => `<circle cx="${480 + i * 38}" cy="${520 - i * 10}" r="9" fill="${i < 3 ? accent : "#ffffff55"}"/>`).join("")}
      <text x="585" y="740" text-anchor="middle" font-family="Arial" font-weight="800" font-size="64" fill="#fff" opacity=".9" transform="rotate(-14 585 740)">20000</text>
      <text x="585" y="790" text-anchor="middle" font-family="Arial" font-size="30" fill="#fff" opacity=".7" transform="rotate(-14 585 790)">mAh · 22.5W</text>
      <rect x="318" y="560" width="22" height="70" rx="8" fill="#0B1530" opacity=".55" transform="skewY(37)"/>`);
  },
  charger({ body, accent }) {
    const front = lin(shade(body, 30), shade(body, -25), 90);
    return wrap([front.def], `
      ${shadow(500, 1000, 240, 26)}
      <rect x="440" y="280" width="34" height="140" rx="16" fill="#B8C2D3"/><rect x="526" y="280" width="34" height="140" rx="16" fill="#B8C2D3"/>
      <rect x="320" y="400" width="360" height="560" rx="80" fill="url(#${front.id})"/>
      <rect x="345" y="425" width="60" height="500" rx="30" fill="#fff" opacity=".22"/>
      <rect x="440" y="700" width="120" height="34" rx="17" fill="#0B1530" opacity=".75"/>
      <rect x="440" y="760" width="120" height="34" rx="17" fill="#0B1530" opacity=".75"/>
      <rect x="455" y="820" width="90" height="46" rx="8" fill="#0B1530" opacity=".75"/>
      <text x="500" y="610" text-anchor="middle" font-family="Arial" font-weight="800" font-size="88" fill="${accent}">65W</text>
      <text x="500" y="655" text-anchor="middle" font-family="Arial" font-size="30" fill="${shade(body, -90)}">GaN</text>`);
  },
  cable({ body, accent }) {
    return wrap([], `
      ${shadow(500, 1010, 280, 24)}
      <g fill="none" stroke-linecap="round">
        <ellipse cx="500" cy="640" rx="240" ry="200" stroke="${shade(body, -30)}" stroke-width="40"/>
        <ellipse cx="500" cy="640" rx="240" ry="200" stroke="${body}" stroke-width="40" stroke-dasharray="14 10"/>
        <ellipse cx="500" cy="630" rx="180" ry="150" stroke="${shade(body, -30)}" stroke-width="40"/>
        <ellipse cx="500" cy="630" rx="180" ry="150" stroke="${body}" stroke-width="40" stroke-dasharray="14 10"/>
        <path d="M720 700 C 800 780, 760 900, 680 930" stroke="${body}" stroke-width="40"/>
        <path d="M300 560 C 230 460, 260 360, 340 320" stroke="${body}" stroke-width="40"/>
      </g>
      <rect x="320" y="240" width="70" height="110" rx="22" fill="${accent}" transform="rotate(30 355 295)"/>
      <rect x="338" y="200" width="36" height="60" rx="10" fill="#C9D2DF" transform="rotate(30 355 295)"/>
      <rect x="640" y="900" width="110" height="70" rx="22" fill="${accent}" transform="rotate(-20 695 935)"/>
      <rect x="740" y="915" width="56" height="40" rx="10" fill="#C9D2DF" transform="rotate(-20 695 935)"/>`);
  },
  fan({ body, accent }) {
    const ring = lin(shade(body, 40), shade(body, -30), 45);
    const blades = [0, 72, 144, 216, 288].map((a) => `<path d="M500 560 C 540 480, 610 450, 640 490 C 650 530, 580 560, 500 560 Z" fill="${accent}" opacity=".9" transform="rotate(${a} 500 560)"/>`).join("");
    let grill = "";
    for (let a = 0; a < 360; a += 15) grill += `<line x1="500" y1="560" x2="${500 + 230 * Math.cos((a * Math.PI) / 180)}" y2="${560 + 230 * Math.sin((a * Math.PI) / 180)}" stroke="${shade(body, -30)}" stroke-width="4" opacity=".55"/>`;
    return wrap([ring.def], `
      ${shadow(500, 1030, 230, 26)}
      <rect x="470" y="780" width="60" height="180" rx="20" fill="${shade(body, -15)}"/>
      <ellipse cx="500" cy="985" rx="190" ry="44" fill="url(#${ring.id})"/>
      <circle cx="500" cy="560" r="250" fill="url(#${ring.id})"/>
      <circle cx="500" cy="560" r="225" fill="#EAF4FF"/>
      ${blades}
      ${grill}
      <circle cx="500" cy="560" r="160" fill="none" stroke="${shade(body, -30)}" stroke-width="5" opacity=".6"/>
      <circle cx="500" cy="560" r="56" fill="url(#${ring.id})"/>
      <circle cx="500" cy="560" r="20" fill="${accent}"/>`);
  },
  kettle({ body, accent }) {
    const k = lin(shade(body, 45), shade(body, -45), 0);
    return wrap([k.def], `
      ${shadow(500, 1010, 270, 28)}
      <ellipse cx="500" cy="960" rx="250" ry="46" fill="${shade(body, -60)}"/>
      <path d="M330 420 L 670 420 L 720 930 L 280 930 Z" fill="url(#${k.id})"/>
      <path d="M330 420 Q 500 360 670 420" fill="${shade(body, 30)}"/>
      <rect x="455" y="360" width="90" height="40" rx="18" fill="${shade(body, -40)}"/>
      <path d="M690 470 C 830 480, 840 820, 715 840" stroke="${shade(body, -40)}" stroke-width="56" fill="none" stroke-linecap="round"/>
      <path d="M330 470 L 220 400 L 250 380 L 340 430 Z" fill="${shade(body, 10)}"/>
      <rect x="350" y="560" width="40" height="300" rx="20" fill="#fff" opacity=".28"/>
      <rect x="470" y="700" width="60" height="160" rx="18" fill="#0B1530" opacity=".25"/>
      <circle cx="500" cy="840" r="12" fill="${accent}"/>`);
  },
  lamp({ body, accent }) {
    const a = lin(shade(body, 30), shade(body, -40), 0);
    return wrap([a.def], `
      ${shadow(470, 1010, 230, 26)}
      <path d="M420 300 L 700 300 L 760 420 L 370 420 Z" fill="url(#${a.id})" transform="rotate(14 560 360)"/>
      <path d="M380 440 L 760 440 L 860 980 L 300 980 Z" fill="${accent}" opacity=".18" transform="rotate(14 560 360)"/>
      <ellipse cx="575" cy="438" rx="180" ry="20" fill="#FFF7D6" transform="rotate(14 560 360)"/>
      <path d="M470 360 L 330 620 L 470 930" stroke="${shade(body, -20)}" stroke-width="34" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="330" cy="620" r="30" fill="${accent}"/>
      <ellipse cx="470" cy="960" rx="190" ry="40" fill="url(#${a.id})"/>`);
  },
  backpack({ body, accent }) {
    const b = lin(shade(body, 35), shade(body, -45), 0);
    return wrap([b.def], `
      ${shadow(500, 1030, 280, 30)}
      <path d="M420 300 Q 420 230 500 230 Q 580 230 580 300" stroke="${shade(body, -40)}" stroke-width="34" fill="none"/>
      <rect x="270" y="290" width="460" height="720" rx="150" fill="url(#${b.id})"/>
      <rect x="320" y="620" width="360" height="330" rx="90" fill="${shade(body, -25)}"/>
      <path d="M330 690 Q 500 650 670 690" stroke="${accent}" stroke-width="12" fill="none" stroke-linecap="round"/>
      <rect x="470" y="660" width="60" height="26" rx="10" fill="${accent}"/>
      <rect x="300" y="340" width="40" height="560" rx="20" fill="#fff" opacity=".14"/>
      <path d="M340 420 Q 500 380 660 420" stroke="#0B1530" stroke-opacity=".25" stroke-width="8" fill="none" stroke-dasharray="20 12"/>`);
  },
  sling({ body, accent }) {
    const b = lin(shade(body, 35), shade(body, -45), 45);
    return wrap([b.def], `
      ${shadow(500, 1000, 290, 26)}
      <path d="M260 720 C 200 360, 800 300, 760 620" stroke="${shade(body, -35)}" stroke-width="44" fill="none" stroke-linecap="round"/>
      <path d="M240 640 Q 500 520 780 640 Q 800 900 520 940 Q 230 920 240 640 Z" fill="url(#${b.id})"/>
      <path d="M280 680 Q 500 600 740 680" stroke="${accent}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <rect x="610" y="650" width="44" height="30" rx="10" fill="${accent}"/>
      <path d="M300 760 Q 500 720 700 760" stroke="#fff" stroke-opacity=".2" stroke-width="14" fill="none" stroke-linecap="round"/>`);
  },
  bottle({ body, accent }) {
    const b = lin(shade(body, 50), shade(body, -45), 0);
    return wrap([b.def], `
      ${shadow(500, 1035, 170, 22)}
      <rect x="410" y="210" width="180" height="120" rx="36" fill="${shade(accent, -10)}"/>
      <path d="M440 300 Q 400 300 400 360 L 360 450 Q 340 480 340 540 L 340 960 Q 340 1010 400 1010 L 600 1010 Q 660 1010 660 960 L 660 540 Q 660 480 640 450 L 600 360 Q 600 300 560 300 Z" fill="url(#${b.id})"/>
      <rect x="375" y="520" width="38" height="430" rx="19" fill="#fff" opacity=".28"/>
      <text x="500" y="760" text-anchor="middle" font-family="Arial" font-weight="800" font-size="56" fill="#fff" opacity=".85" transform="rotate(-90 500 760)">750ml</text>`);
  },
  neckfan({ body, accent }) {
    const b = lin(shade(body, 40), shade(body, -35), 90);
    let vents = "";
    for (let i = 0; i < 6; i++) vents += `<rect x="${296 + i * 22}" y="720" width="10" height="120" rx="5" fill="${shade(body, -50)}"/><rect x="${592 + i * 22}" y="720" width="10" height="120" rx="5" fill="${shade(body, -50)}"/>`;
    return wrap([b.def], `
      ${shadow(500, 1010, 300, 26)}
      <path d="M300 900 L 300 560 C 300 300, 700 300, 700 560 L 700 900" stroke="url(#${b.id})" stroke-width="150" fill="none" stroke-linecap="round"/>
      ${vents}
      <circle cx="700" cy="620" r="16" fill="${accent}"/>
      <path d="M260 560 C 260 360, 420 320, 500 320" stroke="#fff" stroke-opacity=".3" stroke-width="16" fill="none" stroke-linecap="round"/>`);
  },
};

export function scene(kind: string, palette: Palette, bg: [string, string], opts: { angle?: number; scale?: number; badge?: string; glow?: number } = {}) {
  gid = 0;
  const a = art[kind](palette);
  const bgG = lin(bg[0], bg[1], 120);
  const { angle = 0, scale = 1, badge, glow = 0.65 } = opts;
  const t = `translate(500 640) rotate(${angle}) scale(${scale}) translate(-500 -640)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250">
  <defs>${bgG.def}${a.defs}<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
  <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="${glow}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="1000" height="1250" fill="url(#${bgG.id})"/>
  <circle cx="500" cy="600" r="470" fill="url(#glow)"/>
  ${[0, 1, 2].map((i) => `<rect x="${-80 + i * 40}" y="${180 + i * 70}" width="${300 - i * 60}" height="18" rx="9" fill="#fff" opacity="${0.35 - i * 0.08}"/>`).join("")}
  <g transform="${t}">${a.body}</g>
  ${badge ? `<g><rect x="60" y="1110" width="${badge.length * 22 + 60}" height="70" rx="35" fill="#0B1530"/><text x="90" y="1156" font-family="Arial" font-weight="700" font-size="34" fill="#fff">${badge.replace(/&/g, "&amp;")}</text></g>` : ""}
</svg>`;
}
