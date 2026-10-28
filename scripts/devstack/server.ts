/**
 * DEV ONLY — a tiny stand-in for Supabase Auth (GoTrue) and Storage, backed by a
 * local Postgres, for environments where `supabase start` (Docker) is not
 * available. It implements only the endpoints this app uses. Never deploy it.
 *
 *   npm run devstack            # listens on :54321, prints anon / service keys
 *
 * Use with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import postgres from "postgres";
import { loadEnv } from "../env";

loadEnv();
const PORT = Number(process.env.DEVSTACK_PORT ?? 54321);
const SECRET = new TextEncoder().encode(process.env.DEVSTACK_JWT_SECRET ?? "devstack-jwt-secret-not-for-production-000000");
const STORAGE_DIR = path.resolve(".devstack/storage");
const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false, onnotice: () => {} });

const sign = (claims: Record<string, unknown>, ttl: string) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setIssuer("devstack").setExpirationTime(ttl).sign(SECRET);

export async function devKeys() {
  return {
    anon: await sign({ role: "anon" }, "10y"),
    service: await sign({ role: "service_role" }, "10y"),
  };
}

type Json = Record<string, unknown>;
const send = (res: http.ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const err = (res: http.ServerResponse, status: number, code: string, msg: string) =>
  send(res, status, { code: status, error_code: code, msg, error: code, error_description: msg });

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

type UserRow = { id: string; email: string; encrypted_password: string; email_confirmed_at: Date | null; raw_app_meta_data: Json; raw_user_meta_data: Json; created_at: Date; updated_at: Date; last_sign_in_at: Date | null };
const userJson = (u: UserRow) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
  email_confirmed_at: u.email_confirmed_at, confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at,
  app_metadata: { provider: "email", providers: ["email"], ...u.raw_app_meta_data }, user_metadata: u.raw_user_meta_data,
  identities: [], created_at: u.created_at, updated_at: u.updated_at, is_anonymous: false,
});

async function session(u: UserRow) {
  const refresh = crypto.randomBytes(24).toString("base64url");
  await sql`insert into auth.refresh_tokens (token, user_id) values (${refresh}, ${u.id})`;
  await sql`update auth.users set last_sign_in_at = now() where id = ${u.id}`;
  const expiresIn = 3600;
  const access = await sign({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", session_id: crypto.randomUUID() }, `${expiresIn}s`);
  return { access_token: access, token_type: "bearer", expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn, refresh_token: refresh, user: userJson(u) };
}

async function bearer(req: http.IncomingMessage) {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as Json;
  } catch {
    return null;
  }
}

async function auth(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const p = url.pathname.replace(/^\/auth\/v1/, "");
  const body = req.method === "GET" ? {} : (JSON.parse((await readBody(req)).toString() || "{}") as Json);

  if (p === "/settings") return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
  if (p === "/health") return send(res, 200, { name: "devstack-auth" });

  if (p === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const [u] = await sql<UserRow[]>`select * from auth.users where lower(email) = lower(${String(body.email ?? "")})`;
      if (!u || !u.encrypted_password || !(await bcrypt.compare(String(body.password ?? ""), u.encrypted_password))) {
        return err(res, 400, "invalid_credentials", "Invalid login credentials");
      }
      return send(res, 200, await session(u));
    }
    if (grant === "refresh_token") {
      const [t] = await sql<{ user_id: string }[]>`update auth.refresh_tokens set revoked = true where token = ${String(body.refresh_token ?? "")} and not revoked returning user_id`;
      if (!t) return err(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      const [u] = await sql<UserRow[]>`select * from auth.users where id = ${t.user_id}`;
      return send(res, 200, await session(u));
    }
    return err(res, 400, "unsupported_grant_type", "unsupported grant");
  }

  if (p === "/signup" && req.method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    const password = String(body.password ?? "");
    if (password.length < 8) return err(res, 422, "weak_password", "Password should be at least 8 characters");
    const exists = await sql`select 1 from auth.users where lower(email) = ${email}`;
    if (exists.length) return err(res, 422, "user_already_exists", "User already registered");
    const [u] = await sql<UserRow[]>`insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
      values (${email}, ${await bcrypt.hash(password, 10)}, now(), ${sql.json(((body.data ?? {}) as Json) as never)}) returning *`;
    return send(res, 200, await session(u));
  }

  if (p === "/user") {
    const claims = await bearer(req);
    if (!claims?.sub) return err(res, 401, "bad_jwt", "invalid JWT");
    if (req.method === "PUT") {
      if (body.password) {
        if (String(body.password).length < 8) return err(res, 422, "weak_password", "Password should be at least 8 characters");
        await sql`update auth.users set encrypted_password = ${await bcrypt.hash(String(body.password), 10)}, updated_at = now() where id = ${String(claims.sub)}`;
      }
    }
    const [u] = await sql<UserRow[]>`select * from auth.users where id = ${String(claims.sub)}`;
    if (!u) return err(res, 404, "user_not_found", "User not found");
    return send(res, 200, userJson(u));
  }

  if (p === "/logout") {
    const claims = await bearer(req);
    if (claims?.sub) await sql`update auth.refresh_tokens set revoked = true where user_id = ${String(claims.sub)}`;
    return send(res, 204);
  }

  if (p === "/recover") {
    console.log(`[devstack] password recovery requested for ${body.email} (no email sent in dev)`);
    return send(res, 200, {});
  }

  if (p.startsWith("/admin/users")) {
    const claims = await bearer(req);
    if (claims?.role !== "service_role") return err(res, 403, "not_admin", "User not allowed");
    const id = p.split("/")[3];
    if (req.method === "GET" && !id) {
      const users = await sql<UserRow[]>`select * from auth.users order by created_at limit 1000`;
      return send(res, 200, { users: users.map(userJson), aud: "authenticated" });
    }
    if (req.method === "POST") {
      const email = String(body.email ?? "").toLowerCase();
      const exists = await sql`select 1 from auth.users where lower(email) = ${email}`;
      if (exists.length) return err(res, 422, "email_exists", "A user with this email address has already been registered");
      const [u] = await sql<UserRow[]>`insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
        values (${email}, ${body.password ? await bcrypt.hash(String(body.password), 10) : null}, ${body.email_confirm ? new Date() : null},
        ${sql.json(((body.user_metadata ?? {}) as Json) as never)}) returning *`;
      return send(res, 200, userJson(u));
    }
    if (req.method === "PUT" && id) {
      if (body.password) await sql`update auth.users set encrypted_password = ${await bcrypt.hash(String(body.password), 10)}, updated_at = now() where id = ${id}`;
      const [u] = await sql<UserRow[]>`select * from auth.users where id = ${id}`;
      return u ? send(res, 200, userJson(u)) : err(res, 404, "user_not_found", "User not found");
    }
  }
  return err(res, 404, "not_found", `devstack: ${req.method} ${p} not implemented`);
}

async function storage(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ""));
  const m = /^\/object\/(public\/|sign\/|authenticated\/)?([^/]+)\/?(.*)$/.exec(p);
  if (!m) return err(res, 404, "not_found", "unknown storage path");
  const [, kind, bucket, objectPath] = m;
  const [b] = await sql<{ id: string; public: boolean }[]>`select id, public from storage.buckets where id = ${bucket}`;
  if (!b) return err(res, 404, "Bucket not found", "Bucket not found");
  const file = path.join(STORAGE_DIR, bucket, objectPath);
  if (!file.startsWith(path.join(STORAGE_DIR, bucket))) return err(res, 400, "invalid", "bad path");

  const serve = () => {
    if (!fs.existsSync(file)) return err(res, 404, "not_found", "Object not found");
    const meta = fs.existsSync(`${file}.meta.json`) ? JSON.parse(fs.readFileSync(`${file}.meta.json`, "utf8")) : {};
    res.writeHead(200, { "content-type": meta.contentType ?? "application/octet-stream", "cache-control": "public, max-age=3600" });
    fs.createReadStream(file).pipe(res);
  };

  if (req.method === "GET" && kind === "public/") return b.public ? serve() : err(res, 400, "not_public", "Bucket is not public");
  if (req.method === "GET" && kind === "sign/") {
    try {
      const { payload } = await jwtVerify(url.searchParams.get("token") ?? "", SECRET);
      if (payload.url !== `${bucket}/${objectPath}`) throw new Error("mismatch");
      return serve();
    } catch {
      return err(res, 400, "InvalidSignature", "invalid signature");
    }
  }

  const claims = await bearer(req);
  if (claims?.role !== "service_role") return err(res, 403, "Unauthorized", "new row violates row-level security policy");

  if (req.method === "POST" && kind === "sign/") {
    const body = JSON.parse((await readBody(req)).toString() || "{}") as { expiresIn?: number };
    const token = await sign({ url: `${bucket}/${objectPath}` }, `${body.expiresIn ?? 60}s`);
    return send(res, 200, { signedURL: `/object/sign/${bucket}/${objectPath}?token=${token}` });
  }
  if ((req.method === "POST" || req.method === "PUT") && !kind) {
    const data = await readBody(req);
    if (fs.existsSync(file) && req.headers["x-upsert"] !== "true" && req.method === "POST") return err(res, 400, "Duplicate", "The resource already exists");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    fs.writeFileSync(`${file}.meta.json`, JSON.stringify({ contentType: req.headers["content-type"] ?? "application/octet-stream" }));
    return send(res, 200, { Key: `${bucket}/${objectPath}`, Id: crypto.randomUUID() });
  }
  if (req.method === "DELETE" && !kind) {
    const body = JSON.parse((await readBody(req)).toString() || "{}") as { prefixes?: string[] };
    for (const pre of body.prefixes ?? []) {
      const f = path.join(STORAGE_DIR, bucket, pre);
      if (f.startsWith(path.join(STORAGE_DIR, bucket))) fs.rmSync(f, { force: true }), fs.rmSync(`${f}.meta.json`, { force: true });
    }
    return send(res, 200, (body.prefixes ?? []).map((name) => ({ name })));
  }
  return err(res, 404, "not_found", "unsupported storage operation");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" });
      return res.end();
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await storage(req, res, url);
    return err(res, 404, "not_found", "devstack");
  } catch (e) {
    console.error(e);
    return err(res, 500, "internal", (e as Error).message);
  }
});

if (process.argv[1]?.endsWith("server.ts")) {
  server.listen(PORT, "127.0.0.1", async () => {
    const k = await devKeys();
    console.log(`[devstack] auth+storage on http://127.0.0.1:${PORT}`);
    console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${k.anon}`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY=${k.service}`);
  });
}
