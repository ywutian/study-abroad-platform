// Legacy (backward compatible)
export * from './metrics.service';
export * from './tracing.service';

// Enterprise Observability (P1)
export {
  OpenTelemetryService,
  SpanBuilder,
  SpanKind,
  SpanStatus,
} from './opentelemetry.service';
export type { SpanContext } from './opentelemetry.service';

export { PrometheusMetricsService } from './prometheus-metrics.service';
export type {
  MetricLabels,
  HistogramBuckets,
} from './prometheus-metrics.service';
