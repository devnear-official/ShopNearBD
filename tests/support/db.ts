import postgres from "postgres";

export const TEST_DB = process.env.DATABASE_URL!;
export const sql = postgres(TEST_DB, { max: 4, prepare: false, onnotice: () => {}, types: { numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) } } });

type Tx = postgres.TransactionSql<Record<string, never>>;
export const asRole = <T>(role: "anon" | "authenticated", claims: Record<string, unknown>, fn: (tx: Tx) => Promise<T>) =>
  sql.begin(async (tx) => {
    await tx.unsafe(`set local role ${role}`);
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role, ...claims })}, true)`;
    return fn(tx as unknown as Tx);
  }) as Promise<T>;

export async function variantBySku(sku: string) {
  const [v] = await sql<{ id: string; stock: number; product_id: string }[]>`select id, stock, product_id from public.product_variants where sku = ${sku}`;
  return v;
}

export async function makeUser(email: string, admin = false) {
  const [u] = await sql<{ id: string }[]>`insert into auth.users (email, email_confirmed_at) values (${email}, now()) on conflict (email) do update set email = excluded.email returning id`;
  if (admin) await sql`insert into public.user_roles (user_id, role) values (${u.id}, 'admin') on conflict do nothing`;
  return { id: u.id, email };
}

let n = 0;
export function orderPayload(items: { variant_id: string; quantity: number }[], over: Record<string, unknown> = {}) {
  n++;
  return {
    idempotency_key: `test-${Date.now()}-${n}-${Math.random().toString(36).slice(2)}`,
    access_token_hash: "a".repeat(64),
    customer: { name: "Test Customer", phone: "01712345678", address: "House 1, Road 2, Dhanmondi", district: "Dhaka", zone: "inside_dhaka" },
    items,
    payment: { method: "cod" },
    ...over,
  };
}
