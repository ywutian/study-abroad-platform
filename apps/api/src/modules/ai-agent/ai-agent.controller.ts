/**
 * AI Agent API 控制器（支持 SSE 流式输出）
 *
 * 功能特性:
 * - 流式/非流式对话
 * - 限流与配额保护 (Guard 层)
 * - 使用量监控
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { OrchestratorService, StreamEvent } from './core/orchestrator.service';
import { TokenTrackerService } from './core/token-tracker.service';
import { RateLimiterService } from './core/rate-limiter.service';
import { LLMService } from './core/llm.service';
import { AgentThrottleGuard, SkipAgentThrottle } from './guards';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { AgentType } from './types';

class ChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @IsOptional()
  @IsString()
  locale?: string;
}

class DirectAgentDto {
  @IsEnum(AgentType)
  agent: AgentType;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

@ApiTags('ai-agent')
@ApiBearerAuth()
@Controller('ai-agent')
@UseGuards(AgentThrottleGuard) // 统一在 Guard 层做限流和配额检查
export class AiAgentController {
  private readonly logger = new Logger(AiAgentController.name);

  constructor(
    private orchestrator: OrchestratorService,
    private tokenTracker: TokenTrackerService,
    private rateLimiter: RateLimiterService,
    private llm: LLMService,
  ) {}

  /**
   * 与 AI Agent 对话（自动路由）
   */
  @Post('chat')
  @ApiOperation({ summary: '与 AI Agent 对话' })
  async chat(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ChatDto,
    @Res() res: Response,
  ) {
    // 流式输出
    if (data.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      try {
        for await (const event of this.orchestrator.handleMessageStream(
          user.id,
          data.message,
          data.conversationId,
          data.locale,
        )) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`,
        );
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 普通请求
    const result = await this.orchestrator.handleMessage(
      user.id,
      data.message,
      data.conversationId,
      data.locale,
    );
    res.json(result);
  }

  /**
   * 直接调用特定 Agent
   */
  @Post('agent')
  @ApiOperation({ summary: '直接调用特定 Agent' })
  async callAgent(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: DirectAgentDto,
  ) {
    this.logger.log(
      `POST /agent received: userId=${user?.id}, agent=${data.agent}`,
    );

    if (!user?.id) {
      this.logger.error('No user ID in request - authentication issue');
      throw new Error('Authentication required');
    }

    return this.orchestrator.callAgent(
      user.id,
      data.agent,
      data.message,
      data.conversationId,
      data.locale,
    );
  }

  /**
   * 获取对话列表
   */
  @Get('conversations')
  @ApiOperation({ summary: '获取对话列表' })
  async getConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: number,
  ) {
    return {
      conversations: await this.orchestrator.getConversations(
        user.id,
        limit ? Number(limit) : undefined,
      ),
    };
  }

  /**
   * 获取对话历史
   */
  @Get('history')
  @ApiOperation({ summary: '获取对话历史' })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('conversationId') conversationId?: string,
  ) {
    return {
      messages: await this.orchestrator.getHistory(user.id, conversationId),
    };
  }

  /**
   * 清除对话
   */
  @Delete('conversation')
  @ApiOperation({ summary: '清除对话' })
  async clearConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Query('conversationId') conversationId?: string,
  ) {
    this.orchestrator.clearConversation(user.id, conversationId);
    return { success: true };
  }

  /**
   * 刷新用户上下文
   */
  @Post('refresh-context')
  @ApiOperation({ summary: '刷新用户上下文' })
  async refreshContext(@CurrentUser() user: CurrentUserPayload) {
    await this.orchestrator.refreshContext(user.id);
    return { success: true };
  }

  // ==================== 监控接口 ====================

  // ==================== 监控接口 (跳过限流) ====================

  /**
   * 获取用户使用统计
   */
  @Get('usage')
  @SkipAgentThrottle()
  @ApiOperation({ summary: '获取 Token 使用统计' })
  @ApiResponse({ status: 200, description: '返回用户的 Token 使用统计' })
  async getUsage(@CurrentUser() user: CurrentUserPayload) {
    return this.tokenTracker.getUsageStats(user.id);
  }

  /**
   * 获取限流状态
   */
  @Get('rate-limit')
  @SkipAgentThrottle()
  @ApiOperation({ summary: '获取当前限流状态' })
  async getRateLimit(@CurrentUser() user: CurrentUserPayload) {
    return {
      user: this.rateLimiter.getStatus(user.id, 'user'),
      conversation: this.rateLimiter.getStatus(user.id, 'conversation'),
    };
  }

  /**
   * 检查配额
   */
  @Get('quota')
  @SkipAgentThrottle()
  @ApiOperation({ summary: '检查使用配额' })
  async checkQuota(@CurrentUser() user: CurrentUserPayload) {
    return this.tokenTracker.checkQuota(user.id);
  }

  /**
   * 服务健康状态
   */
  @Get('health')
  @SkipAgentThrottle()
  @ApiOperation({ summary: '获取 AI Agent 服务健康状态' })
  @HttpCode(HttpStatus.OK)
  async health() {
    const llmStatus = await this.llm.getServiceStatus();
    return {
      status: llmStatus.isHealthy ? 'healthy' : 'degraded',
      llm: llmStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
