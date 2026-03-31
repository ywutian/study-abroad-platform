/**
 * Agent 运行器 - 基于三阶段工作流引擎
 *
 * 重构：从 ReAct 循环模式升级为 ReWOO 三阶段工作流
 *   Phase 1: PLAN   — LLM 一次性规划所有工具调用
 *   Phase 2: EXECUTE — 按计划执行（不调用 LLM，杜绝重复）
 *   Phase 3: SOLVE   — LLM 综合结果生成最终回复
 *
 * 集成: Token 追踪、Tool 超时、请求追踪
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  WorkflowEngineService,
  WorkflowResult,
} from './workflow-engine.service';
import { MemoryService } from './memory.service';
import { AGENT_CONFIGS } from '../config/agents.config';
import { ConfigValidatorService } from '../config/config-validator.service';
import { TOOLS } from '../config/tools.config';
import {
  AgentType,
  AgentConfig,
  ConversationState,
  AgentResponse,
  ToolDefinition,
} from '../types';
import { ActionSuggestion } from './types';

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private workflow: WorkflowEngineService,
    private memory: MemoryService,
    @Optional() private configValidator?: ConfigValidatorService,
  ) {}

  /**
   * 运行 Agent（非流式）
   *
   * 使用三阶段工作流引擎：Plan → Execute → Solve
   */
  async run(
    agentType: AgentType,
    conversation: ConversationState,
  ): Promise<AgentResponse> {
    const config =
      this.configValidator?.getValidatedConfig(agentType) ??
      AGENT_CONFIGS[agentType];

    // 配置缺失时返回降级响应
    if (!config) {
      this.logger.error(`Agent configuration missing`, {
        agentType,
        availableAgents: Object.keys(AGENT_CONFIGS),
        conversationId: conversation.id,
        userId: conversation.userId,
      });

      return {
        message:
          '抱歉，AI 助手服务配置出现问题，请稍后再试。如果问题持续，请联系客服。',
        agentType: AgentType.ORCHESTRATOR,
        data: {
          fallback: true,
          errorCode: 'CONFIG_NOT_FOUND',
          requestedAgent: agentType,
        },
      };
    }

    const tools = this.getAgentTools(config);

    // 运行三阶段工作流
    const result = await this.workflow.run(
      agentType,
      config,
      conversation,
      tools,
    );

    this.logger.log(
      `[${agentType}] Workflow completed: ` +
        `plan=${result.timing.planMs}ms, ` +
        `execute=${result.timing.executeMs}ms, ` +
        `solve=${result.timing.solveMs}ms, ` +
        `total=${result.timing.totalMs}ms, ` +
        `tools=[${result.toolsUsed.join(', ')}]`,
    );

    // 处理委派
    if (result.delegation) {
      return this.handleDelegation(result, agentType);
    }

    return this.buildResponse(agentType, result);
  }

  /**
   * 获取 Agent 可用的工具
   */
  private getAgentTools(config: AgentConfig): ToolDefinition[] {
    return TOOLS.filter((t) => config.tools.includes(t.name));
  }

  /**
   * 处理委派
   */
  private handleDelegation(
    result: WorkflowResult,
    currentAgent: AgentType,
  ): AgentResponse {
    const delegation = result.delegation!;

    return {
      message: '',
      agentType: currentAgent,
      toolsUsed: result.toolsUsed.length > 0 ? result.toolsUsed : undefined,
      delegatedTo: delegation.targetAgent,
      data: {
        task: delegation.task,
        context: delegation.context,
      },
    };
  }

  /**
   * 构建响应
   */
  private buildResponse(
    agentType: AgentType,
    result: WorkflowResult,
  ): AgentResponse {
    return {
      message: result.message,
      agentType,
      toolsUsed: result.toolsUsed.length > 0 ? result.toolsUsed : undefined,
      suggestions: this.extractSuggestions(result.message),
      actions: this.generateActions(result.message, agentType),
      data: {
        workflow: {
          timing: result.timing,
          steps: result.plan.steps.map((s) => ({
            tool: s.toolCall.name,
            status: s.status,
            duration: s.duration,
          })),
        },
      },
    };
  }

  /**
   * 提取建议
   */
  private extractSuggestions(message: string): string[] | undefined {
    const suggestions: string[] = [];
    const lines = message.split('\n');

    for (const line of lines) {
      const match = line.match(/^[\d\-*]\s*[.）)]\s*(.+)$/);
      if (match) suggestions.push(match[1].trim());
    }

    return suggestions.length > 0 ? suggestions.slice(0, 5) : undefined;
  }

  /**
   * 生成操作按钮
   */
  private generateActions(
    message: string,
    _agentType: AgentType,
  ): ActionSuggestion[] | undefined {
    const actions: ActionSuggestion[] = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('档案') || lowerMessage.includes('profile')) {
      actions.push({ label: '完善档案', action: 'navigate:/profile' });
    }
    if (lowerMessage.includes('文书') || lowerMessage.includes('essay')) {
      actions.push({ label: '文书管理', action: 'navigate:/essays' });
    }
    if (lowerMessage.includes('学校') || lowerMessage.includes('排名')) {
      actions.push({ label: '查看排名', action: 'navigate:/ranking' });
    }

    return actions.length > 0 ? actions : undefined;
  }
}
