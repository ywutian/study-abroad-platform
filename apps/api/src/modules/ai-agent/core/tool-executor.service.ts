/**
 * 工具执行器服务 - 适配层
 *
 * 封装旧架构的 ToolExecutor，添加：
 * - 统一的错误处理
 * - 执行时间追踪
 * - Metrics 埋点
 * - 超时保护
 * - 重试机制
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ToolExecutor as LegacyToolExecutor } from '../../ai/agent/tools.executor';
import {
  ToolCall,
  UserContext,
  ToolExecutionResult,
  AgentType,
} from '../types';
import { ToolName } from '../config/tools.config';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { ResilienceService } from './resilience.service';

// 工具重试配置
const TOOL_RETRY_CONFIG = {
  maxAttempts: 2,
  baseDelayMs: 500,
  maxDelayMs: 2000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    '500',
    '502',
    '503',
    '504',
  ],
};

// 不需要重试的工具（幂等性问题）
const NON_RETRYABLE_TOOLS = new Set([
  ToolName.UPDATE_PROFILE,
  ToolName.POLISH_ESSAY,
  ToolName.CREATE_PERSONAL_EVENT,
]);

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private legacyExecutor: LegacyToolExecutor,
    @Optional() private metrics?: MetricsService,
    @Optional() private resilience?: ResilienceService,
  ) {}

  /**
   * 执行工具调用（带重试）
   */
  async execute(
    toolCall: ToolCall,
    userId: string,
    context: UserContext,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    this.logger.debug(`Executing tool: ${toolCall.name}`, {
      toolCallId: toolCall.id,
      arguments: toolCall.arguments,
    });

    try {
      // 特殊处理委派工具（无需重试）
      if (toolCall.name === ToolName.DELEGATE_TO_AGENT) {
        return this.handleDelegation(toolCall, startTime);
      }

      // 转换上下文格式
      const legacyContext = this.convertToLegacyContext(context);

      // 执行函数
      const executeCall = async () => {
        return this.legacyExecutor.execute(
          toolCall.name,
          toolCall.arguments,
          userId,
          legacyContext,
        );
      };

      // 判断是否需要重试
      const shouldRetry =
        this.resilience && !NON_RETRYABLE_TOOLS.has(toolCall.name as ToolName);

      // 调用执行器（带重试或直接执行）
      const result = shouldRetry
        ? await this.resilience!.withRetry(executeCall, TOOL_RETRY_CONFIG)
        : await executeCall();

      const duration = Date.now() - startTime;

      // 记录 Metrics
      this.metrics?.recordToolLatency(toolCall.name, duration);

      // 检查执行结果
      if (result.error) {
        this.logger.warn(
          `Tool ${toolCall.name} returned error: ${result.error}`,
        );
        return {
          success: false,
          error: result.error,
          duration,
        };
      }

      return {
        success: true,
        result: result.result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Tool ${toolCall.name} execution failed`, {
        error: errorMessage,
        duration,
      });

      this.metrics?.recordError('tool_execution_failed', toolCall.name);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * 批量执行工具调用
   */
  async executeAll(
    toolCalls: ToolCall[],
    userId: string,
    context: UserContext,
  ): Promise<Map<string, ToolExecutionResult>> {
    const results = new Map<string, ToolExecutionResult>();

    // 串行执行，确保顺序和状态一致性
    for (const toolCall of toolCalls) {
      const result = await this.execute(toolCall, userId, context);
      results.set(toolCall.id, result);
    }

    return results;
  }

  /**
   * 处理委派工具 - 返回特殊结果让 AgentRunner 处理
   */
  private handleDelegation(
    toolCall: ToolCall,
    startTime: number,
  ): ToolExecutionResult {
    const args = toolCall.arguments as {
      agent?: string;
      task?: string;
      context?: unknown;
    };
    const { agent, task, context: delegationContext } = args;

    // 验证目标 Agent
    const validAgents = ['essay', 'school', 'profile', 'timeline'];
    if (!agent || !validAgents.includes(agent)) {
      return {
        success: false,
        error: `Invalid agent: ${agent}. Valid agents: ${validAgents.join(', ')}`,
        duration: Date.now() - startTime,
      };
    }

    return {
      success: true,
      result: {
        _delegation: true,
        targetAgent: agent as AgentType,
        task,
        context: delegationContext,
      },
      duration: Date.now() - startTime,
    };
  }

  /**
   * 转换为旧架构上下文格式
   */
  private convertToLegacyContext(context: UserContext): any {
    return {
      profile: context.profile
        ? {
            gpa: context.profile.gpa,
            gpaScale: context.profile.gpaScale,
            testScores: context.profile.testScores,
            targetMajor: context.profile.targetMajor,
            targetSchools: context.profile.targetSchools,
            budgetTier: context.profile.budgetTier,
          }
        : undefined,
      preferences: context.preferences
        ? {
            schoolSize: context.preferences.schoolSize,
            location: context.preferences.location,
            climate: context.preferences.climate,
          }
        : undefined,
    };
  }

  /**
   * 检查工具是否存在
   */
  isToolAvailable(toolName: string): boolean {
    return Object.values(ToolName).includes(toolName as ToolName);
  }

  /**
   * 获取工具执行统计
   */
  getStats(): { totalCalls: number; avgDuration: number } {
    // 可以从 MetricsService 获取，这里返回简单统计
    return {
      totalCalls: 0,
      avgDuration: 0,
    };
  }
}
