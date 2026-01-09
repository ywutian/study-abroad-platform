/**
 * AI Agent 管理控制器
 * 
 * 提供配置查看、调整、监控的管理接口
 * 仅限 ADMIN 角色访问
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AgentConfigService } from '../infrastructure/config/config.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { TracingService } from '../infrastructure/observability/tracing.service';
import { TokenTrackerService } from '../core/token-tracker.service';
import { RateLimiterService } from '../core/rate-limiter.service';
import { ResilienceService } from '../core/resilience.service';
import { LLMService } from '../core/llm.service';
import { AgentType } from '../types';
import { IsString, IsNumber, IsBoolean, IsOptional, IsObject, Min, Max } from 'class-validator';

// ==================== DTOs ====================

class UpdateQuotaDto {
  @IsNumber()
  @Min(1000)
  dailyTokens?: number;

  @IsNumber()
  @Min(10000)
  monthlyTokens?: number;

  @IsNumber()
  @Min(0.1)
  dailyCost?: number;

  @IsNumber()
  @Min(1)
  monthlyCost?: number;
}

class UpdateRateLimitDto {
  @IsNumber()
  @Min(1000)
  windowMs?: number;

  @IsNumber()
  @Min(1)
  @Max(1000)
  maxRequests?: number;
}

class UpdateAgentConfigDto {
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(8000)
  maxTokens?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString({ each: true })
  @IsOptional()
  tools?: string[];
}

class UpdateFeatureDto {
  @IsBoolean()
  enabled: boolean;
}

class SetUserQuotaDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(1000)
  dailyTokens: number;

  @IsNumber()
  @Min(10000)
  monthlyTokens: number;
}

// ==================== Controller ====================

@ApiTags('ai-agent-admin')
@ApiBearerAuth()
@Controller('admin/ai-agent')
@Roles('ADMIN')
export class AgentAdminController {
  constructor(
    private configService: AgentConfigService,
    private metricsService: MetricsService,
    private tracingService: TracingService,
    private tokenTracker: TokenTrackerService,
    private rateLimiter: RateLimiterService,
    private resilience: ResilienceService,
    private llm: LLMService,
  ) {}

  // ==================== 配置管理 ====================

  /**
   * 获取完整配置
   */
  @Get('config')
  @ApiOperation({ summary: '获取完整 Agent 配置' })
  getConfig() {
    return {
      config: this.configService.getFullConfig(),
      systemStatus: this.getSystemStatus(),
    };
  }

  /**
   * 获取系统配置
   */
  @Get('config/system')
  @ApiOperation({ summary: '获取系统配置' })
  getSystemConfig() {
    return this.configService.getSystemConfig();
  }

  /**
   * 更新配额配置
   */
  @Put('config/quota')
  @ApiOperation({ summary: '更新 Token 配额配置' })
  updateQuotaConfig(@Body() dto: UpdateQuotaDto) {
    const current = this.configService.getSystemConfig();
    
    return this.configService.updateSystemConfig({
      quota: {
        daily: {
          tokens: dto.dailyTokens ?? current.quota.daily.tokens,
          cost: dto.dailyCost ?? current.quota.daily.cost,
        },
        monthly: {
          tokens: dto.monthlyTokens ?? current.quota.monthly.tokens,
          cost: dto.monthlyCost ?? current.quota.monthly.cost,
        },
      },
    });
  }

  /**
   * 更新限流配置
   */
  @Put('config/rate-limit/:type')
  @ApiOperation({ summary: '更新限流配置' })
  updateRateLimitConfig(
    @Param('type') type: 'user' | 'vip',
    @Body() dto: UpdateRateLimitDto,
  ) {
    const current = this.configService.getSystemConfig();
    const currentLimit = current.rateLimit[type];

    return this.configService.updateSystemConfig({
      rateLimit: {
        ...current.rateLimit,
        [type]: {
          windowMs: dto.windowMs ?? currentLimit.windowMs,
          maxRequests: dto.maxRequests ?? currentLimit.maxRequests,
        },
      },
    });
  }

  // ==================== Agent 配置 ====================

  /**
   * 获取所有 Agent 配置
   */
  @Get('agents')
  @ApiOperation({ summary: '获取所有 Agent 配置' })
  getAllAgents() {
    return this.configService.getAllAgentConfigs();
  }

  /**
   * 获取单个 Agent 配置
   */
  @Get('agents/:type')
  @ApiOperation({ summary: '获取单个 Agent 配置' })
  getAgent(@Param('type') type: AgentType) {
    return this.configService.getAgentConfig(type);
  }

  /**
   * 更新 Agent 配置
   */
  @Put('agents/:type')
  @ApiOperation({ summary: '更新 Agent 配置' })
  updateAgent(
    @Param('type') type: AgentType,
    @Body() dto: UpdateAgentConfigDto,
  ) {
    return this.configService.updateAgentConfig(type, dto);
  }

  /**
   * 启用/禁用 Agent
   */
  @Put('agents/:type/toggle')
  @ApiOperation({ summary: '启用/禁用 Agent' })
  toggleAgent(
    @Param('type') type: AgentType,
    @Body() dto: UpdateFeatureDto,
  ) {
    return this.configService.updateAgentConfig(type, { enabled: dto.enabled });
  }

  // ==================== 功能开关 ====================

  /**
   * 获取功能开关状态
   */
  @Get('features')
  @ApiOperation({ summary: '获取功能开关状态' })
  getFeatures() {
    const config = this.configService.getSystemConfig();
    return config.features;
  }

  /**
   * 切换功能开关
   */
  @Put('features/:feature')
  @ApiOperation({ summary: '切换功能开关' })
  toggleFeature(
    @Param('feature') feature: 'fastRouting' | 'memoryEnhancement' | 'streamingEnabled' | 'abTestEnabled',
    @Body() dto: UpdateFeatureDto,
  ) {
    this.configService.toggleFeature(feature, dto.enabled);
    return { feature, enabled: dto.enabled };
  }

  // ==================== 用户配额管理 ====================

  /**
   * 查看用户使用量
   */
  @Get('users/:userId/usage')
  @ApiOperation({ summary: '查看用户 Token 使用量' })
  async getUserUsage(@Param('userId') userId: string) {
    return this.tokenTracker.getUsageStats(userId);
  }

  /**
   * 查看用户限流状态
   */
  @Get('users/:userId/rate-limit')
  @ApiOperation({ summary: '查看用户限流状态' })
  getUserRateLimit(@Param('userId') userId: string) {
    return {
      user: this.rateLimiter.getStatus(userId, 'user'),
      conversation: this.rateLimiter.getStatus(userId, 'conversation'),
      agent: this.rateLimiter.getStatus(userId, 'agent'),
    };
  }

  /**
   * 重置用户限流
   */
  @Delete('users/:userId/rate-limit')
  @ApiOperation({ summary: '重置用户限流' })
  @HttpCode(HttpStatus.NO_CONTENT)
  resetUserRateLimit(@Param('userId') userId: string) {
    this.rateLimiter.reset(userId, 'user');
    this.rateLimiter.reset(userId, 'conversation');
    this.rateLimiter.reset(userId, 'agent');
  }

  // ==================== 监控指标 ====================

  /**
   * 获取指标摘要
   */
  @Get('metrics')
  @ApiOperation({ summary: '获取指标摘要' })
  getMetrics() {
    return this.metricsService.getMetrics();
  }

  /**
   * 获取 Prometheus 格式指标
   */
  @Get('metrics/prometheus')
  @ApiOperation({ summary: '获取 Prometheus 格式指标' })
  getPrometheusMetrics() {
    return this.metricsService.getPrometheusFormat();
  }

  /**
   * 重置指标
   */
  @Delete('metrics')
  @ApiOperation({ summary: '重置指标' })
  @HttpCode(HttpStatus.NO_CONTENT)
  resetMetrics() {
    this.metricsService.reset();
  }

  // ==================== 追踪信息 ====================

  /**
   * 获取最近请求追踪
   */
  @Get('traces/recent')
  @ApiOperation({ summary: '获取最近请求追踪' })
  getRecentTraces(@Query('limit') limit: number = 50) {
    return this.tracingService.getRecentSpans(limit);
  }

  /**
   * 获取慢请求
   */
  @Get('traces/slow')
  @ApiOperation({ summary: '获取慢请求' })
  getSlowTraces(
    @Query('threshold') threshold: number = 5000,
    @Query('limit') limit: number = 50,
  ) {
    return this.tracingService.getSlowSpans(threshold, limit);
  }

  /**
   * 获取错误请求
   */
  @Get('traces/errors')
  @ApiOperation({ summary: '获取错误请求' })
  getErrorTraces(@Query('limit') limit: number = 50) {
    return this.tracingService.getErrorSpans(limit);
  }

  /**
   * 获取单个 Trace
   */
  @Get('traces/:traceId')
  @ApiOperation({ summary: '获取单个 Trace 详情' })
  getTrace(@Param('traceId') traceId: string) {
    return this.tracingService.exportJaegerFormat(traceId);
  }

  // ==================== 熔断器管理 ====================

  /**
   * 获取熔断器状态
   */
  @Get('circuit-breakers')
  @ApiOperation({ summary: '获取熔断器状态' })
  getCircuitBreakers() {
    return {
      llm: this.resilience.getCircuitStatus('llm'),
      // 可扩展其他服务
    };
  }

  /**
   * 重置熔断器
   */
  @Delete('circuit-breakers/:service')
  @ApiOperation({ summary: '重置熔断器' })
  @HttpCode(HttpStatus.NO_CONTENT)
  resetCircuitBreaker(@Param('service') service: string) {
    this.resilience.resetCircuit(service);
  }

  // ==================== 健康检查 ====================

  /**
   * 系统健康状态
   */
  @Get('health')
  @ApiOperation({ summary: '获取系统健康状态' })
  async getHealth() {
    const llmStatus = this.llm.getServiceStatus();
    const circuitStatus = this.resilience.getCircuitStatus('llm');

    return {
      status: llmStatus.isHealthy ? 'healthy' : 'degraded',
      components: {
        llm: {
          status: llmStatus.isHealthy ? 'up' : 'down',
          circuitState: circuitStatus.state,
          failures: circuitStatus.failures,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 私有方法 ====================

  private getSystemStatus() {
    return {
      llm: this.llm.getServiceStatus(),
      circuitBreaker: this.resilience.getCircuitStatus('llm'),
    };
  }
}







