// ============================================================
// AoraHQ Email Service — SendByte transactional wrapper
// Used by dunning, invoices, and lifecycle emails.
// Falls back to console.log when SENDBYTE_API_KEY is missing.
// ============================================================

import { SendByte } from "@sendbyte/node";

let _client: SendByte | null = null;

function getClient(): SendByte | null {
  if (_client) return _client;
  const key = process.env.SENDBYTE_API_KEY;
  if (!key || (!key.startsWith("sk_live_") && !key.startsWith("sk_test_"))) {
    return null;
  }
  _client = new SendByte(key);
  return _client;
}

export function isEmailConfigured(): boolean {
  return getClient() !== null;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const sb = getClient();
  const from = process.env.WAITLIST_FROM || "AoraHQ <hello@aorahq.com>";
  if (!sb) {
    console.log(`[email:skip] to=${input.to} subject=${input.subject} (SENDBYTE_API_KEY missing)`);
    return false;
  }
  try {
    await sb.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return true;
  } catch (err) {
    console.error("[email] SendByte send failed:", (err as Error).message);
    return false;
  }
}

export function dunningEmailTemplate(opts: {
  customerName: string;
  invoiceId: string;
  amount: string;
  currency: string;
  attemptNumber: number;
  payUrl?: string;
}): { subject: string; html: string } {
  const { customerName, invoiceId, amount, currency, attemptNumber, payUrl } = opts;
  const subject =
    attemptNumber <= 1
      ? `Payment reminder: invoice ${invoiceId} (${amount} ${currency})`
      : `Action needed: retry ${attemptNumber} for invoice ${invoiceId}`;
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F5F7;padding:40px 20px;">
<table width="100%"><tr><td align="center">
<table style="max-width:520px;background:#fff;border-radius:16px;padding:32px;">
<tr><td><h2 style="margin:0 0 8px;">Hi ${customerName},</h2>
<p style="color:#555;">We couldn't collect <strong>${amount} ${currency}</strong> for invoice <strong>${invoiceId}</strong> (attempt ${attemptNumber}).</p>
<p style="color:#555;">Please update your payment method to avoid interruption.</p>
${payUrl ? `<p><a href="${payUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;">Pay now</a></p>` : ""}
<p style="color:#888;font-size:12px;">— AoraHQ Billing</p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}
