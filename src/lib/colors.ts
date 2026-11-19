/** Preset colors for quick admin selection */
export const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#1B2236" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Brown", hex: "#795548" },
  { name: "Navy", hex: "#1D3A8A" },
  { name: "Blue", hex: "#1E6BFF" },
  { name: "Red", hex: "#EF4444" },
  { name: "Green", hex: "#16A34A" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Orange", hex: "#FF7A1A" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Gray", hex: "#6B7280" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Maroon", hex: "#800000" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Olive", hex: "#65A30D" },
];

/** Swatch colours for common variant colour names in English & Bengali; unknown names get a stable hue. */
const named: Record<string, string> = {
  // Dark & Black tones
  black: "#1B2236", "jet black": "#0A0A0A", "matte black": "#18181B", midnight: "#20283D",
  graphite: "#374151", carbon: "#2A3247", charcoal: "#2A3247", obsidian: "#1E232A",
  // White & Light tones
  white: "#FFFFFF", "pure white": "#FFFFFF", "off white": "#FAF9F6", snow: "#EEF2F8",
  cloud: "#E8EEF8", cream: "#FFFDD0", ivory: "#FFFFF0",
  // Brown & Warm Earth tones
  brown: "#795548", "dark brown": "#4E342E", "light brown": "#A1887F", chocolate: "#5D4037",
  coffee: "#6F4E37", tan: "#D2B48C", caramel: "#C68A4C", khaki: "#C3B091", camel: "#C19A6B",
  beige: "#F5F5DC", nude: "#E3BC9A", sand: "#C2B280", mocha: "#4E3629", rust: "#B7410E",
  // Red & Wine tones
  red: "#EF4444", "dark red": "#991B1B", maroon: "#800000", burgundy: "#800020",
  wine: "#722F37", crimson: "#DC2626", ruby: "#E0115F", coral: "#FF8A65",
  // Blue tones
  blue: "#1E6BFF", navy: "#1D3A8A", "navy blue": "#1D3A8A", "dark blue": "#0F172A",
  "royal blue": "#2563EB", "sky blue": "#38BDF8", "light blue": "#7DD3FC", "ice blue": "#B9DCFF",
  "electric blue": "#1E6BFF", ocean: "#1E6BFF", indigo: "#4F46E5", cyan: "#06B6D4",
  teal: "#0D9488", turquoise: "#14B8A6",
  // Green tones
  green: "#16A34A", "dark green": "#14532D", "light green": "#86EFAC", mint: "#10B981",
  "mint green": "#10B981", olive: "#65A30D", "olive green": "#4D7C0F", lime: "#84CC16",
  emerald: "#059669", forest: "#166534", sage: "#9CA986", "sage green": "#9CA986",
  // Yellow & Orange tones
  yellow: "#EAB308", "mustard yellow": "#CA8A04", mustard: "#D97706", amber: "#D97706",
  gold: "#D4A72C", orange: "#FF7A1A", sunset: "#FF6A2B", peach: "#FFD9C2", apricot: "#FB923C",
  // Pink & Purple tones
  pink: "#F472B6", "rose pink": "#FB7185", "light pink": "#FBCFE8", "hot pink": "#EC4899",
  rose: "#F43F5E", violet: "#7C3AED", purple: "#8B5CF6", lavender: "#C4B5FD",
  magenta: "#D946EF", lilac: "#C8A2C8", plum: "#8E4585",
  // Gray & Metallic tones
  gray: "#9CA3AF", grey: "#9CA3AF", "dark gray": "#4B5563", "dark grey": "#4B5563",
  "light gray": "#E5E7EB", "light grey": "#E5E7EB", silver: "#C7CED9", bronze: "#CD7F32",
  copper: "#B87333", "space gray": "#4B5563",
  // Bengali color names
  "কালো": "#1B2236", "সাদা": "#FFFFFF", "লাল": "#EF4444", "নীল": "#1E6BFF",
  "সবুজ": "#16A34A", "হলুদ": "#EAB308", "বাদামী": "#795548", "বাদামি": "#795548",
  "গোলাপী": "#F472B6", "গোলাপি": "#F472B6", "কমলা": "#FF7A1A", "ধূসর": "#9CA3AF",
  "বেগুনি": "#8B5CF6", "খয়রি": "#6F4E37", "খয়েরি": "#6F4E37", "আকাশি": "#38BDF8",
};

// Sorted keys by length descending to match compound names like "dark brown" before "brown"
const sortedNamedKeys = Object.keys(named).sort((a, b) => b.length - a.length);

export function swatch(name: string): string {
  if (!name || typeof name !== "string") return "#1B2236";
  const str = name.trim();
  if (!str) return "#1B2236";

  // Direct hex code (#fff, #1b2236, etc.)
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(str)) return str;

  // Contains embedded hex code, e.g. "Brown (#795548)" or "Brown #795548"
  const hexMatch = str.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  if (hexMatch) return hexMatch[0];

  const k = str.toLowerCase();
  if (named[k]) return named[k];

  // Try substring matching: e.g. "Dark Brown Leather" contains "dark brown"
  for (const key of sortedNamedKeys) {
    if (k.includes(key)) return named[key];
  }

  // Fallback: deterministic HSL hue
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 55%)`;
}

export function resolveVariantColor(
  options: Record<string, string> | undefined,
  nameOrVal?: string,
  optionName?: string
): string {
  if (options) {
    if (optionName && options[`${optionName}Hex`]) return options[`${optionName}Hex`];
    if (options.ColorHex) return options.ColorHex;
    if (options.color_hex) return options.color_hex;
    if (options.colorHex) return options.colorHex;
    if (options.hex) return options.hex;

    if (optionName && options[optionName]) return swatch(options[optionName]);
    if (options.Color) return swatch(options.Color);
    if (options.color) return swatch(options.color);
    if (options.Colour) return swatch(options.Colour);
  }
  return swatch(nameOrVal || "");
}

export const isLight = (color: string) => {
  if (!color || typeof color !== "string") return false;
  if (color.startsWith("#")) {
    let h = color.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 6) {
      const n = parseInt(h, 16);
      if (!Number.isNaN(n)) {
        return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 186;
      }
    }
  }
  return false;
};
