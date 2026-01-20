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
import { EventEmitterModule } from '@nestjs/event-emitter';
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

// Alerting
import { AlertChannelService } from './alerting';

// Config
import { AgentConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EventEmitterModule.forRoot(),
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

    // Alerting
    AlertChannelService,

    // Config
    AgentConfigService,
  ],
  exports: [
    MemoryStorage,
    MetricsService,
    TracingService,
    OpenTelemetryService,
    PrometheusMetricsService,
    StructuredLoggerService,
    AlertChannelService,
    AgentConfigService,
  ],
})
export class AiAgentInfraModule {}
