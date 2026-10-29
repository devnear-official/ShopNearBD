/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
// Phone-like lab test, similar to Lighthouse mobile: "Slow 4G" (1.6 Mbps, 150 ms RTT) + 4x CPU slowdown.
// Usage: BASE=http://localhost:3100 PAGES=/,/shop node perf/lab.cjs
const { chromium } = require("playwright");

const base = process.env.BASE || "http://localhost:3100";
const pages = (process.env.PAGES || "/,/shop,/shop/breeze-rechargeable-desk-fan,/checkout").split(",");

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  for (const path of pages) {
    const runs = [];
    for (let r = 0; r < 2; r++) {
      // Run 1 warms the server cache; run 2 is reported (a returning server, a first-time visitor).
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const bytes = { script: 0, stylesheet: 0, font: 0, image: 0, document: 0, other: 0 };
      const types = new Map();
      let requests = 0;
      cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
      cdp.on("Network.loadingFinished", (e) => {
        requests++;
        const t = (types.get(e.requestId) || "other").toLowerCase();
        bytes[t in bytes ? t : "other"] += e.encodedDataLength;
      });
      await page.addInitScript(() => {
        window.__lcp = 0; window.__cls = 0; window.__tbt = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__tbt += Math.max(0, e.duration - 50); }).observe({ type: "longtask", buffered: true });
      });
      const t0 = Date.now();
      await page.goto(base + path, { waitUntil: "load", timeout: 120000 });
      const load = Date.now() - t0;
      await page.waitForTimeout(2500);
      const m = await page.evaluate(() => ({
        ttfb: performance.getEntriesByType("navigation")[0].responseStart,
        fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0,
        lcp: window.__lcp, cls: window.__cls, tbt: window.__tbt,
      }));
      runs.push({ ...m, load, requests, kb: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)])) });
      await ctx.close();
    }
    const r = runs[1];
    console.log(`${path.padEnd(36)} TTFB ${Math.round(r.ttfb)}  FCP ${Math.round(r.fcp)}  LCP ${Math.round(r.lcp)}  TBT ${Math.round(r.tbt)}  CLS ${r.cls.toFixed(3)}  load ${r.load}  req ${r.requests}  KB ${JSON.stringify(r.kb)}`);
  }
  await browser.close();
})();
