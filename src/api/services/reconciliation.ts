// ============================================================
// Revenue Reconciliation Service
// Compares internal billing data with gateway payment events.
// ============================================================

import { query, customerRepo } from "../db.ts";
import type { CustomerRow } from "../db/repositories/customer.repo.ts";

interface CustomerReconciliation {
  customerId: string;
  customerName: string;
  internalUsage: number;
  internalRevenue: number;
  gatewayRevenue: number;
  variance: number;
  variancePercent: number;
}

interface WorkspaceReconciliation {
  periodStart: string;
  periodEnd: string;
  totals: {
    internalRevenue: number;
    gatewayRevenue: number;
    variance: number;
  };
  customers: CustomerReconciliation[];
}

/**
 * Reconcile a single customer's billing data against gateway records.
 */
export async function reconcileCustomer(
  customerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CustomerReconciliation> {
  // Get customer info
  const customer = await customerRepo.findById(null, customerId);

  // Internal usage for period
  const { rows: usageRows } = await query(
    `SELECT COALESCE(SUM(value), 0) AS total FROM usage_events
     WHERE customer_id = $1 AND timestamp >= $2 AND timestamp < $3`,
    [customerId, periodStart, periodEnd],
  );
  const internalUsage = Number(usageRows[0]?.total || 0);

  // Internal invoices for period
  const { rows: invoiceRows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM invoices
     WHERE customer_id = $1 AND created_at >= $2 AND created_at < $3 AND status IN ('paid', 'open')`,
    [customerId, periodStart, periodEnd],
  );
  const internalRevenue = Number(invoiceRows[0]?.total || 0);

  // Gateway events for period (payment successes only)
  const { rows: gwRows } = await query(
    `SELECT COALESCE(SUM((mapped_data->>'amount')::numeric), 0) AS total, COUNT(*) AS count
     FROM gateway_events
     WHERE customer_id = $1 AND status = 'processed'
       AND event_type IN ('charge.success', 'charge.succeeded', 'charge.completed', 'invoice.payment_succeeded')
       AND created_at >= $2 AND created_at < $3`,
    [customerId, periodStart, periodEnd],
  );
  const gatewayRevenue = Number(gwRows[0]?.total || 0);

  const variance = Math.abs(internalRevenue - gatewayRevenue);
  const variancePercent = internalRevenue > 0
    ? Math.round((variance / internalRevenue) * 100 * 100) / 100
    : 0;

  return {
    customerId,
    customerName: customer?.name ?? customerId,
    internalUsage,
    internalRevenue,
    gatewayRevenue,
    variance,
    variancePercent,
  };
}

/**
 * Reconcile all customers in a workspace for a given period.
 */
export async function reconcileWorkspace(
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
  customerId?: string,
): Promise<WorkspaceReconciliation> {
  const customers = await customerRepo.findByWorkspace(workspaceId);
  const filtered = customerId
    ? customers.filter((c: CustomerRow) => c.id === customerId)
    : customers.slice(0, 50); // limit to 50 customers

  const reports: CustomerReconciliation[] = [];

  for (const cust of filtered) {
    try {
      const report = await reconcileCustomer(cust.id, periodStart, periodEnd);
      reports.push(report);
    } catch (err) {
      console.error(`Reconciliation failed for customer ${cust.id}:`, err);
    }
  }

  const totals = reports.reduce(
    (acc, r) => ({
      internalRevenue: acc.internalRevenue + r.internalRevenue,
      gatewayRevenue: acc.gatewayRevenue + r.gatewayRevenue,
      variance: acc.variance + r.variance,
    }),
    { internalRevenue: 0, gatewayRevenue: 0, variance: 0 },
  );

  return {
    periodStart,
    periodEnd,
    totals,
    customers: reports,
  };
}
