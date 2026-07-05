// ============================================================
// Usage Push Service
// Pushes aggregated usage records to connected gateways.
// ============================================================

import { gatewayRepo, query } from "../db.ts";
import { getAdapter, decrypt } from "../../gateways/index.ts";

/**
 * Push aggregated usage for a customer to the connected gateway.
 */
export async function pushUsageToGateway(
  workspaceId: string,
  customerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ pushed: boolean; units?: number; error?: string }> {
  const gateway = await gatewayRepo.findActive(workspaceId);
  if (!gateway) return { pushed: false, error: "No active gateway" };

  const adapter = getAdapter(gateway.gateway);
  if (!adapter.recordUsage) return { pushed: false, error: "Gateway does not support usage records" };

  // Find subscription with gateway subscription ID via raw query
  const { rows: subRows } = await query(
    "SELECT id, gateway_subscription_id FROM subscriptions WHERE customer_id = $1 AND (status = 'active' OR status = 'trial') AND gateway_subscription_id IS NOT NULL LIMIT 1",
    [customerId],
  );

  if (subRows.length === 0) {
    return { pushed: false, error: "No active subscription with gateway ID" };
  }

  const gatewaySubId = subRows[0].gateway_subscription_id;

  try {
    const apiKey = decrypt(gateway.encrypted_api_key);

    // Get aggregated usage for the period
    const { rows: usageRows } = await query(
      `SELECT COALESCE(SUM(value), 0) AS total FROM usage_events
       WHERE customer_id = $1 AND timestamp >= $2 AND timestamp < $3`,
      [customerId, periodStart, periodEnd],
    );
    const units = Number(usageRows[0]?.total || 0);

    if (units <= 0) return { pushed: true, units: 0 };

    await adapter.recordUsage(apiKey, {
      subscriptionItemGatewayId: gatewaySubId,
      quantity: units,
    });

    // Update last synced timestamp
    await query(
      "UPDATE subscriptions SET last_synced_at = now() WHERE id = $1",
      [subRows[0].id],
    );

    return { pushed: true, units };
  } catch (err: any) {
    return { pushed: false, error: err.message };
  }
}
