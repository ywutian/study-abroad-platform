/**
 * AI Agent Module - Enterprise Multi-Agent System
 *
 * Architecture:
 * - AiAgentMemoryModule  — Enterprise memory system (caching, embedding, persistence, scoring, decay, compaction)
 * - AiAgentInfraModule   — Infrastructure (observability, logging, alerting, config, storage)
 * - AgentSecurityModule   — Security pipeline (prompt guard, content moderation, audit) [Global]
 * - Core services         — LLM, orchestration, resilience, workflow engine (this module)
 */

import {
  Module,
  OnModuleInit,
  Logger,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AiModule } from '../ai/ai.module';

// Sub-Modules
import { AiAgentMemoryModule } from './memory/memory.module';
import { AiAgentInfraModule } from './infrastructure/infrastructure.module';

// WebSocket Gateway
import { AiAgentGateway } from './ai-agent.gateway';

// Core services
import { LLMService } from './core/llm.service';
import { MemoryService } from './core/memory.service';
import { ToolExecutorService } from './core/tool-executor.service';
import { WorkflowEngineService } from './core/workflow-engine.service';
import { AgentRunnerService } from './core/agent-runner.service';
import { OrchestratorService } from './core/orchestrator.service';

// Resilience services
import { ResilienceService } from './core/resilience.service';
import { RateLimiterService } from './core/rate-limiter.service';
import { TokenTrackerService } from './core/token-tracker.service';
import { FallbackService } from './core/fallback.service';
import { FastRouterService } from './core/fast-router.service';

// Security Pipeline
import { SecurityPipelineService } from './core/security-pipeline.service';

// Task Queue
import { TaskQueueService } from './queue/task-queue.service';

// Web Search
import { WebSearchService } from './services/web-search.service';

// Config validation
import { ConfigValidatorService } from './config/config-validator.service';

// Guards
import { AgentThrottleGuard } from './guards';

// Controllers
import { AiAgentController } from './ai-agent.controller';
import { AgentAdminController } from './admin/agent-admin.controller';
import { UserDataController } from './user-data.controller';

// Middleware
import { RequestContextMiddleware } from './infrastructure/context/request-context';
import { AgentSecurityMiddleware } from './middleware/security.middleware';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    PrismaModule,
    RedisModule,
    AiModule,

    // Sub-modules (encapsulate memory & infrastructure providers)
    AiAgentMemoryModule,
    AiAgentInfraModule,
  ],
  controllers: [AiAgentController, AgentAdminController, UserDataController],
  providers: [
    // Config Validation (must be first to validate on startup)
    ConfigValidatorService,

    // Resilience & Protection Services
    ResilienceService,
    RateLimiterService,
    TokenTrackerService,
    FallbackService,
    FastRouterService,

    // Core Agent Services
    LLMService,
    MemoryService, // Legacy (backward-compatible)
    ToolExecutorService,
    WorkflowEngineService,
    AgentRunnerService,
    OrchestratorService,

    // Security Pipeline
    SecurityPipelineService,

    // Web Search
    WebSearchService,

    // Task Queue
    TaskQueueService,

    // Guards
    AgentThrottleGuard,

    // Middleware (registered as provider for DI)
    AgentSecurityMiddleware,

    // WebSocket Gateway
    AiAgentGateway,
  ],
  exports: [
    OrchestratorService,
    TokenTrackerService,
    RateLimiterService,
    AiAgentGateway,
    WebSearchService,
    // Re-export sub-modules so consumers can access MemoryManagerService etc.
    AiAgentMemoryModule,
    AiAgentInfraModule,
  ],
})
export class AiAgentModule implements OnModuleInit, NestModule {
  private readonly logger = new Logger(AiAgentModule.name);

  async onModuleInit() {
    this.logger.log('Initializing AI Agent module with resilience features');
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes('ai-agent', 'admin/ai-agent');

    consumer
      .apply(AgentSecurityMiddleware)
      .forRoutes('ai-agent/chat', 'ai-agent/stream');
  }
}
