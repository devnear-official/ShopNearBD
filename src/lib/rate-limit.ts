import "server-only";
import { headers } from "next/headers";
import { system } from "./db";
import { ipHash } from "./tokens";

/**
 * Fixed-window rate limit stored in Postgres, so it holds across every
 * serverless instance (an in-memory counter would not).
 */
export async function rateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const [row] = await system((tx) => tx<{ ok: boolean }[]>`select public.rate_limit_hit(${bucket}, ${windowSeconds}, ${max}) as ok`);
    return row.ok;
  } catch {
    // Fail open on infrastructure errors; other protections (idempotency, stock locks) still apply.
    return true;
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "0.0.0.0").trim();
}

export async function clientIpHash() {
  return ipHash(await clientIp());
}
