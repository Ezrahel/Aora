// ============================================================
// Gateway Adapter Registry
// Register and retrieve PaymentGatewayAdapter implementations.
// ============================================================

import type { PaymentGatewayAdapter } from './adapter.ts';
import { StripeAdapter } from './stripe/index.ts';
import { PaystackAdapter } from './paystack/index.ts';
import { FlutterwaveAdapter } from './flutterwave/index.ts';

const adapters = new Map<string, PaymentGatewayAdapter>();

export function registerAdapter(adapter: PaymentGatewayAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): PaymentGatewayAdapter {
  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(`No adapter registered for gateway: '${name}'. Available: ${listAdapters().join(', ')}`);
  }
  return adapter;
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

export function hasAdapter(name: string): boolean {
  return adapters.has(name);
}

// Register built-in adapters on import
registerAdapter(new StripeAdapter());
registerAdapter(new PaystackAdapter());
registerAdapter(new FlutterwaveAdapter());
