// ============================================================
// Dunning Service
// Schedules and processes payment recovery attempts.
// ============================================================

import { dunningRepo, invoiceRepo, gatewayRepo, query } from "../db.ts";
import { getAdapter, decrypt } from "../../gateways/index.ts";
import { sendEmail, dunningEmailTemplate } from "./email.ts";

const DUNNING_INTERVALS = [1, 3, 7, 14]; // days after failure
const MAX_ATTEMPTS = 5;

/**
 * Schedule dunning attempts for an invoice.
 */
export async function scheduleDunning(invoiceId: string): Promise<void> {
  const invoice = await invoiceRepo.findById(null, invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  for (const [i, days] of DUNNING_INTERVALS.entries()) {
    await dunningRepo.create(null, {
      id: "dun_" + Date.now() + "_" + i,
      invoiceId,
      attemptNumber: i + 1,
      action: i === 0 ? "email_reminder" : "retry_payment",
      scheduledAt: new Date(Date.now() + days * 86400000).toISOString(),
    });
  }
}

/**
 * Process all pending dunning attempts that are due now.
 */
export async function processScheduledDunning(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const pending = await dunningRepo.findScheduled(new Date().toISOString());
  let processed = 0, succeeded = 0, failed = 0;

  for (const attempt of pending) {
    processed++;

    if (attempt.action === "email_reminder") {
      // Send real reminder via SendByte; fall back to log when unconfigured.
      try {
        const { rows: detailRows } = await query(
          `SELECT i.amount, i.currency, i.customer_id, c.email as customer_email, c.name as customer_name
           FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = $1`,
          [attempt.invoice_id],
        );
        const detail = detailRows[0];
        if (detail?.customer_email) {
          const tpl = dunningEmailTemplate({
            customerName: detail.customer_name || "there",
            invoiceId: attempt.invoice_id,
            amount: String(detail.amount ?? ""),
            currency: String(detail.currency ?? "USD").toUpperCase(),
            attemptNumber: attempt.attempt_number,
          });
          await sendEmail({ to: detail.customer_email, subject: tpl.subject, html: tpl.html });
        } else {
          console.log(`[Dunning] Email reminder ${attempt.attempt_number} for invoice ${attempt.invoice_id} (no customer email)`);
        }
      } catch (emailErr) {
        console.error("[Dunning] email reminder failed:", (emailErr as Error).message);
      }
      await dunningRepo.updateStatus(null, attempt.id, "success");
      succeeded++;
      continue;
    }

    if (attempt.action === "retry_payment") {
      try {
        // Find workspace and gateway
        const { rows: invRows } = await query(
          "SELECT workspace_id, customer_id, gateway_invoice_id, gateway_payment_intent_id FROM invoices WHERE id = $1",
          [attempt.invoice_id],
        );
        if (!invRows[0]) {
          await dunningRepo.updateStatus(null, attempt.id, "failed");
          failed++;
          continue;
        }

        const inv = invRows[0];
        const gateway = await gatewayRepo.findActive(inv.workspace_id);

        if (gateway && inv.gateway_invoice_id) {
          const apiKey = decrypt(gateway.encrypted_api_key);
          const adapter = getAdapter(gateway.gateway);

          if (adapter.finalizeInvoice) {
            await adapter.finalizeInvoice(apiKey, inv.gateway_invoice_id);
          }

          await dunningRepo.updateStatus(null, attempt.id, "success", { retriedAt: new Date().toISOString() });
          succeeded++;

          // Mark invoice as open (retrying payment)
          await invoiceRepo.patchStatus(null, attempt.invoice_id, "open");
        } else {
          await dunningRepo.updateStatus(null, attempt.id, "failed");
          failed++;
        }
      } catch (err: any) {
        await dunningRepo.updateStatus(null, attempt.id, "failed", { error: err.message });
        failed++;

        // If max attempts reached, mark all remaining as skipped
        if (attempt.attempt_number >= MAX_ATTEMPTS) {
          await dunningRepo.markAllSkipped(null, attempt.invoice_id);
        }
      }
    }
  }

  return { processed, succeeded, failed };
}

/**
 * Get dunning status for an invoice.
 */
export async function getDunningStatus(invoiceId: string) {
  const attempts = await dunningRepo.findByInvoice(invoiceId);
  const lastAttempt = attempts[attempts.length - 1];

  return {
    invoiceId,
    totalAttempts: attempts.length,
    status: lastAttempt?.status || "none",
    nextAction: attempts.find((a) => a.status === "pending"),
    history: attempts,
  };
}
