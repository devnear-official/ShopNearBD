/** Swatch colours for common variant colour names; unknown names get a stable hue. */
const named: Record<string, string> = {
  black: "#1B2236", white: "#F3F6FB", midnight: "#20283D", "ice blue": "#B9DCFF", navy: "#1D3A8A", sunset: "#FF6A2B",
  ocean: "#1E6BFF", mint: "#10B981", graphite: "#374151", "electric blue": "#1E6BFF", carbon: "#2A3247", cloud: "#E8EEF8",
  peach: "#FFD9C2", charcoal: "#2A3247", snow: "#EEF2F8", violet: "#7C3AED", blue: "#1E6BFF", orange: "#FF7A1A",
  coral: "#FF8A65", red: "#EF4444", green: "#16A34A", silver: "#C7CED9", gold: "#D4A72C", pink: "#F472B6", grey: "#9CA3AF", gray: "#9CA3AF",
};
export function swatch(name: string): string {
  const k = name.trim().toLowerCase();
  if (named[k]) return named[k];
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 55%)`;
}
export const isLight = (hex: string) => {
  if (!hex.startsWith("#")) return false;
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 186;
};
