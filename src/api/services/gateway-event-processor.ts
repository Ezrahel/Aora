// ============================================================
// Gateway Event Processor — Background Worker
// Polls for unprocessed gateway events and dispatches handlers.
// ============================================================

import { gatewayEventRepo, query } from "../db.ts";
import { dispatchGatewayEvent } from "../../gateways/event-handlers.ts";
import type { GatewayWebhookEvent } from "../../gateways/adapter.ts";

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background event processor.
 * Polls every `intervalMs` milliseconds.
 */
export function startEventProcessor(intervalMs = 10_000): void {
  if (intervalHandle) return; // already running

  console.log(`[GatewayEventProcessor] Started (polling every ${intervalMs}ms)`);

  intervalHandle = setInterval(async () => {
    try {
      const events = await gatewayEventRepo.findUnprocessed(20);

      for (const evt of events) {
        try {
          // Find workspace
          const { rows: wsRows } = await query(
            "SELECT id, name, environment FROM workspaces WHERE id = $1 LIMIT 1",
            [evt.workspace_id],
          );
          if (!wsRows[0]) {
            await gatewayEventRepo.markFailed(null, evt.id, "Workspace not found");
            continue;
          }

          const ws = wsRows[0];
          const mappedEvent: GatewayWebhookEvent = {
            type: evt.event_type,
            eventId: evt.id,
            gateway: evt.gateway,
            customerId: evt.customer_id ?? undefined,
            raw: evt.raw_payload,
          };

          const result = await dispatchGatewayEvent(ws, mappedEvent);

          if (!result.processed && result.skipped) {
            // Mark as skipped so we don't retry
            await gatewayEventRepo.markProcessed(null, evt.id); // no-op handler, just mark done
          }
        } catch (err: any) {
          await gatewayEventRepo.markFailed(null, evt.id, err.message);
        }
      }
    } catch (err) {
      console.error("[GatewayEventProcessor] Poll error:", err);
    }
  }, intervalMs);
}

/**
 * Stop the background event processor.
 */
export function stopEventProcessor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[GatewayEventProcessor] Stopped");
  }
}
