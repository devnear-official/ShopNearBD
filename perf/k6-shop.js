/**
 * Load test plan for ShopNear BD (k6 — https://k6.io).
 *
 *   k6 run -e BASE=https://staging.example.com perf/k6-shop.js
 *
 * Run against STAGING with a staging Supabase project, never production.
 * Scenario mix approximates a sale day: mostly browsing, some cart/checkout
 * quotes, a few chats and real orders (COD, small quantities, on a product
 * with large stock that you reset afterwards).
 */
import http from "k6/http";
import { check, sleep, group } from "k6";

const BASE = __ENV.BASE || "http://localhost:3100";

export const options = {
  scenarios: {
    browse: { executor: "ramping-vus", startVUs: 0, stages: [{ duration: "2m", target: 600 }, { duration: "5m", target: 600 }, { duration: "1m", target: 0 }], exec: "browse" },
    chat: { executor: "constant-arrival-rate", rate: 5, timeUnit: "1s", duration: "6m", preAllocatedVUs: 20, exec: "chat", startTime: "1m" },
    checkout: { executor: "constant-arrival-rate", rate: 2, timeUnit: "1s", duration: "6m", preAllocatedVUs: 20, exec: "searchAndQuote", startTime: "1m" },
  },
  thresholds: {
    "http_req_failed{scenario:browse}": ["rate<0.01"],
    "http_req_duration{scenario:browse}": ["p(95)<800"],
    "http_req_duration{scenario:checkout}": ["p(95)<1500"],
    "http_req_duration{scenario:chat}": ["p(95)<8000"],
  },
};

const pages = ["/", "/shop", "/shop?category=audio", "/shop?sort=popular", "/shop/pulse-anc-earbuds-pro", "/shop/voltgo-20000-power-bank", "/help"];

export function browse() {
  group("browse", () => {
    const r = http.get(`${BASE}${pages[Math.floor(Math.random() * pages.length)]}`);
    check(r, { "200": (x) => x.status === 200 });
  });
  sleep(1 + Math.random() * 3);
}

export function searchAndQuote() {
  const r = http.get(`${BASE}/api/search?q=${["fan", "earbuds", "bag", "power"][Math.floor(Math.random() * 4)]}`);
  check(r, { "search 200": (x) => x.status === 200 });
}

export function chat() {
  const r = http.post(`${BASE}/api/chat`, JSON.stringify({ message: ["delivery charge koto?", "power bank er dam koto?", "bkash e payment kivabe?"][Math.floor(Math.random() * 3)] }), { headers: { "content-type": "application/json", "x-forwarded-for": `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  check(r, { "chat ok or rate limited": (x) => x.status === 200 || x.status === 429 });
}
