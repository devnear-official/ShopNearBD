import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appSecret } from "./env";

export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Hash for storing an IP without keeping the raw address. */
export const ipHash = (ip: string) => createHmac("sha256", appSecret()).update(`ip:${ip}`).digest("hex").slice(0, 32);

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
