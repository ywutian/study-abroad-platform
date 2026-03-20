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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ThrottleRelaxed } from '../../../common/decorators/throttle.decorator';
import { Role, MemoryType, EntityType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentConfigService } from '../infrastructure/config/config.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { TracingService } from '../infrastructure/observability/tracing.service';
import { TokenTrackerService } from '../core/token-tracker.service';
import { RateLimiterService } from '../core/rate-limiter.service';
import { ResilienceService } from '../core/resilience.service';
import { LLMService } from '../core/llm.service';
import { MemoryManagerService } from '../memory/memory-manager.service';
import { MemoryDecayService } from '../memory/memory-decay.service';
import { MemoryConflictService } from '../memory/memory-conflict.service';
import { AgentType } from '../types';
import { ResolveSecurityEventDto } from '../dto/resolve-security-event.dto';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

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
  model?: string;

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

class UpdateLlmConfigDto {
  @IsString()
  @IsOptional()
  defaultModel?: string;

  @IsString()
  @IsOptional()
  fallbackModel?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  maxRetries?: number;

  @IsNumber()
  @IsOptional()
  @Min(5000)
  @Max(120000)
  timeoutMs?: number;
}

class UpdateFeatureDto {
  @IsBoolean()
  enabled: boolean;
}

class UpdateDecayConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(0.1)
  decayRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  minImportance?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(0.5)
  accessBoost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  maxAccessBoost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  archiveThreshold?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(365)
  archiveAfterDays?: number;

  @IsNumber()
  @IsOptional()
  @Min(30)
  @Max(3650)
  deleteAfterDays?: number;
}

// ==================== Controller ====================

@ApiTags('ai-agent-admin')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/ai-agent')
@Roles(Role.ADMIN)
export class AgentAdminController {
  constructor(
    private configService: AgentConfigService,
    private metricsService: MetricsService,
    private tracingService: TracingService,
    private tokenTracker: TokenTrackerService,
    private rateLimiter: RateLimiterService,
    private resilience: ResilienceService,
    private llm: LLMService,
    private prisma: PrismaService,
    private memoryManager: MemoryManagerService,
    private memoryDecay: MemoryDecayService,
    private memoryConflict: MemoryConflictService,
  ) {}

  // ==================== 配置管理 ====================

  /**
   * 获取完整配置
   */
  @Get('config')
  @ApiOperation({ summary: 'Get full Agent configuration' })
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
  @ApiOperation({ summary: 'Get system configuration' })
  getSystemConfig() {
    return this.configService.getSystemConfig();
  }

  /**
   * 更新 LLM 配置（模型、回退模型、重试、超时）
   */
  @Put('config/llm')
  @ApiOperation({ summary: 'Update LLM configuration' })
  updateLlmConfig(@Body() dto: UpdateLlmConfigDto) {
    const current = this.configService.getSystemConfig();

    return this.configService.updateSystemConfig({
      llm: {
        defaultModel: dto.defaultModel ?? current.llm.defaultModel,
        fallbackModel: dto.fallbackModel ?? current.llm.fallbackModel,
        maxRetries: dto.maxRetries ?? current.llm.maxRetries,
        timeoutMs: dto.timeoutMs ?? current.llm.timeoutMs,
      },
    });
  }

  /**
   * 更新配额配置
   */
  @Put('config/quota')
  @ApiOperation({ summary: 'Update token quota configuration' })
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
  @ApiOperation({ summary: 'Update rate limit configuration' })
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
  @ApiOperation({ summary: 'Get all Agent configurations' })
  getAllAgents() {
    return this.configService.getAllAgentConfigs();
  }

  /**
   * 获取单个 Agent 配置
   */
  @Get('agents/:type')
  @ApiOperation({ summary: 'Get single Agent configuration' })
  getAgent(@Param('type') type: AgentType) {
    return this.configService.getAgentConfig(type);
  }

  /**
   * 更新 Agent 配置
   */
  @Put('agents/:type')
  @ApiOperation({ summary: 'Update Agent configuration' })
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
  @ApiOperation({ summary: 'Enable/disable Agent' })
  toggleAgent(@Param('type') type: AgentType, @Body() dto: UpdateFeatureDto) {
    return this.configService.updateAgentConfig(type, { enabled: dto.enabled });
  }

  // ==================== 功能开关 ====================

  /**
   * 获取功能开关状态
   */
  @Get('features')
  @ApiOperation({ summary: 'Get feature toggle status' })
  getFeatures() {
    const config = this.configService.getSystemConfig();
    return config.features;
  }

