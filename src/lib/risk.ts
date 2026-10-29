/**
 * Customer risk from the store's own history for a phone number (customer_risk() in the database).
 * It is a guide for the person confirming the order, not an automatic decision.
 */
export type CourierStat = { provider: string; total: number; delivered: number; returned: number; failed: number; in_flight: number };
export type RiskInput = {
  orders: number; delivered: number; cancelled: number; returned: number; open: number;
  first_order: string | null; last_order: string | null; last_24h: number; addresses: number; names: number; avg_total: number;
  couriers: CourierStat[];
};
export type RiskLevel = "new" | "low" | "medium" | "high";
export type Risk = { level: RiskLevel; headline: string; reasons: string[]; settled: number; successRate: number | null };

/** Orders that have reached an outcome: delivered, cancelled or returned. */
export function assessRisk(r: RiskInput): Risk {
  const bad = r.cancelled + r.returned;
  const settled = r.delivered + bad;
  const successRate = settled ? r.delivered / settled : null;
  const reasons: string[] = [];
  let level: RiskLevel = "low";
  const raise = (to: RiskLevel) => { const order = ["new", "low", "medium", "high"]; if (order.indexOf(to) > order.indexOf(level)) level = to; };

  if (settled >= 3 && successRate! < 0.5) { raise("high"); reasons.push(`Only ${Math.round(successRate! * 100)}% of ${settled} finished orders were delivered`); }
  else if (settled >= 2 && successRate! < 0.75) { raise("medium"); reasons.push(`${Math.round(successRate! * 100)}% of ${settled} finished orders were delivered`); }
  if (r.returned >= 3) { raise("high"); reasons.push(`${r.returned} parcels were returned`); }
  else if (r.returned >= 1) { raise("medium"); reasons.push(`${r.returned} parcel${r.returned > 1 ? "s" : ""} returned before`); }
  if (r.cancelled >= 3) { raise("high"); reasons.push(`${r.cancelled} orders cancelled`); }
  else if (r.cancelled >= 2) { raise("medium"); reasons.push(`${r.cancelled} orders cancelled`); }
  if (r.last_24h >= 4) { raise("high"); reasons.push(`${r.last_24h} orders in the last 24 hours`); }
  else if (r.last_24h >= 3) { raise("medium"); reasons.push(`${r.last_24h} orders in the last 24 hours`); }
  if (r.names >= 3 && r.orders >= 3) { raise("medium"); reasons.push(`Same phone used with ${r.names} different names`); }
  if (r.addresses >= 4) { raise("medium"); reasons.push(`${r.addresses} different delivery addresses`); }

  if (settled === 0 && !reasons.length) {
    level = "new";
    return { level, headline: r.orders > 1 ? "No finished orders yet" : "First order from this phone", reasons, settled, successRate };
  }
  if (!reasons.length) reasons.push(`${r.delivered} delivered, none returned or cancelled`);
  const headline = { new: "", low: "Looks reliable", medium: "Check before confirming", high: "High risk — call first" }[level];
  return { level, headline, reasons, settled, successRate };
}
