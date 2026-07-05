// ============================================================
// OpenTelemetry Tracing (Minimal Setup)
// ============================================================

let tracingEnabled = false;

export function initTracing(serviceName = "aora-billing") {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.log("[Tracing] No OTEL_EXPORTER_OTLP_ENDPOINT set, tracing disabled");
    return;
  }

  try {
    // In production, load and configure OpenTelemetry SDK here.
    // For now, this is a structured logging trace bridge.

    tracingEnabled = true;
    console.log(`[Tracing] Initialized for ${serviceName}`);
  } catch (err) {
    console.warn("[Tracing] Failed to initialize:", err);
  }
}

export function isTracingEnabled(): boolean {
  return tracingEnabled;
}

export function createSpan(name: string, attributes?: Record<string, string>) {
  const startTime = Date.now();

  return {
    name,
    attributes: attributes || {},
    end: () => {
      const duration = Date.now() - startTime;
      if (tracingEnabled) {
        console.log(JSON.stringify({
          type: "span",
          name,
          duration,
          attributes,
          timestamp: new Date().toISOString(),
        }));
      }
    },
  };
}
