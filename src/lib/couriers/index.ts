import "server-only";
import { pathao } from "./pathao";
import { redx } from "./redx";
import { sandbox } from "./sandbox";
import { steadfast } from "./steadfast";
import type { CourierProvider } from "./types";

export const PROVIDERS: Record<string, CourierProvider> = { sandbox, steadfast, pathao, redx };
export const getProvider = (id: string): CourierProvider | null => PROVIDERS[id] ?? null;
export * from "./types";
