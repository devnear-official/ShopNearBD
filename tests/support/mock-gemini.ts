/**
 * Minimal stand-in for the Gemini REST API used in tests. It never calls Google.
 * - Echoes the product links it finds inside <store_data> so tests can assert grounding.
 * - Message containing "FAIL_AI" → HTTP 500, "SLOW_AI" → hangs past the timeout.
 */
import http from "node:http";

export function startMockGemini(port = 0): Promise<{ url: string; requests: unknown[]; close: () => Promise<void> }> {
  const requests: unknown[] = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    requests.push({ url: req.url, body, apiKey: req.headers["x-goog-api-key"] });
    const text: string = JSON.stringify(body.contents ?? []);
    if (text.includes("FAIL_AI")) { res.writeHead(500, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: { code: 500, message: "mock failure" } })); }
    if (text.includes("SLOW_AI")) return; // never answers
    if (text.includes("[search-intent]")) {
      // Image / voice search: answer with the JSON the app asked for.
      const media = (body.contents?.[0]?.parts ?? []).find((p: { inlineData?: { mimeType: string } }) => p.inlineData)?.inlineData?.mimeType as string | undefined;
      const out = media?.startsWith("image/") ? { transcript: "", description: "A white bladeless neck fan", queries: ["neck fan", "fan"] }
        : media?.startsWith("audio/") ? { transcript: "নেক ফ্যান", description: "", queries: ["neck fan"] }
        : { transcript: "", description: "", queries: text.includes("ইয়ারবাড") ? ["earbuds"] : ["fan"] };
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(out) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 } }));
    }
    const links = [...text.matchAll(/\\"url\\":\\"(\/shop\/[a-z0-9-]+)\\"/g)].map((m) => m[1]);
    const reply = links.length ? `Grounded answer. See [this product](${links[0]}).` : "Grounded answer without products.";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: reply }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 321, candidatesTokenCount: 12, totalTokenCount: 333 } }));
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => {
    const addr = server.address() as { port: number };
    resolve({ url: `http://127.0.0.1:${addr.port}`, requests, close: () => new Promise((r) => server.close(() => r())) });
  }));
}

if (process.argv[1]?.endsWith("mock-gemini.ts")) {
  startMockGemini(Number(process.argv[2] ?? 54400)).then((m) => console.log(`mock gemini on ${m.url}`));
}
