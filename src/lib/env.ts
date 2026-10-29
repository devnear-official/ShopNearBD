import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  DATABASE_URL: z.string().min(10),
  GEMINI_API_KEY: z.string().min(10).optional(),
  APP_SECRET: z.string().min(32).optional(),
});

type Env = z.infer<typeof schema>;
let cached: Env | null = null;

/** Validated server environment. Throws a readable error listing what is missing. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment — ${issues}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function appSecret(): string {
  const s = env().APP_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set in production");
  return "dev-only-secret-change-me-0123456789abcdef";
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
