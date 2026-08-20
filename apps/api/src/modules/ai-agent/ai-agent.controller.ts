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
  UnauthorizedException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { OrchestratorService } from './core/orchestrator.service';
import { TokenTrackerService } from './core/token-tracker.service';
import { RateLimiterService } from './core/rate-limiter.service';
import { LLMService } from './core/llm.service';
import { AgentThrottleGuard, SkipAgentThrottle } from './guards';
import { CurrentLocale, CurrentUser } from '../../common/decorators';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';
import type { CurrentUserPayload } from '../../common/decorators';
import { ChatDto, DirectAgentDto, RejectAgentApprovalDto } from './dto';
import type { SupportedLocale } from '@study-abroad/shared';
import { AgentRunService } from './core/agent-run.service';

@ApiTags('ai-agent')
@ApiBearerAuth()
@ThrottleAI()
@Controller('ai-agent')
@UseGuards(AgentThrottleGuard) // 统一在 Guard 层做限流和配额检查
export class AiAgentController {
  private readonly logger = new Logger(AiAgentController.name);

  constructor(
    private orchestrator: OrchestratorService,
    private tokenTracker: TokenTrackerService,
    private rateLimiter: RateLimiterService,
    private llm: LLMService,
    private agentRuns: AgentRunService,
  ) {}

