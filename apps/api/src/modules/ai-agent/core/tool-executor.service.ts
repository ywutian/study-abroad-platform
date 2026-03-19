/**
 * Tool Executor Service — Registry-based dispatch
 *
 * Collects handlers from all domain tool services on init,
 * then dispatches tool calls through a Map<string, handler> lookup.
 *
 * Features:
 * - Unified error handling
 * - Execution time tracking
 * - Metrics instrumentation
 * - Resilience (retry for retryable tools)
 * - Special delegation tool handling
 */

import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import {
  ToolCall,
  UserContext,
  ToolExecutionResult,
  AgentType,
} from '../types';
import { ToolName } from '../config/tools.config';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { ResilienceService } from './resilience.service';
import {
  IToolHandlerProvider,
  ToolHandler,
} from '../tools/tool-handler.interface';

// Domain tool services
import { ProfileToolsService } from '../tools/profile-tools.service';
import { SchoolToolsService } from '../tools/school-tools.service';
import { EssayToolsService } from '../tools/essay-tools.service';
import { RecommendationToolsService } from '../tools/recommendation-tools.service';
import { PredictionToolsService } from '../tools/prediction-tools.service';
import { CaseToolsService } from '../tools/case-tools.service';
import { TimelineToolsService } from '../tools/timeline-tools.service';
import { AssessmentToolsService } from '../tools/assessment-tools.service';
import { ForumToolsService } from '../tools/forum-tools.service';
import { RankingToolsService } from '../tools/ranking-tools.service';
import { SearchToolsService } from '../tools/search-tools.service';
import { ResumeToolsService } from '../tools/resume-tools.service';

// Retry config
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

// Non-retryable tools (write operations / non-idempotent)
const NON_RETRYABLE_TOOLS = new Set([
  ToolName.UPDATE_PROFILE,
  ToolName.POLISH_ESSAY,
  ToolName.CREATE_PERSONAL_EVENT,
]);

@Injectable()
export class ToolExecutorService implements OnModuleInit {
  private readonly logger = new Logger(ToolExecutorService.name);
  private readonly handlers = new Map<string, ToolHandler>();

  constructor(
    // Domain tool services
    private profileTools: ProfileToolsService,
    private schoolTools: SchoolToolsService,
    private essayTools: EssayToolsService,
    private recommendationTools: RecommendationToolsService,
    private predictionTools: PredictionToolsService,
    private caseTools: CaseToolsService,
    private timelineTools: TimelineToolsService,
    private assessmentTools: AssessmentToolsService,
    private forumTools: ForumToolsService,
    private rankingTools: RankingToolsService,
    private searchTools: SearchToolsService,
    private resumeTools: ResumeToolsService,
    // Infrastructure
    @Optional() private metrics?: MetricsService,
    @Optional() private resilience?: ResilienceService,
  ) {}

  onModuleInit() {
    const providers: IToolHandlerProvider[] = [
      this.profileTools,
      this.schoolTools,
      this.essayTools,
      this.recommendationTools,
      this.predictionTools,
      this.caseTools,
      this.timelineTools,
      this.assessmentTools,
      this.forumTools,
      this.rankingTools,
      this.searchTools,
      this.resumeTools,
    ];

    for (const provider of providers) {
      for (const [name, handler] of provider.getHandlers()) {
        if (this.handlers.has(name)) {
          this.logger.warn(`Duplicate tool handler registration: ${name}`);
        }
        this.handlers.set(name, handler);
      }
    }

    this.logger.log(
      `Tool registry initialized: ${this.handlers.size} tools from ${providers.length} providers`,
    );
  }

  /**
   * Execute a tool call with resilience protection.
   */
  async execute(
    toolCall: ToolCall,
    userId: string,
    context: UserContext,
    locale: string = 'zh',
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    this.logger.debug(`Executing tool: ${toolCall.name}`, {
      toolCallId: toolCall.id,
      arguments: toolCall.arguments,
    });

    try {
      // Special: delegation tool (no retry)
      if ((toolCall.name as ToolName) === ToolName.DELEGATE_TO_AGENT) {
        return this.handleDelegation(toolCall, startTime);
      }

      // Look up handler
      const handler = this.handlers.get(toolCall.name);
      if (!handler) {
        return {
          success: false,
          error: `Unknown tool: ${toolCall.name}`,
          duration: Date.now() - startTime,
        };
      }

      // Convert context for tools that use it
      const legacyContext = this.convertToLegacyContext(context, locale);

      // Execute function
      const executeCall = async () => {
        return handler(toolCall.arguments, userId, legacyContext, locale);
      };

      // Retry decision
      const shouldRetry =
        this.resilience && !NON_RETRYABLE_TOOLS.has(toolCall.name as ToolName);

      const result = shouldRetry
        ? await this.resilience!.withRetry(executeCall, TOOL_RETRY_CONFIG)
        : await executeCall();

      const duration = Date.now() - startTime;

      // Record metrics
      this.metrics?.recordToolLatency(toolCall.name, duration);

      // Check for error in result
      if (result?.error && !result?.success) {
        this.logger.warn(
          `Tool ${toolCall.name} returned error: ${result.error}`,
        );
        return { success: false, error: result.error, duration };
      }

      return { success: true, result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Tool ${toolCall.name} execution failed`, {
        error: errorMessage,
        duration,
      });

      this.metrics?.recordError('tool_execution_failed', toolCall.name);

      return { success: false, error: errorMessage, duration };
    }
  }

  /**
   * Execute multiple tool calls sequentially.
   */
  async executeAll(
    toolCalls: ToolCall[],
    userId: string,
    context: UserContext,
    locale: string = 'zh',
  ): Promise<Map<string, ToolExecutionResult>> {
    const results = new Map<string, ToolExecutionResult>();

    for (const toolCall of toolCalls) {
      const result = await this.execute(toolCall, userId, context, locale);
      results.set(toolCall.id, result);
    }

    return results;
  }

  /**
   * Handle delegation tool — returns special result for AgentRunner.
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

    const validAgents = ['essay', 'school', 'profile', 'timeline', 'resume'];
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
   * Convert UserContext to legacy context format for tool consumption.
   */
  private convertToLegacyContext(context: UserContext, locale = 'zh'): any {
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
      locale,
    };
  }

  /**
   * Check if a tool is registered.
   */
  isToolAvailable(toolName: string): boolean {
    return this.handlers.has(toolName);
  }

  /**
   * Get tool execution statistics.
   * NOTE: totalCalls and avgDuration are not tracked yet — wire MetricsService to enable.
   */
  getStats(): {
    totalCalls: number;
    avgDuration: number;
    registeredTools: number;
  } {
    return {
      totalCalls: 0,
      avgDuration: 0,
      registeredTools: this.handlers.size,
    };
  }
}
