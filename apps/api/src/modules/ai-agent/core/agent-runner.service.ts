/**
 * Agent 运行器 - 执行单个 Agent 的推理循环
 * 
 * 修复: 集成 Token 追踪、Tool 超时、请求追踪
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { LLMService } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import { MemoryService } from './memory.service';
import { ResilienceService } from './resilience.service';
import { AGENT_CONFIGS } from '../config/agents.config';
import { TOOLS } from '../config/tools.config';
import {
  AgentType,
  AgentConfig,
  ConversationState,
  Message,
  AgentResponse,
  ToolDefinition,
} from '../types';

const MAX_ITERATIONS = 8;
const TOOL_TIMEOUT_MS = 10000;  // Tool 执行超时 10s

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private llm: LLMService,
    private toolExecutor: ToolExecutorService,
    private memory: MemoryService,
    @Optional() private resilience?: ResilienceService,
  ) {}

  /**
   * 运行 Agent
   */
  async run(
    agentType: AgentType,
    conversation: ConversationState,
    initialMessage?: string,
  ): Promise<AgentResponse> {
    const config = AGENT_CONFIGS[agentType];
    const tools = this.getAgentTools(config);
    const toolsUsed: string[] = [];

    // 如果有初始消息，添加到对话
    if (initialMessage) {
      this.memory.addMessage(conversation, {
        role: 'user',
        content: initialMessage,
      });
    }

    // Agent 推理循环
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const systemPrompt = this.buildSystemPrompt(config, conversation);
      const messages = this.memory.getRecentMessages(conversation);

      // 调用 LLM (传递 userId 用于 Token 追踪)
      const response = await this.llm.call(systemPrompt, messages, {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        tools,
        userId: conversation.userId,           // Token 追踪
        conversationId: conversation.id,       // Token 追踪
        agentType: agentType,                  // Token 追踪
      });

      // 如果没有工具调用，返回最终响应
      if (!response.toolCalls?.length) {
        this.memory.addMessage(conversation, {
          role: 'assistant',
          content: response.content,
          agentType,
        });

        return this.buildResponse(agentType, response.content, toolsUsed);
      }

      // 记录 assistant 消息（包含工具调用）
      this.memory.addMessage(conversation, {
        role: 'assistant',
        content: response.content || '',
        agentType,
        toolCalls: response.toolCalls,
      });

      // 检查是否需要委派
      const delegateCall = response.toolCalls.find(tc => tc.name === 'delegate_to_agent');
      if (delegateCall) {
        return this.handleDelegation(delegateCall, conversation, toolsUsed);
      }

      // 执行工具调用 (带超时保护)
      for (const toolCall of response.toolCalls) {
        toolsUsed.push(toolCall.name);
        this.logger.debug(`Agent ${agentType} calling tool: ${toolCall.name}`);

        try {
          // 使用弹性服务包装 Tool 执行
          const executeWithTimeout = async () => {
            return this.toolExecutor.execute(
              toolCall,
              conversation.userId,
              conversation.context,
            );
          };

          const result = this.resilience
            ? await this.resilience.withTimeout(executeWithTimeout, TOOL_TIMEOUT_MS, `tool:${toolCall.name}`) as Awaited<ReturnType<typeof executeWithTimeout>>
            : await executeWithTimeout();

          // 校验结果
          const resultContent = !result?.error 
            ? JSON.stringify(result?.result)
            : JSON.stringify({ error: result.error });

          // 记录工具结果
          this.memory.addMessage(conversation, {
            role: 'tool',
            content: resultContent,
            toolCallId: toolCall.id,
          });
        } catch (error) {
          // Tool 执行失败，记录错误
          this.logger.error(`Tool ${toolCall.name} failed: ${error}`);
          this.memory.addMessage(conversation, {
            role: 'tool',
            content: JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Tool execution timeout or failed',
            }),
            toolCallId: toolCall.id,
          });
        }
      }
    }

    // 超过最大迭代
    return {
      message: '处理您的请求时遇到问题，请尝试简化问题。',
      agentType,
      toolsUsed,
    };
  }

  /**
   * 获取 Agent 可用的工具
   */
  private getAgentTools(config: AgentConfig): ToolDefinition[] {
    return TOOLS.filter(t => config.tools.includes(t.name));
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(config: AgentConfig, conversation: ConversationState): string {
    const contextSummary = this.memory.getContextSummary(conversation.context);
    
    return `${config.systemPrompt}

## 当前用户信息
${contextSummary}

## 注意事项
- 始终使用中文回复
- 如果需要用户档案信息，先调用 get_profile
- 工具返回的数据要整合成友好的回复`;
  }

  /**
   * 处理委派
   */
  private handleDelegation(
    delegateCall: any,
    conversation: ConversationState,
    toolsUsed: string[],
  ): AgentResponse {
    const { agent, task, context } = delegateCall.arguments;
    
    return {
      message: '',  // 委派时不直接返回消息
      agentType: AgentType.ORCHESTRATOR,
      toolsUsed,
      delegatedTo: agent as AgentType,
      data: { task, context },
    };
  }

  /**
   * 构建响应
   */
  private buildResponse(
    agentType: AgentType,
    message: string,
    toolsUsed: string[],
  ): AgentResponse {
    return {
      message,
      agentType,
      toolsUsed: toolsUsed.length > 0 ? [...new Set(toolsUsed)] : undefined,
      suggestions: this.extractSuggestions(message),
      actions: this.generateActions(message, agentType),
    };
  }

  /**
   * 提取建议
   */
  private extractSuggestions(message: string): string[] | undefined {
    const suggestions: string[] = [];
    const lines = message.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^[\d\-\*]\s*[\.）\)]\s*(.+)$/);
      if (match) suggestions.push(match[1].trim());
    }

    return suggestions.length > 0 ? suggestions.slice(0, 5) : undefined;
  }

  /**
   * 生成操作按钮
   */
  private generateActions(message: string, agentType: AgentType): any[] | undefined {
    const actions: any[] = [];
    const lowerMessage = message.toLowerCase();

    // 根据内容推断可能的操作
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



