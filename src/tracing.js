// Must be imported before anything else (server.js's first line) so
// auto-instrumentation can patch node:http before the app requires it.
// This is the standard OpenTelemetry Node.js bootstrap pattern — nothing
// rollfuse-specific here. @rollfuse/sdk-js's own trace propagation
// (evaluation-core's resolveTraceHeaders) picks up whatever context is
// active via @opentelemetry/api at call time; it never talks to this
// SDK object directly.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "checkout",
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? "http://localhost:4318/v1/traces",
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Reduces noise from filesystem instrumentation, which fires for
      // every module load and drowns out the spans this demo cares about.
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}
