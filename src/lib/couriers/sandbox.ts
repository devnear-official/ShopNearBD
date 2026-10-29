import { randomBytes } from "node:crypto";
import { CourierError, type CourierProvider } from "./types";

/**
 * DEVELOPMENT ADAPTER — books nothing with a real courier. Lets the whole
 * shipment workflow (booking, status updates, COD reconciliation, retries)
 * be exercised. An address containing "FAIL" simulates a temporary API error.
 */
export const sandbox: CourierProvider = {
  id: "sandbox",
  label: "Sandbox (test only — no real parcel)",
  sandbox: true,
  missingConfig: () => (process.env.NODE_ENV === "production" && process.env.ALLOW_SANDBOX_COURIER !== "1" ? ["ALLOW_SANDBOX_COURIER=1 (disabled in production)"] : []),
  async createShipment(input) {
    if (/FAIL/.test(input.address)) throw new CourierError("Sandbox: simulated temporary courier outage", true);
    const id = `SBX-${randomBytes(4).toString("hex").toUpperCase()}`;
    return {
      consignmentId: id, trackingCode: id, trackingUrl: null, labelUrl: null, status: "created", deliveryFee: null,
      raw: { sandbox: true, invoice: input.invoice, cod_amount: input.codAmount },
    };
  },
};