  /**
   * 切换功能开关
   */
  @Put('features/:feature')
  @ApiOperation({ summary: 'Toggle feature switch' })
  toggleFeature(
    @Param('feature')
    feature:
      | 'fastRouting'
      | 'memoryEnhancement'
      | 'streamingEnabled'
      | 'abTestEnabled',
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
  @ApiOperation({ summary: 'View user token usage' })
  async getUserUsage(@Param('userId') userId: string) {
    return this.tokenTracker.getUsageStats(userId);
  }

  /**
   * 查看用户限流状态
   */
  @Get('users/:userId/rate-limit')
  @ApiOperation({ summary: 'View user rate limit status' })
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
  @ApiOperation({ summary: 'Reset user rate limit' })
  resetUserRateLimit(@Param('userId') userId: string) {
    void this.rateLimiter.reset(userId, 'user');
    void this.rateLimiter.reset(userId, 'conversation');
    void this.rateLimiter.reset(userId, 'agent');
    return { message: 'Rate limit reset' };
  }

  // ==================== 监控指标 ====================

  /**
   * 获取指标摘要
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get metrics summary' })
  getMetrics() {
    return this.metricsService.getMetrics();
  }

  /**
   * 获取 Prometheus 格式指标
   */
  @Get('metrics/prometheus')
  @ApiOperation({ summary: 'Get Prometheus format metrics' })
  getPrometheusMetrics() {
    return this.metricsService.getPrometheusFormat();
  }

  /**
   * 获取每日 Token 使用趋势
   */
  @Get('metrics/daily')
  @ApiOperation({ summary: 'Get daily token usage trends' })
  async getDailyMetrics(@Query('days') days: number = 30) {
    const daysCount = Math.min(Math.max(Number(days) || 30, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - daysCount);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{
        date: string;
        total_tokens: bigint;
        prompt_tokens: bigint;
        completion_tokens: bigint;
        total_cost: number;
        request_count: bigint;
        unique_users: bigint;
        model: string;
        agent_type: string | null;
      }>
    >`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM-DD') AS date,
        SUM("totalTokens")::bigint AS total_tokens,
        SUM("promptTokens")::bigint AS prompt_tokens,
        SUM("completionTokens")::bigint AS completion_tokens,
        SUM("cost")::float AS total_cost,
        COUNT(*)::bigint AS request_count,
        COUNT(DISTINCT "userId")::bigint AS unique_users,
        "model",
        "agentType" AS agent_type
      FROM "AgentTokenUsage"
      WHERE "createdAt" >= ${since}
      GROUP BY date, "model", "agentType"
      ORDER BY date ASC
    `;

    // Aggregate into daily summaries
    const dailyMap = new Map<string, any>();
    const byModel = new Map<string, number>();
    const byAgent = new Map<
      string,
      { tokens: number; requests: number; cost: number }
    >();

    for (const row of rows) {
      const date = row.date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
          requests: 0,
          uniqueUsers: 0,
        });
      }
      const d = dailyMap.get(date);
      d.totalTokens += Number(row.total_tokens);
      d.promptTokens += Number(row.prompt_tokens);
      d.completionTokens += Number(row.completion_tokens);
      d.cost += row.total_cost;
      d.requests += Number(row.request_count);
      d.uniqueUsers = Math.max(d.uniqueUsers, Number(row.unique_users));

      // By model
      const modelKey = row.model || 'unknown';
      byModel.set(
        modelKey,
        (byModel.get(modelKey) || 0) + Number(row.total_tokens),
      );

      // By agent type
      const agentKey = row.agent_type || 'unknown';
      const existing = byAgent.get(agentKey) || {
        tokens: 0,
        requests: 0,
        cost: 0,
      };
      existing.tokens += Number(row.total_tokens);
      existing.requests += Number(row.request_count);
      existing.cost += row.total_cost;
      byAgent.set(agentKey, existing);
    }

