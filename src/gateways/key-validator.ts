// ============================================================
// Gateway API Key Format Validator
// Validates key format locally before making any network calls.
// ============================================================

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
}

const PATTERNS: Record<string, RegExp> = {
  stripe: /^sk_(live|test)_[A-Za-z0-9]{24,}$/,
  paystack: /^sk_(live|test)_[A-Fa-f0-9]{40,}$/,
  flutterwave: /^FLWSECK(-TEST)?-[A-Fa-f0-9]{32}$/,
};

const HINTS: Record<string, string> = {
  stripe: 'Stripe secret keys start with sk_live_ or sk_test_ followed by 24+ alphanumeric characters',
  paystack: 'Paystack secret keys start with sk_live_ or sk_test_ followed by 40+ hexadecimal characters',
  flutterwave: 'Flutterwave secret keys start with FLWSECK- or FLWSECK-TEST- followed by 32 hexadecimal characters',
};

export function validateKeyFormat(gateway: string, apiKey: string): KeyValidationResult {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key must be a non-empty string' };
  }

  const pattern = PATTERNS[gateway];
  if (!pattern) {
    return { valid: false, error: `Unknown gateway: ${gateway}. Supported: stripe, paystack, flutterwave` };
  }

  if (!pattern.test(apiKey.trim())) {
    return { valid: false, error: HINTS[gateway] };
  }

  return { valid: true };
}
