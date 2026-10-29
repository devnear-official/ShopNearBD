/** Stand-in for the Meta Graph API and TikTok Events API (tests never call the real services). */
import http from "node:http";

export type AdRequest = { platform: "meta" | "tiktok"; url: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> };

export function startMockAds(): Promise<{ url: string; requests: AdRequest[]; failNext: (n?: number) => void; close: () => Promise<void> }> {
  const requests: AdRequest[] = [];
  let fail = 0;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    const platform = req.url?.startsWith("/open_api/") ? "tiktok" : "meta";
    requests.push({ platform, url: req.url ?? "", headers: req.headers, body });
    res.setHeader("content-type", "application/json");
    if (fail > 0) {
      fail--;
      res.statusCode = 400;
      return res.end(JSON.stringify(platform === "meta" ? { error: { message: "Invalid OAuth access token." } } : { code: 40001, message: "Access token invalid" }));
    }
    res.end(JSON.stringify(platform === "meta" ? { events_received: (body.data as unknown[])?.length ?? 0, fbtrace_id: "mock" } : { code: 0, message: "OK", request_id: "mock" }));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const { port } = server.address() as { port: number };
    resolve({ url: `http://127.0.0.1:${port}`, requests, failNext: (n = 2) => { fail = n; }, close: () => new Promise((r) => server.close(() => r())) });
  }));
}

if (process.argv[1]?.endsWith("mock-ads.ts")) {
  startMockAds().then((m) => {
    console.log(`mock ads on ${m.url}`);
    setInterval(() => { while (m.requests.length) { const r = m.requests.shift()!; console.log(JSON.stringify({ platform: r.platform, url: r.url, body: r.body })); } }, 200);
  });
}
