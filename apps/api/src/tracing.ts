/**
 * OpenTelemetry SDK initialization.
 *
 * MUST be imported before any other module (first line in main.ts)
 * so that auto-instrumentations can patch HTTP, Express, ioredis, etc.
 *
 * Conditionally enabled: only starts when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Local development without the env var incurs zero overhead.
 */

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint) {
  // Validate URL format before initializing SDK
  // (Zod validation in env.validation.ts runs later during NestJS bootstrap)
  let isValidUrl = true;
  try {
    new URL(otlpEndpoint);
  } catch {
    isValidUrl = false;
    console.error(
      `[OTel] Invalid OTEL_EXPORTER_OTLP_ENDPOINT: "${otlpEndpoint}". Skipping tracing initialization.`,
    );
  }

  if (isValidUrl) {
    // Dynamic imports keep the require chain clean when OTel is disabled
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const {
      getNodeAutoInstrumentations,
    } = require('@opentelemetry/auto-instrumentations-node');
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-http');
    const {
      OTLPMetricExporter,
    } = require('@opentelemetry/exporter-metrics-otlp-http');
    const {
      PeriodicExportingMetricReader,
    } = require('@opentelemetry/sdk-metrics');
    const { PrismaInstrumentation } = require('@prisma/instrumentation');

    const serviceName = process.env.OTEL_SERVICE_NAME || 'study-abroad-api';

    const sdk = new NodeSDK({
      serviceName,
      traceExporter: new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`,
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${otlpEndpoint}/v1/metrics`,
        }),
        exportIntervalMillis: 60_000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy / low-value instrumentations
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
        new PrismaInstrumentation(),
      ],
    });

    sdk.start();

    // Graceful shutdown on SIGTERM (Cloud Run sends this)
    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => console.log('[OTel] SDK shut down successfully'))
        .catch((err: Error) =>
          console.error('[OTel] Error during shutdown', err),
        );
    });

    console.log(`[OTel] Tracing + metrics enabled → ${otlpEndpoint}`);
  }
}