  /**
   * 与 AI Agent 对话（自动路由）
   */
  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI Agent' })
  async chat(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentLocale() locale: SupportedLocale,
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

      // Detect client disconnect to stop wasting LLM tokens
      let clientDisconnected = false;
      res.on('close', () => {
        clientDisconnected = true;
      });

      try {
        for await (const event of this.orchestrator.handleMessageStream(
          user.id,
          data.message,
          data.conversationId,
          locale,
          data.context,
          data.agentHint,
        )) {
          if (clientDisconnected) {
            this.logger.debug(
              `SSE client disconnected mid-stream [user=${user.id}]`,
            );
            if (this.agentRuns.isEnabled()) continue;
            break;
          }
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch {
        if (!clientDisconnected) {
          res.write(
            `data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`,
          );
        }
      }

      if (!clientDisconnected) {
        res.write('data: [DONE]\n\n');
      }
      res.end();
      return;
    }

    // Harness approval mode shares the exact streaming lifecycle even when the
    // caller requests a single JSON response, so protected actions can pause.
    if (this.agentRuns.isEnabled()) {
      let response: unknown;
      let approval: unknown;
      let runId: string | undefined;
      for await (const event of this.orchestrator.handleMessageStream(
        user.id,
        data.message,
        data.conversationId,
        locale,
        data.context,
        data.agentHint,
      )) {
        runId = event.runId || runId;
        if (event.type === 'done') response = event.response;
        if (event.type === 'approval_required') approval = event.approval;
      }
      res.json(
        approval
          ? {
              message: 'This action requires confirmation.',
              runId,
              approvalRequired: approval,
            }
          : response,
      );
      return;
    }

    // 普通请求
    const result = await this.orchestrator.handleMessage(
      user.id,
      data.message,
      data.conversationId,
      locale,
      data.context,
      data.agentHint,
    );
    res.json(result);
  }

  @Get('runs/:runId')
  @SkipAgentThrottle()
  @ApiOperation({ summary: 'Get an Agent run and its current approval state' })
  getRun(
    @CurrentUser() user: CurrentUserPayload,
    @Param('runId') runId: string,
  ) {
    return this.agentRuns.getRunSummary(user.id, runId);
  }

  @Post('runs/:runId/approvals/:approvalId/approve')
  @SkipAgentThrottle()
  @ApiOperation({ summary: 'Approve the exact pending Agent tool call' })
  approveRun(
    @CurrentUser() user: CurrentUserPayload,
    @Param('runId') runId: string,
    @Param('approvalId') approvalId: string,
  ) {
    return this.agentRuns.approve(user.id, runId, approvalId);
  }

  @Post('runs/:runId/approvals/:approvalId/reject')
  @SkipAgentThrottle()
  @ApiOperation({ summary: 'Reject a pending Agent tool call' })
  rejectRun(
    @CurrentUser() user: CurrentUserPayload,
    @Param('runId') runId: string,
    @Param('approvalId') approvalId: string,
    @Body() data: RejectAgentApprovalDto,
  ) {
    return this.agentRuns.reject(user.id, runId, approvalId, data.reason);
  }

  @Post('runs/:runId/cancel')
  @SkipAgentThrottle()
  @ApiOperation({ summary: 'Cancel a running or approval-waiting Agent run' })
  cancelRun(
    @CurrentUser() user: CurrentUserPayload,
    @Param('runId') runId: string,
  ) {
    return this.agentRuns.cancel(user.id, runId);
  }

  @Post('runs/:runId/resume')
  @SkipAgentThrottle()
  @ApiOperation({ summary: 'Resume an approved Agent run as an SSE stream' })
  async resumeRun(
    @CurrentUser() user: CurrentUserPayload,
    @Param('runId') runId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let disconnected = false;
    res.on('close', () => {
      disconnected = true;
    });
    try {
      for await (const event of this.orchestrator.resumeRunStream(
        user.id,
        runId,
      )) {
        // Once an approved side effect is claimed, keep consuming the workflow
        // even if the client disconnects. Reconnects read the durable result.
        if (!disconnected) res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      await this.agentRuns.failRun(
        user.id,
        runId,
        'RESUME_STREAM_ABORTED',
        error instanceof Error ? error.message : 'Resume failed',
      );
      if (!disconnected) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            runId,
            error: error instanceof Error ? error.message : 'Resume failed',
          })}\n\n`,
        );
      }
    }
    if (!disconnected) res.write('data: [DONE]\n\n');
    res.end();
  }

  /**
   * 直接调用特定 Agent
   */
  @Post('agent')
  @ApiOperation({ summary: 'Directly call a specific Agent' })
  async callAgent(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentLocale() locale: SupportedLocale,
    @Body() data: DirectAgentDto,
  ) {
    this.logger.log(
      `POST /agent received: userId=${user?.id}, agent=${data.agent}`,
    );

    if (!user?.id) {
      this.logger.error('No user ID in request - authentication issue');
      throw new UnauthorizedException('Authentication required');
    }

    return this.orchestrator.callAgent(
      user.id,
      data.agent,
      data.message,
      data.conversationId,
      locale,
      data.context,
      data.agentHint,
    );
  }

  /**
   * 获取对话列表
   */
  @Get('conversations')
  @ApiOperation({ summary: 'Get conversation list' })
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
  @ApiOperation({ summary: 'Get conversation history' })
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
  @ApiOperation({ summary: 'Clear conversation' })
  clearConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Query('conversationId') conversationId?: string,
  ) {
    void this.orchestrator.clearConversation(user.id, conversationId);
    return { success: true };
  }

  /**
   * 刷新用户上下文
   */
  @Post('refresh-context')
  @ApiOperation({ summary: 'Refresh user context' })
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
  @ApiOperation({ summary: 'Get token usage statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns user token usage statistics',
  })
  async getUsage(@CurrentUser() user: CurrentUserPayload) {
    return this.tokenTracker.getUsageStats(user.id);
  }

  /**
   * 获取限流状态
   */
  @Get('rate-limit')
  @SkipAgentThrottle()
  @ApiOperation({ summary: 'Get current rate limit status' })
  getRateLimit(@CurrentUser() user: CurrentUserPayload) {
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
  @ApiOperation({ summary: 'Check usage quota' })
  async checkQuota(@CurrentUser() user: CurrentUserPayload) {
    return this.tokenTracker.checkQuota(user.id);
  }

  /**
   * 服务健康状态
   */
  @Get('health')
  @SkipAgentThrottle()
  @ApiOperation({ summary: 'Get AI Agent service health status' })
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
