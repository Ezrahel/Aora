// ============================================================
// Non-Custodial Gateway Registry
// ============================================================

import type { NonCustodialPaymentGateway } from "./non-custodial-adapter.ts";

const nonCustodialGateways = new Map<string, NonCustodialPaymentGateway>();

export function registerNonCustodialGateway(gateway: NonCustodialPaymentGateway): void {
  nonCustodialGateways.set(gateway.name, gateway);
}

export function getNonCustodialGateway(name: string): NonCustodialPaymentGateway | undefined {
  return nonCustodialGateways.get(name);
}

export function listNonCustodialGateways(): string[] {
  return Array.from(nonCustodialGateways.keys());
}

// Auto-register built-in gateways
import { stripeNonCustodialGateway } from "./stripe/non-custodial.ts";
registerNonCustodialGateway(stripeNonCustodialGateway);

import { sandboxPaymentAdapter } from "./sandbox-adapter.ts";
registerNonCustodialGateway(sandboxPaymentAdapter);

export type { NonCustodialPaymentGateway } from "./non-custodial-adapter.ts";