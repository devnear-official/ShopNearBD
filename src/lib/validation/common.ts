import { z } from "zod";

/** Normalises +8801…, 8801…, 01… and Bangla digits to 01XXXXXXXXX. */
export function normalizeBdPhone(input: string): string {
  const bn = "০১২৩৪৫৬৭৮৯";
  const ascii = input.replace(/[০-৯]/g, (d) => String(bn.indexOf(d))).replace(/[^\d+]/g, "");
  return ascii.replace(/^\+?880/, "0").replace(/^880/, "0");
}

export const bdPhone = z
  .string()
  .trim()
  .transform(normalizeBdPhone)
  .refine((v) => /^01[3-9]\d{8}$/.test(v), "Enter a valid Bangladeshi mobile number, e.g. 01712345678");

export const uuid = z.string().uuid();
export const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");
