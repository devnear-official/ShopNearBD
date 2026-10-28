import "server-only";
import postgres, { type TransactionSql } from "postgres";
import { env } from "./env";

/**
 * Postgres access for server code.
 *
 * Every request-facing query runs inside a transaction that switches to the
 * Supabase API role (`anon` or `authenticated`) and sets the JWT claims, so Row
 * Level Security applies exactly as it would through the Supabase REST API.
 * `system()` keeps the connection's own role and is reserved for trusted
 * background work (webhooks, rate limits, chat bookkeeping).
 *
 * On Vercel, point DATABASE_URL at the Supabase transaction pooler (port 6543);
 * prepared statements are disabled for pooler compatibility.
 */
type Sql = postgres.Sql<Record<string, never>>;
const g = globalThis as unknown as { __snSql?: Sql };

function client(): Sql {
  if (!g.__snSql) {
    g.__snSql = postgres(env().DATABASE_URL, {
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => {},
      types: {
        // numeric(12,2) money values → JS numbers
        numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      },
    }) as unknown as Sql;
  }
  return g.__snSql;
}

export type Tx = TransactionSql<Record<string, never>>;
export type Claims = { sub: string; email?: string | null; role: "authenticated" };

export async function asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client().begin(async (tx) => {
    await tx.unsafe("set local role anon");
    await tx`select set_config('request.jwt.claims', '{"role":"anon"}', true)`;
    return fn(tx as Tx);
  }) as Promise<T>;
}

export async function asUser<T>(claims: Claims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client().begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    return fn(tx as Tx);
  }) as Promise<T>;
}

export async function system<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client().begin((tx) => fn(tx as Tx)) as Promise<T>;
}

export function sql(): Sql {
  return client();
}