    return {
      daily: Array.from(dailyMap.values()),
      byModel: Object.fromEntries(byModel),
      byAgent: Object.fromEntries(byAgent),
    };
  }

  /**
   * 重置指标
   */
  @Delete('metrics')
  @ApiOperation({ summary: 'Reset metrics' })
  resetMetrics() {
    this.metricsService.reset();
    return { message: 'Metrics reset' };
  }

  // ==================== 追踪信息 ====================

  /**
   * 获取最近请求追踪
   */
  @Get('traces/recent')
  @ApiOperation({ summary: 'Get recent request traces' })
  getRecentTraces(@Query('limit') limit: number = 50) {
    return this.tracingService.getRecentSpans(limit);
  }

  /**
   * 获取慢请求
   */
  @Get('traces/slow')
  @ApiOperation({ summary: 'Get slow requests' })
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
  @ApiOperation({ summary: 'Get error requests' })
  getErrorTraces(@Query('limit') limit: number = 50) {
    return this.tracingService.getErrorSpans(limit);
  }

  /**
   * 获取单个 Trace
   */
  @Get('traces/:traceId')
  @ApiOperation({ summary: 'Get single trace details' })
  getTrace(@Param('traceId') traceId: string) {
    return this.tracingService.exportJaegerFormat(traceId);
  }

  // ==================== 熔断器管理 ====================

  /**
   * 获取熔断器状态
   */
  @Get('circuit-breakers')
  @ApiOperation({ summary: 'Get circuit breaker status' })
  async getCircuitBreakers() {
    return {
      llm: await this.resilience.getCircuitStatus('llm'),
      // 可扩展其他服务
    };
  }

  /**
   * 重置熔断器
   */
  @Delete('circuit-breakers/:service')
  @ApiOperation({ summary: 'Reset circuit breaker' })
  async resetCircuitBreaker(@Param('service') service: string) {
    await this.resilience.resetCircuit(service);
    return { message: 'Circuit breaker reset' };
  }

  // ==================== 健康检查 ====================

  /**
   * 系统健康状态
   */
  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  async getHealth() {
    const [llmStatus, circuitStatus] = await Promise.all([
      this.llm.getServiceStatus(),
      this.resilience.getCircuitStatus('llm'),
    ]);

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

  // ==================== 安全事件 ====================

  /**
   * 获取安全事件列表
   */
  @Get('security-events')
  @ApiOperation({ summary: 'Get security event list' })
  async getSecurityEvents(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: string,
  ) {
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const where: any = {};
    if (eventType) where.eventType = eventType;
    if (severity) where.severity = severity;
    if (resolved !== undefined && resolved !== '')
      where.resolved = resolved === 'true';

    const [data, total] = await Promise.all([
      this.prisma.agentSecurityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.agentSecurityEvent.count({ where }),
    ]);

    return { data, total, page: Number(page) || 1, pageSize: take };
  }

  /**
   * 解决安全事件
   */
  @Put('security-events/:id/resolve')
  @ApiOperation({ summary: 'Resolve security event' })
  async resolveSecurityEvent(
    @Param('id') id: string,
    @Body() body: ResolveSecurityEventDto,
  ) {
    return this.prisma.agentSecurityEvent.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        mitigationAction: `${body.action}${body.reason ? `: ${body.reason}` : ''}`,
      },
    });
  }

  // ==================== AI 审计日志 ====================

  /**
   * 获取 AI Agent 审计日志
   */
  @Get('audit-logs')
  @ApiOperation({ summary: 'Get AI Agent audit logs' })
  async getAgentAuditLogs(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 50,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const take = Math.min(Number(pageSize) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const where: any = {};
    if (action) where.action = action;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.agentAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.agentAuditLog.count({ where }),
    ]);

    return { data, total, page: Number(page) || 1, pageSize: take };
  }

  // ==================== 记忆管理 ====================

  /**
   * 全局记忆统计
   */
  @Get('memory/stats')
  @ApiOperation({ summary: 'Get global memory statistics' })
  async getMemoryStats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalMemories,
      totalConversations,
      totalMessages,
      totalEntities,
      memoryByType,
      entityByType,
      recentMemories,
      recentConversations,
      recentMessages,
      compactionCount,
      compactionAvg,
    ] = await Promise.all([
      this.prisma.memory.count(),
      this.prisma.agentConversation.count(),
      this.prisma.agentMessage.count(),
      this.prisma.entity.count(),
      this.prisma.memory.groupBy({ by: ['type'], _count: true }),
      this.prisma.entity.groupBy({ by: ['type'], _count: true }),
      this.prisma.memory.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.agentConversation.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.agentMessage.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.memoryCompaction.count(),
      this.prisma.memoryCompaction.aggregate({
        _avg: { compressionRatio: true },
      }),
    ]);

    return {
      totalMemories,
      totalConversations,
      totalMessages,
      totalEntities,
      memoryByType: Object.fromEntries(
        memoryByType.map((m) => [m.type, m._count]),
      ),
      entityByType: Object.fromEntries(
        entityByType.map((e) => [e.type, e._count]),
      ),
      recentActivity: {
        memoriesLast7Days: recentMemories,
        conversationsLast7Days: recentConversations,
        messagesLast7Days: recentMessages,
      },
      compaction: {
        totalCompactions: compactionCount,
        averageCompressionRatio: compactionAvg._avg.compressionRatio
          ? Number(compactionAvg._avg.compressionRatio)
          : 0,
      },
    };
  }

  /**
   * 用户记忆详情
   */
  @Get('memory/users/:userId/stats')
  @ApiOperation({ summary: 'Get user memory detail statistics' })
  async getUserMemoryStats(@Param('userId') userId: string) {
    return this.memoryManager.getEnhancedStats(userId);
  }

  /**
   * 浏览记忆
   */
  @Get('memory/browse')
  @ApiOperation({ summary: 'Browse memory list' })
  async browseMemories(
    @Query('userId') userId?: string,
    @Query('type') type?: MemoryType,
    @Query('category') category?: string,
    @Query('minImportance') minImportance?: number,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (category) where.category = category;
    if (minImportance !== undefined)
      where.importance = { gte: Number(minImportance) };

    const [data, total] = await Promise.all([
      this.prisma.memory.findMany({
        where,
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        select: {
          id: true,
          userId: true,
          type: true,
          category: true,
          content: true,
          importance: true,
          accessCount: true,
          lastAccessedAt: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.memory.count({ where }),
    ]);

    return { data, total, page: Number(page), pageSize: Number(pageSize) };
  }

  /**
   * 删除记忆
   */
  @Delete('memory/:memoryId')
  @ApiOperation({ summary: 'Delete single memory' })
  async deleteMemory(@Param('memoryId') memoryId: string) {
    await this.memoryManager.forget(memoryId);
    return { message: 'Memory deleted' };
  }

  /**
   * 浏览对话
   */
  @Get('memory/conversations')
  @ApiOperation({ summary: 'Browse conversation list' })
  async browseConversations(
    @Query('userId') userId?: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    const where: any = {};
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      this.prisma.agentConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: {
          messages: {
            select: { id: true },
            where: { role: { in: ['user', 'assistant'] } },
          },
        },
      }),
      this.prisma.agentConversation.count({ where }),
    ]);

    return {
      data: data.map((c) => ({
        id: c.id,
        userId: c.userId,
        title: c.title,
        summary: c.summary,
        agentType: c.agentType,
        messageCount: c.messages.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    };
  }

  /**
   * 获取对话消息
   */
  @Get('memory/conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get conversation message details' })
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
  ) {
    return this.memoryManager.getMessages(conversationId, 100);
  }

  /**
   * 浏览实体
   */
  @Get('memory/entities')
  @ApiOperation({ summary: 'Browse entity list' })
  async browseEntities(
    @Query('userId') userId?: string,
    @Query('type') type?: EntityType,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.entity.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      this.prisma.entity.count({ where }),
    ]);

    return { data, total, page: Number(page), pageSize: Number(pageSize) };
  }

  /**
   * 获取衰减配置
   */
  @Get('memory/decay/config')
  @ApiOperation({ summary: 'Get memory decay configuration' })
  getDecayConfig() {
    return this.memoryDecay.getConfig();
  }

  /**
   * 更新衰减配置
   */
  @Put('memory/decay/config')
  @ApiOperation({ summary: 'Update memory decay configuration' })
  updateDecayConfig(@Body() dto: UpdateDecayConfigDto) {
    this.memoryDecay.updateConfig(dto);
    return this.memoryDecay.getConfig();
  }

  /**
   * 获取衰减统计
   */
  @Get('memory/decay/stats')
  @ApiOperation({ summary: 'Get memory decay statistics' })
  async getDecayStats() {
    return this.memoryDecay.getDecayStats();
  }

  /**
   * 手动触发衰减
   */
  @Post('memory/decay/trigger')
  @ApiOperation({ summary: 'Manually trigger memory decay' })
  async triggerDecay() {
    return this.memoryManager.triggerDecay();
  }

  /**
   * 获取待确认冲突
   */
  @Get('memory/conflicts')
  @ApiOperation({ summary: 'Get pending memory conflicts' })
  async getMemoryConflicts(@Query('userId') userId: string) {
    return this.memoryConflict.getPendingConflicts(userId);
  }

  // ==================== 私有方法 ====================

  private async getSystemStatus() {
    const [llm, circuitBreaker] = await Promise.all([
      this.llm.getServiceStatus(),
      this.resilience.getCircuitStatus('llm'),
    ]);
    return { llm, circuitBreaker };
  }
}
