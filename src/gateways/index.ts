// ============================================================
// Gateway Module — Public API
// ============================================================

export type {
  PaymentGatewayAdapter,
  VerifyConnectionResult,
  GatewayCustomer,
  GatewaySubscription,
  GatewayInvoice,
  GatewayWebhookEvent,
  GatewayCapabilities,
} from './adapter.ts';

export type {
  NonCustodialPaymentGateway,
  ChargeTokenParams,
  RefundParams,
  ChargeResult,
  RefundResult,
  NonCustodialBillingError,
} from './non-custodial-adapter.ts';

export { registerAdapter, getAdapter, listAdapters, hasAdapter } from './registry.ts';
export { encrypt, decrypt, previewKey } from './encryption.ts';
export { validateKeyFormat } from './key-validator.ts';
export { registerNonCustodialGateway, getNonCustodialGateway, listNonCustodialGateways } from './non-custodial-adapter.ts';
