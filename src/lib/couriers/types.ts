export type ShipmentStatus = "pending" | "created" | "picked_up" | "in_transit" | "delivered" | "partial_delivered" | "returned" | "cancelled" | "failed";

export type ShipmentInput = {
  invoice: string;            // our order number — sent as the courier's merchant invoice / order id
  recipientName: string;
  recipientPhone: string;
  address: string;
  area: string | null;
  district: string;
  codAmount: number;          // 0 when prepaid
  note: string | null;
  itemCount: number;
  itemDescription: string;
  weightKg: number;
};

export type CreateResult = {
  consignmentId: string;
  trackingCode: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  status: ShipmentStatus;
  deliveryFee: number | null;
  raw: unknown;
};

export type StatusResult = { status: ShipmentStatus; providerStatus: string; codCollected: number | null; raw: unknown };

export type WebhookEvent = {
  consignmentId: string | null;
  invoice: string | null;
  providerStatus: string;
  status: ShipmentStatus | null;
  codCollected: number | null;
  dedupeKey: string;
  raw: unknown;
};

export interface CourierProvider {
  id: "sandbox" | "steadfast" | "pathao" | "redx";
  label: string;
  sandbox: boolean;
  /** Which env vars are missing; empty when the provider can be used. */
  missingConfig(): string[];
  createShipment(input: ShipmentInput): Promise<CreateResult>;
  getStatus?(consignmentId: string): Promise<StatusResult>;
  /** Look up a parcel by our invoice, to avoid duplicates after an ambiguous failure. */
  findByInvoice?(invoice: string): Promise<CreateResult | null>;
  /** Authenticate and parse an incoming webhook. Throws CourierError(401) when unauthenticated. */
  parseWebhook?(headers: Headers, body: unknown, url: URL): WebhookEvent | WebhookEvent[];
}

export class CourierError extends Error {
  constructor(message: string, public retryable: boolean, public status?: number, public detail?: unknown) {
    super(message);
  }
}

/** fetch with timeout; network/5xx errors are retryable, 4xx are not. */
export async function courierFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } catch (e) {
    throw new CourierError((e as Error).name === "AbortError" ? "Courier API timed out — the parcel may or may not have been created." : "Couldn't reach the courier API.", true);
  } finally {
    clearTimeout(t);
  }
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = typeof body === "object" && body ? ((body as Record<string, unknown>).message ?? (body as Record<string, unknown>).error ?? JSON.stringify(body).slice(0, 300)) : String(text).slice(0, 300);
    throw new CourierError(`Courier API error ${res.status}: ${msg}`, res.status >= 500 || res.status === 429, res.status, body);
  }
  return body;
}
