/**
 * OpenTelemetry SDK initialization.
 *
 * MUST be imported before any other module (first line in main.ts)
 * so that auto-instrumentations can patch HTTP, Express, ioredis, etc.
 *
 * Conditionally enabled: only starts when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Local development without the env var incurs zero overhead.
 */
import { createRequire } from 'node:module';

const loadModule = createRequire(__filename);

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint) {
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
    const { NodeSDK } = loadModule(
      '@opentelemetry/sdk-node',
    ) as typeof import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = loadModule(
      '@opentelemetry/auto-instrumentations-node',
    ) as typeof import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = loadModule(
      '@opentelemetry/exporter-trace-otlp-http',
    ) as typeof import('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = loadModule(
      '@opentelemetry/exporter-metrics-otlp-http',
    ) as typeof import('@opentelemetry/exporter-metrics-otlp-http');
    const { PeriodicExportingMetricReader } = loadModule(
      '@opentelemetry/sdk-metrics',
    ) as typeof import('@opentelemetry/sdk-metrics');
    const { PrismaInstrumentation } = loadModule(
      '@prisma/instrumentation',
    ) as typeof import('@prisma/instrumentation');

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
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
        new PrismaInstrumentation(),
      ],
    });

    sdk.start();

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
