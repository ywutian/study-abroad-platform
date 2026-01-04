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

import { Module, OnModuleInit, Logger, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

// Core services
import { LLMService } from './core/llm.service';
import { MemoryService } from './core/memory.service';
import { ToolExecutorService } from './core/tool-executor.service';
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
} from './memory';

// Guards
import { AgentThrottleGuard } from './guards';

// Controllers
import { AiAgentController } from './ai-agent.controller';
import { AgentAdminController } from './admin/agent-admin.controller';

// Infrastructure
import { MemoryStorage } from './infrastructure/storage/memory.storage';
import { RequestContextMiddleware, UserContextMiddleware } from './infrastructure/context/request-context';
import { MetricsService } from './infrastructure/observability/metrics.service';
import { TracingService } from './infrastructure/observability/tracing.service';
import { AgentConfigService } from './infrastructure/config/config.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AiModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AiAgentController, AgentAdminController],
  providers: [
    // Resilience & Protection Services
    ResilienceService,
    RateLimiterService,
    TokenTrackerService,
    FallbackService,
    FastRouterService,
    
    // Core Agent Services
    LLMService,
    MemoryService,          // Legacy (保持兼容)
    ToolExecutorService,
    AgentRunnerService,
    OrchestratorService,
    
    // Enterprise Memory System
    RedisCacheService,
    EmbeddingService,
    PersistentMemoryService,
    SummarizerService,
    MemoryManagerService,
    
    // Guards
    AgentThrottleGuard,
    
    // Infrastructure
    MemoryStorage,
    MetricsService,
    TracingService,
    AgentConfigService,
  ],
  exports: [
    OrchestratorService,
    MemoryManagerService,
    TokenTrackerService,
    RateLimiterService,
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
            this.logger.log(`Cleaned up ${result.expiredMemories} expired memories`);
          }
        } catch (e) {
          this.logger.error('Memory cleanup failed', e);
        }
      }, 3600000),
    );
  }

  async onModuleDestroy() {
    // 清理定时器
    this.cleanupIntervals.forEach(interval => clearInterval(interval));
  }

  configure(consumer: MiddlewareConsumer) {
    // 注册请求上下文中间件
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes('ai-agent', 'admin/ai-agent');
  }
}

