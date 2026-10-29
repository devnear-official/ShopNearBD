import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { sql } from "../support/db";

const skip = process.env.NO_TEST_DB === "1";
const phone = "01555123456";

async function lastCode(p = phone) {
  const [row] = await sql<{ body: string }[]>`select body from public.dev_sms_outbox where phone = ${p} order by id desc limit 1`;
  return row?.body.match(/\b(\d{6})\b/)?.[1] ?? null;
}
async function reset(p = phone) {
  await sql`delete from public.customer_otps where phone = ${p}`;
  await sql`delete from public.rate_limits where bucket like ${"otp:%"}`;
}

beforeAll(() => { process.env.SMS_PROVIDER = "console"; });
afterEach(async () => { if (!skip) await reset(); });
afterAll(async () => { delete process.env.SMS_PROVIDER; await sql.end(); });

describe.skipIf(skip)("customer login with SMS code", () => {
  it("sends a code, rejects wrong ones, logs in once with the right one and links existing orders by phone", async () => {
    const { requestOtp, verifyOtp, ensureAccount } = await import("@/lib/customer/auth");
    await ensureAccount(phone, "Order Person");
    const [pre] = await sql<{ verified_at: Date | null; name: string }[]>`select verified_at, name from public.customer_accounts where phone = ${phone}`;
    expect(pre).toMatchObject({ verified_at: null, name: "Order Person" });

    expect(await requestOtp(phone, "ip-1", "ShopNear BD")).toEqual({ ok: true, resendIn: 60 });
    const code = await lastCode();
    expect(code).toMatch(/^\d{6}$/);
    // Only a hash is stored.
    const [otp] = await sql<{ code_hash: string }[]>`select code_hash from public.customer_otps where phone = ${phone} order by id desc limit 1`;
    expect(otp.code_hash).not.toContain(code!);

    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await verifyOtp(phone, wrong, "test");
    expect(bad).toMatchObject({ ok: false });
    if (!bad.ok) expect(bad.error).toMatch(/4 tries left/);

    const good = await verifyOtp(phone, code!, "test-agent");
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
      expect(good.account.verified_at).not.toBeNull();
      const [s] = await sql<{ n: number }[]>`select count(*)::int as n from public.customer_sessions where account_id = ${good.account.id}`;
      expect(s.n).toBeGreaterThan(0);
    }
    // A code works once.
    expect((await verifyOtp(phone, code!, "test")).ok).toBe(false);
    // The SMS log never contains the code or the full number.
    const logs = await sql<{ phone_masked: string; detail: string | null }[]>`select phone_masked, detail from public.sms_log order by id desc limit 1`;
    expect(logs[0].phone_masked).toBe("015*****456");
    expect(JSON.stringify(logs)).not.toContain(code!);
  });

  it("burns the code after 5 wrong guesses", async () => {
    const { requestOtp, verifyOtp } = await import("@/lib/customer/auth");
    await requestOtp(phone, "ip-2", "ShopNear BD");
    const code = (await lastCode())!;
    const wrong = code === "123123" ? "321321" : "123123";
    for (let i = 0; i < 5; i++) await verifyOtp(phone, wrong, null);
    expect(await verifyOtp(phone, code, null)).toMatchObject({ ok: false, error: expect.stringMatching(/expired|new one/) });
  });

  it("rejects expired codes and enforces the resend cooldown", async () => {
    const { requestOtp, verifyOtp } = await import("@/lib/customer/auth");
    await requestOtp(phone, "ip-3", "ShopNear BD");
    expect(await requestOtp(phone, "ip-3", "ShopNear BD")).toMatchObject({ ok: false, code: "COOLDOWN" });
    const code = (await lastCode())!;
    await sql`update public.customer_otps set expires_at = now() - interval '1 second' where phone = ${phone}`;
    expect(await verifyOtp(phone, code, null)).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
  });

  it("caps codes per phone per hour", async () => {
    const { requestOtp } = await import("@/lib/customer/auth");
    for (let i = 0; i < 5; i++) {
      await sql`update public.customer_otps set created_at = now() - interval '2 minutes' where phone = ${phone}`;
      expect((await requestOtp(phone, `ip-cap-${i}`, "ShopNear BD")).ok).toBe(true);
    }
    await sql`update public.customer_otps set created_at = now() - interval '2 minutes' where phone = ${phone}`;
    expect(await requestOtp(phone, "ip-cap-x", "ShopNear BD")).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
});

describe.skipIf(skip)("SMS gateways", () => {
  let server: http.Server;
  let url = "";
  const seen: { path: string; headers: http.IncomingHttpHeaders; body: string }[] = [];
  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      let body = "";
      for await (const c of req) body += c;
      seen.push({ path: req.url ?? "", headers: req.headers, body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/smsapi") return res.end(JSON.stringify(body.includes("senderid=BAD") ? { response_code: 1013, error_message: "Sender Id not found" } : { response_code: 202, success_message: "SMS Submitted Successfully" }));
      res.end(JSON.stringify({ status: "SUCCESS", status_code: 200, smsinfo: [{ sms_status: "SUCCESS", sms_id: "x1" }] }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("BulkSMSBD: form POST with api_key, senderid, 880 number; 202 = sent, other codes = failed", async () => {
    Object.assign(process.env, { SMS_PROVIDER: "bulksmsbd", BULKSMSBD_API_KEY: "k123", BULKSMSBD_SENDER_ID: "8809617000000", BULKSMSBD_BASE_URL: `${url}/api` });
    const { sendSms } = await import("@/lib/sms");
    expect(await sendSms("01712345678", "123456 is your code", "test")).toMatchObject({ ok: true, provider: "bulksmsbd" });
    const req = seen.at(-1)!;
    expect(req.path).toBe("/api/smsapi");
    const form = new URLSearchParams(req.body);
    expect(Object.fromEntries(form)).toEqual({ api_key: "k123", senderid: "8809617000000", number: "8801712345678", message: "123456 is your code" });
    process.env.BULKSMSBD_SENDER_ID = "BAD";
    expect(await sendSms("01712345678", "x", "test")).toMatchObject({ ok: false, detail: expect.stringContaining("1013") });
  });

  it("SSL Wireless: JSON POST to /api/v3/send-sms with api_token, sid, msisdn, csms_id", async () => {
    Object.assign(process.env, { SMS_PROVIDER: "sslwireless", SSL_SMS_API_TOKEN: "tok", SSL_SMS_SID: "SHOPNEAR", SSL_SMS_BASE_URL: url });
    const { sendSms } = await import("@/lib/sms");
    expect(await sendSms("01812345678", "hello", "test")).toMatchObject({ ok: true, provider: "sslwireless" });
    const req = seen.at(-1)!;
    expect(req.path).toBe("/api/v3/send-sms");
    expect(JSON.parse(req.body)).toMatchObject({ api_token: "tok", sid: "SHOPNEAR", msisdn: "8801812345678", sms: "hello", csms_id: expect.any(String) });
    process.env.SMS_PROVIDER = "console";
  });
});
