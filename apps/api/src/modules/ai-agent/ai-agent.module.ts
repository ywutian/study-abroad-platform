/**
 * AI Agent 模块 - 企业级多 Agent 系统
 *
 * 功能特性:
 * - 多 Agent 协作 (Orchestrator + 专业 Agent)
 * - 弹性保护 (重试、熔断、超时)
 * - 限流与配额管理
 * - 快速路由 (关键词预判)
 * - 降级与兜底响应
 * - Token 追踪与成本控制
 * - 企业级记忆系统
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
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AiModule } from '../ai/ai.module';

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

// Enterprise Memory System
import {
  RedisCacheService,
  EmbeddingService,
  PersistentMemoryService,
  SummarizerService,
  MemoryManagerService,
  UserDataService,
  // Phase 1: Enterprise Memory Enhancement
  MemoryScorerService,
  MemoryDecayService,
  MemoryConflictService,
  MemoryExtractorService,
  // Phase 2: Memory Compaction
  MemoryCompactionService,
  // P0.2: Security - Sensitive Data Sanitization
  SanitizerService,
} from './memory';

// Task Queue
import { TaskQueueService } from './queue/task-queue.service';

// Security Pipeline
import { SecurityPipelineService } from './core/security-pipeline.service';

// Guards
import { AgentThrottleGuard } from './guards';

// Controllers
import { AiAgentController } from './ai-agent.controller';
import { AgentAdminController } from './admin/agent-admin.controller';
import { UserDataController } from './user-data.controller';

// Infrastructure
import { MemoryStorage } from './infrastructure/storage/memory.storage';
import {
  RequestContextMiddleware,
  UserContextMiddleware,
} from './infrastructure/context/request-context';

// Security Middleware
import { AgentSecurityMiddleware } from './middleware/security.middleware';
import { MetricsService } from './infrastructure/observability/metrics.service';
import { TracingService } from './infrastructure/observability/tracing.service';
import { AgentConfigService } from './infrastructure/config/config.service';

// Config validation
import { ConfigValidatorService } from './config/config-validator.service';

// Web Search
import { WebSearchService } from './services/web-search.service';

// P1: Enterprise Observability
import { StructuredLoggerService } from './infrastructure/logging/structured-logger.service';
import { OpenTelemetryService } from './infrastructure/observability/opentelemetry.service';
import { PrometheusMetricsService } from './infrastructure/observability/prometheus-metrics.service';

// P2: Alerting
import { AlertChannelService } from './infrastructure/alerting';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    PrismaModule,
    RedisModule,
    AiModule,
    EventEmitterModule.forRoot(),
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
    MemoryService, // Legacy (保持兼容)
    ToolExecutorService,
    WorkflowEngineService, // 三阶段工作流引擎 (Plan → Execute → Solve)
    AgentRunnerService,
    OrchestratorService,

    // Enterprise Memory System - Core
    RedisCacheService,
    EmbeddingService,
    PersistentMemoryService,
    SummarizerService,
    MemoryManagerService,
    UserDataService, // 用户数据管理

    // Enterprise Memory System - Phase 1 Enhancement
    MemoryScorerService, // 记忆评分
    MemoryDecayService, // 记忆衰减
    MemoryConflictService, // 冲突处理
    MemoryExtractorService, // 混合提取

    // Enterprise Memory System - Phase 2: Compaction
    MemoryCompactionService, // 记忆压缩（定时任务 @Cron）

    // P0.2: Security Services
    SanitizerService, // 敏感数据脱敏
    SecurityPipelineService, // 安全管道（输入防护 + 输出审核）

    // Web Search
    WebSearchService, // 外部搜索引擎（Google + Tavily）

    // Task Queue
    TaskQueueService, // 异步任务队列

    // Guards
    AgentThrottleGuard,

    // Middleware (registered as provider for DI)
    AgentSecurityMiddleware,

    // Infrastructure - Legacy
    MemoryStorage,
    MetricsService,
    TracingService,
    AgentConfigService,

    // P1: Enterprise Observability
    StructuredLoggerService, // 结构化日志
    OpenTelemetryService, // 分布式追踪
    PrometheusMetricsService, // Prometheus 指标

    // P2: Alerting
    AlertChannelService, // 告警通道

    // WebSocket Gateway - 实时 AI 助手
    AiAgentGateway,
  ],
  exports: [
    OrchestratorService,
    MemoryManagerService,
    TokenTrackerService,
    RateLimiterService,
    AiAgentGateway,
    WebSearchService,
  ],
})
export class AiAgentModule implements OnModuleInit, NestModule {
  private readonly logger = new Logger(AiAgentModule.name);
  private cleanupIntervals: NodeJS.Timeout[] = [];

  constructor(
    private rateLimiter: RateLimiterService,
    private memoryManager: MemoryManagerService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing AI Agent module with resilience features');

    // 定期清理限流窗口 (每分钟)
    this.cleanupIntervals.push(
      setInterval(() => {
        this.rateLimiter.cleanup();
      }, 60000),
    );

    // 定期清理过期记忆 (每小时)
    this.cleanupIntervals.push(
      setInterval(async () => {
        try {
          const result = await this.memoryManager.cleanup();
          if (result.expiredMemories > 0) {
            this.logger.log(
              `Cleaned up ${result.expiredMemories} expired memories`,
            );
          }
        } catch (e) {
          this.logger.error('Memory cleanup failed', e);
        }
      }, 3600000),
    );
  }

  async onModuleDestroy() {
    // 清理定时器
    this.cleanupIntervals.forEach((interval) => clearInterval(interval));
  }

  configure(consumer: MiddlewareConsumer) {
    // 注册请求上下文中间件
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes('ai-agent', 'admin/ai-agent');

    // 注册安全中间件（Prompt 注入防护）
    consumer
      .apply(AgentSecurityMiddleware)
      .forRoutes('ai-agent/chat', 'ai-agent/stream');
  }
}
