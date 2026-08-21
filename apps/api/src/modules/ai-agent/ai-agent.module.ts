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

// External domain modules (for tool service DI)
import { PredictionModule } from '../prediction/prediction.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ForumModule } from '../forum/forum.module';
import { HallModule } from '../hall/hall.module';
import { ResumeModule } from '../resume/resume.module';
import { EssayModule } from '../essay/essay.module';
import { RecommendationModule } from '../recommendation/recommendation.module';

// Sub-Modules
import { AiAgentMemoryModule } from './memory/memory.module';
import { AiAgentInfraModule } from './infrastructure/infrastructure.module';
import { LLMProvidersModule } from './providers/provider.module';

// WebSocket Gateway
import { AiAgentGateway } from './ai-agent.gateway';

// Core services
// NOTE: LLMService, ResilienceService, TokenTrackerService are globally
// provided by LLMProvidersModule.forRoot() — imported for type references only.
import { MemoryService } from './core/memory.service';
import { ToolExecutorService } from './core/tool-executor.service';
import { ToolPolicyService } from './core/tool-policy.service';
import { AgentRunService } from './core/agent-run.service';
import { AgentRunRetentionService } from './core/agent-run-retention.service';
import { AgentEvaluationTraceService } from './core/agent-evaluation-trace.service';
import { AgentHarnessOperationsService } from './core/agent-harness-operations.service';
import { WorkflowEngineService } from './core/workflow-engine.service';
import { AgentRunnerService } from './core/agent-runner.service';
import { OrchestratorService } from './core/orchestrator.service';

// Resilience services (not globally provided)
import { RateLimiterService } from './core/rate-limiter.service';
import { FallbackService } from './core/fallback.service';
import { FastRouterService } from './core/fast-router.service';
import { EmbeddingRouterService } from './core/embedding-router.service';

// Task Queue
import { TaskQueueService } from './queue/task-queue.service';

// Web Search
import { WebSearchService } from './services/web-search.service';

// Tool helpers & domain services
import {
  SchoolLookupHelper,
  ProfileLoaderHelper,
  ProfileToolsService,
  SchoolToolsService,
  EssayToolsService,
  RecommendationToolsService,
  PredictionToolsService,
  CaseToolsService,
  TimelineToolsService,
  AssessmentToolsService,
  ForumToolsService,
  RankingToolsService,
  SearchToolsService,
  ResumeToolsService,
  SimilarityToolsService,
} from './tools';

// Config validation
import { ConfigValidatorService } from './config/config-validator.service';
import { ArchitectureValidatorService } from './config/architecture-validator.service';

// Guards
import { AgentThrottleGuard } from './guards';

// Controllers
import { AiAgentController } from './ai-agent.controller';
import { AgentAdminController } from './admin/agent-admin.controller';
import { AgentHarnessAdminController } from './admin/agent-harness-admin.controller';
import { UserDataController } from './user-data.controller';

// Middleware
import {
  RequestContextMiddleware,
  UserContextMiddleware,
} from './infrastructure/context/request-context';
import { AgentSecurityMiddleware } from './middleware/security.middleware';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    PrismaModule,
    RedisModule,

    // LLM Provider abstraction (global — available to all modules)
    LLMProvidersModule.forRoot(),

    // External domain modules (for tool service DI — no circular deps)
    PredictionModule,
    AssessmentModule,
    ForumModule,
    HallModule,
    ResumeModule,
    EssayModule,
    RecommendationModule,

    // Sub-modules (encapsulate memory & infrastructure providers)
    AiAgentMemoryModule,
    AiAgentInfraModule,
  ],
  controllers: [
    AiAgentController,
    AgentAdminController,
    AgentHarnessAdminController,
    UserDataController,
  ],
  providers: [
    // Config Validation (must be first to validate on startup)
    ConfigValidatorService,
    ArchitectureValidatorService,

    // Resilience & Protection Services
    // NOTE: ResilienceService, TokenTrackerService, LLMService are provided
    // globally by LLMProvidersModule.forRoot() — do NOT duplicate here.
    RateLimiterService,
    FallbackService,
    FastRouterService,
    EmbeddingRouterService,

    // Tool helpers (shared across domain tool services)
    SchoolLookupHelper,
    ProfileLoaderHelper,

    // Domain Tool Services (13 services, replace legacy ToolExecutor)
    ProfileToolsService,
    SchoolToolsService,
    EssayToolsService,
    RecommendationToolsService,
    PredictionToolsService,
    CaseToolsService,
    SimilarityToolsService,
    TimelineToolsService,
    AssessmentToolsService,
    ForumToolsService,
    RankingToolsService,
    SearchToolsService,
    ResumeToolsService,

    // Core Agent Services
    MemoryService, // Legacy (backward-compatible)
    AgentEvaluationTraceService,
    AgentHarnessOperationsService,
    AgentRunRetentionService,
    AgentRunService,
    ToolPolicyService,
    ToolExecutorService,
    WorkflowEngineService,
    AgentRunnerService,
    OrchestratorService,

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
    RateLimiterService,
    AiAgentGateway,
    WebSearchService,
    ArchitectureValidatorService,
    // Re-export MemoryModule (8 external modules import AiAgentMemoryModule directly)
    AiAgentMemoryModule,
  ],
})
export class AiAgentModule implements OnModuleInit, NestModule {
  private readonly logger = new Logger(AiAgentModule.name);

  onModuleInit() {
    this.logger.log('Initializing AI Agent module with resilience features');
  }

  configure(consumer: MiddlewareConsumer) {
    // Order matters, and both are required.
    //
    // RequestContextMiddleware opens the AsyncLocalStorage scope;
    // UserContextMiddleware fills in who is asking, and can only do that after
    // the auth guard has attached `req.user`. Only the first was ever
    // registered, so `userId`, `userRole` and `isVip` were never set —
    // silently, because every accessor answers `undefined` without complaint.
    // The agent audit log recorded its entries with no subject for as long as
    // that was true.
    consumer
      .apply(RequestContextMiddleware, UserContextMiddleware)
      .forRoutes('ai-agent', 'admin/ai-agent');

    consumer
      .apply(AgentSecurityMiddleware)
      .forRoutes('ai-agent/chat', 'ai-agent/agent');
  }
}
