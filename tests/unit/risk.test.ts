import { describe, expect, it } from "vitest";
import { assessRisk, type RiskInput } from "@/lib/risk";

const base: RiskInput = { orders: 1, delivered: 0, cancelled: 0, returned: 0, open: 1, first_order: null, last_order: null, last_24h: 1, addresses: 1, names: 1, avg_total: 800, couriers: [] };

describe("assessRisk", () => {
  it("treats a first order as new, not risky", () => {
    expect(assessRisk(base).level).toBe("new");
  });
  it("rates a customer with delivered orders as low", () => {
    const r = assessRisk({ ...base, orders: 4, delivered: 3, open: 1 });
    expect(r.level).toBe("low");
    expect(r.successRate).toBe(1);
  });
  it("flags a customer whose finished orders mostly failed as high", () => {
    const r = assessRisk({ ...base, orders: 5, delivered: 1, cancelled: 2, returned: 2, open: 0 });
    expect(r.level).toBe("high");
    expect(r.reasons.join(" ")).toMatch(/20%/);
  });
  it("flags one earlier return as medium", () => {
    expect(assessRisk({ ...base, orders: 3, delivered: 2, returned: 1, open: 0 }).level).toBe("medium");
  });
  it("flags a burst of orders", () => {
    expect(assessRisk({ ...base, orders: 4, last_24h: 4, open: 4 }).level).toBe("high");
    expect(assessRisk({ ...base, orders: 3, last_24h: 3, open: 3 }).level).toBe("medium");
  });
  it("notices one phone with many names or addresses", () => {
    expect(assessRisk({ ...base, orders: 4, delivered: 4, open: 0, names: 3, last_24h: 0 }).level).toBe("medium");
    expect(assessRisk({ ...base, orders: 5, delivered: 5, open: 0, addresses: 4, last_24h: 0 }).level).toBe("medium");
  });
});
