import { createHash } from "node:crypto";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/** Bangladesh mobile → country-code digits, e.g. 01712345678 → 8801712345678. */
export function bdE164Digits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "").replace(/^0*880/, "0");
  return /^01[3-9]\d{8}$/.test(d) ? `88${d}` : null;
}

/** Normalised + SHA-256 hashed customer identifiers in the formats each platform documents. */
export function hashedIdentity(input: { phone?: string | null; email?: string | null; name?: string | null; district?: string | null }) {
  const ph = bdE164Digits(input.phone);
  const em = input.email?.trim().toLowerCase() || null;
  const parts = (input.name ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const city = (input.district ?? "").toLowerCase().replace(/[^a-z]/g, "") || null;
  return {
    meta: {
      ph: ph ? [sha(ph)] : undefined,
      em: em ? [sha(em)] : undefined,
      fn: parts[0] ? [sha(parts[0])] : undefined,
      ln: parts.length > 1 ? [sha(parts[parts.length - 1])] : undefined,
      ct: city ? [sha(city)] : undefined,
      country: [sha("bd")],
      external_id: ph ? [sha(ph)] : undefined,
    },
    tiktok: {
      phone: ph ? sha(`+${ph}`) : undefined,
      email: em ? sha(em) : undefined,
      external_id: ph ? sha(ph) : undefined,
    },
  };
}
