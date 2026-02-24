/**
 * AI Agent Infrastructure Sub-Module
 *
 * Encapsulates cross-cutting infrastructure concerns:
 * - Observability (metrics, tracing, OpenTelemetry, Prometheus)
 * - Structured logging
 * - Alerting channels
 * - Configuration management
 * - Storage backends
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../memory/memory.module';

// Storage
import { MemoryStorage } from './storage/memory.storage';

// Observability
import { MetricsService } from './observability/metrics.service';
import { TracingService } from './observability/tracing.service';
import { OpenTelemetryService } from './observability/opentelemetry.service';
import { PrometheusMetricsService } from './observability/prometheus-metrics.service';

// Logging
import { StructuredLoggerService } from './logging/structured-logger.service';

// Config
import { AgentConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AiAgentMemoryModule, // For SanitizerService used by StructuredLoggerService
  ],
  providers: [
    // Storage
    MemoryStorage,

    // Observability
    MetricsService,
    TracingService,
    OpenTelemetryService,
    PrometheusMetricsService,

    // Logging
    StructuredLoggerService,

    // Config
    AgentConfigService,
    // Note: AlertChannelService provided globally by AgentSecurityModule
  ],
  exports: [
    MemoryStorage,
    MetricsService,
    TracingService,
    OpenTelemetryService,
    PrometheusMetricsService,
    StructuredLoggerService,
    AgentConfigService,
  ],
})
export class AiAgentInfraModule {}
