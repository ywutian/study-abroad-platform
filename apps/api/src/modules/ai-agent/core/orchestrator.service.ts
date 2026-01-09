/**
 * 协调者服务 - 管理多 Agent 协作（支持流式输出）
 * 
 * 集成企业级记忆系统、弹性保护、限流、快速路由
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRunnerService } from './agent-runner.service';
import { MemoryService } from './memory.service';
import { LLMService, StreamChunk } from './llm.service';
import { ToolExecutorService } from './tool-executor.service';
import { MemoryManagerService } from '../memory';
import { FastRouterService } from './fast-router.service';
import { FallbackService } from './fallback.service';
import { AGENT_CONFIGS } from '../config/agents.config';
import { TOOLS } from '../config/tools.config';
import { AgentType, AgentResponse, ConversationState, ToolDefinition } from '../types';

export interface StreamEvent {
  type: 'start' | 'content' | 'tool_start' | 'tool_end' | 'agent_switch' | 'done' | 'error';
  agent?: AgentType;
  content?: string;
  tool?: string;
  toolResult?: any;
  response?: AgentResponse;
  error?: string;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  private readonly maxDelegationDepth: number;

  constructor(
    private agentRunner: AgentRunnerService,
    private memory: MemoryService,
    private llm: LLMService,
    private toolExecutor: ToolExecutorService,
    private configService: ConfigService,
    @Optional() private memoryManager?: MemoryManagerService,
    @Optional() private fastRouter?: FastRouterService,
    @Optional() private fallback?: FallbackService,
  ) {
    this.maxDelegationDepth = this.configService.get<number>('AGENT_MAX_DELEGATION_DEPTH', 3);
  }

  /**
   * 处理用户消息
   * 
   * 注: 限流和配额检查已在 Guard 层完成
   */
  async handleMessage(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<AgentResponse> {
    try {
      // 1. 快速路由检查 (减少 LLM 调用)
      if (this.fastRouter) {
        // 简单问答直接回复
        const simpleResponse = this.fastRouter.getSimpleResponse(message);
        if (simpleResponse) {
          return {
            message: simpleResponse,
            agentType: AgentType.ORCHESTRATOR,
            data: { fastRoute: true },
          };
        }

        // 尝试快速路由到专业 Agent
        const routeResult = this.fastRouter.route(message);
        if (!routeResult.shouldUseLLM && routeResult.agent) {
          this.logger.debug(`Fast route to ${routeResult.agent} (confidence: ${routeResult.confidence})`);
          
          const conversation = await this.memory.getOrCreateConversation(userId, conversationId);
          this.memory.addMessage(conversation, { role: 'user', content: message });
          
          return this.agentRunner.run(routeResult.agent, conversation, message);
        }
      }

      // 2. 正常处理流程
      const conversation = await this.memory.getOrCreateConversation(userId, conversationId);

      let response = await this.agentRunner.run(
        AgentType.ORCHESTRATOR,
        conversation,
        message,
      );

      // 3. 处理委派
      let delegationDepth = 0;

      while (response.delegatedTo && delegationDepth < this.maxDelegationDepth) {
        delegationDepth++;
        this.logger.debug(`Delegating to ${response.delegatedTo}`);

        const task = response.data?.task || message;
        
        this.memory.addMessage(conversation, {
          role: 'system',
          content: `[委派给 ${response.delegatedTo} 处理: ${task}]`,
        });

        response = await this.agentRunner.run(
          response.delegatedTo,
          conversation,
          task,
        );
      }

      return response;

    } catch (error) {
      // 4. 错误处理与降级
      if (this.fallback) {
        return this.fallback.getFallbackResponse(
          error instanceof Error ? error : new Error(String(error)),
          undefined,
          { userId, conversationId, userMessage: message },
        );
      }
      throw error;
    }
  }

  /**
   * 直接调用特定 Agent
   */
  async callAgent(
    userId: string,
    agentType: AgentType,
    message: string,
    conversationId?: string,
  ): Promise<AgentResponse> {
    const conversation = await this.memory.getOrCreateConversation(userId, conversationId);
    return this.agentRunner.run(agentType, conversation, message);
  }

  /**
   * 获取对话历史
   */
  async getHistory(userId: string, conversationId?: string) {
    const conversation = await this.memory.getOrCreateConversation(userId, conversationId);
    
    return conversation.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role,
        content: m.content,
        agentType: m.agentType,
        timestamp: m.timestamp,
      }));
  }

  /**
   * 清除对话
   */
  clearConversation(userId: string, conversationId?: string) {
    this.memory.clearConversation(userId, conversationId);
  }

  /**
   * 刷新用户上下文
   */
  async refreshContext(userId: string) {
    return this.memory.refreshUserContext(userId);
  }

  /**
   * 流式处理用户消息
   * 
   * 注: 限流和配额检查已在 Guard 层完成
   */
  async *handleMessageStream(
    userId: string,
    message: string,
    conversationId?: string,
  ): AsyncGenerator<StreamEvent> {
    // 1. 快速路由 (减少 LLM 调用)
    if (this.fastRouter) {
      const simpleResponse = this.fastRouter.getSimpleResponse(message);
      if (simpleResponse) {
        yield { type: 'start', agent: AgentType.ORCHESTRATOR };
        yield { type: 'content', agent: AgentType.ORCHESTRATOR, content: simpleResponse };
        yield {
          type: 'done',
          agent: AgentType.ORCHESTRATOR,
          response: { message: simpleResponse, agentType: AgentType.ORCHESTRATOR },
        };
        return;
      }

      const routeResult = this.fastRouter.route(message);
      if (!routeResult.shouldUseLLM && routeResult.agent) {
        const conversation = await this.memory.getOrCreateConversation(userId, conversationId);
        this.memory.addMessage(conversation, { role: 'user', content: message });
        
        yield { type: 'start', agent: routeResult.agent };
        yield* this.runAgentStream(routeResult.agent, conversation);
        return;
      }
    }

    // 2. 正常流程
    const conversation = await this.memory.getOrCreateConversation(userId, conversationId);
    this.memory.addMessage(conversation, { role: 'user', content: message });

    yield { type: 'start', agent: AgentType.ORCHESTRATOR };

    try {
      yield* this.runAgentStream(AgentType.ORCHESTRATOR, conversation);
    } catch (error) {
      // 错误降级
      if (this.fallback) {
        const fallbackResponse = this.fallback.getFallbackResponse(
          error instanceof Error ? error : new Error(String(error)),
        );
        yield { type: 'error', error: fallbackResponse.message };
        yield { type: 'done', response: fallbackResponse };
      } else {
        yield { type: 'error', error: error instanceof Error ? error.message : '处理失败' };
      }
    }
  }

  /**
   * 流式运行 Agent
   */
  private async *runAgentStream(
    agentType: AgentType,
    conversation: ConversationState,
    depth: number = 0,
  ): AsyncGenerator<StreamEvent> {
    if (depth > this.maxDelegationDepth) {
      yield { type: 'error', error: '委派层级过深' };
      return;
    }

    const config = AGENT_CONFIGS[agentType];
    const tools = TOOLS.filter(t => config.tools.includes(t.name));
    // 使用记忆增强的 System Prompt
    const lastUserMessage = conversation.messages.findLast(m => m.role === 'user')?.content;
    const systemPrompt = await this.buildSystemPrompt(config, conversation, lastUserMessage);
    const messages = this.memory.getRecentMessages(conversation);

    let fullContent = '';
    const pendingToolCalls: any[] = [];

    // 流式调用 LLM
    for await (const chunk of this.llm.callStream(systemPrompt, messages, {
      model: config.model,
      temperature: config.temperature,
      tools,
    })) {
      if (chunk.type === 'content' && chunk.content) {
        fullContent += chunk.content;
        yield { type: 'content', agent: agentType, content: chunk.content };
      }

      if (chunk.type === 'tool_call' && chunk.toolCall) {
        pendingToolCalls.push(chunk.toolCall);
      }

      if (chunk.type === 'error') {
        yield { type: 'error', error: chunk.error };
        return;
      }

      if (chunk.type === 'done') {
        break;
      }
    }

    // 如果没有工具调用，完成
    if (pendingToolCalls.length === 0) {
      this.memory.addMessage(conversation, {
        role: 'assistant',
        content: fullContent,
        agentType,
      });

      yield {
        type: 'done',
        agent: agentType,
        response: {
          message: fullContent,
          agentType,
          suggestions: this.extractSuggestions(fullContent),
          actions: this.generateActions(fullContent),
        },
      };
      return;
    }

    // 记录 assistant 消息
    this.memory.addMessage(conversation, {
      role: 'assistant',
      content: fullContent || '',
      agentType,
      toolCalls: pendingToolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments || {},
      })),
    });

    // 检查委派
    const delegateCall = pendingToolCalls.find(tc => tc.name === 'delegate_to_agent');
    if (delegateCall) {
      const targetAgent = delegateCall.arguments?.agent as AgentType;
      const task = delegateCall.arguments?.task || '';
      
      yield { type: 'agent_switch', agent: targetAgent };
      
      this.memory.addMessage(conversation, {
        role: 'tool',
        content: JSON.stringify({ delegated: true, to: targetAgent }),
        toolCallId: delegateCall.id,
      });

      // 添加任务到对话
      if (task) {
        this.memory.addMessage(conversation, {
          role: 'user',
          content: task,
        });
      }

      yield* this.runAgentStream(targetAgent, conversation, depth + 1);
      return;
    }

    // 执行工具调用
    for (const toolCall of pendingToolCalls) {
      yield { type: 'tool_start', agent: agentType, tool: toolCall.name };

      const result = await this.toolExecutor.execute(
        { id: toolCall.id, name: toolCall.name, arguments: toolCall.arguments || {} },
        conversation.userId,
        conversation.context,
      );

      this.memory.addMessage(conversation, {
        role: 'tool',
        content: JSON.stringify(result.result),
        toolCallId: toolCall.id,
      });

      yield { type: 'tool_end', agent: agentType, tool: toolCall.name, toolResult: result.result };
    }

    // 继续推理
    yield* this.runAgentStream(agentType, conversation, depth);
  }

  /**
   * 构建 System Prompt（自动选择是否使用记忆增强）
   */
  private async buildSystemPrompt(
    config: any, 
    conversation: ConversationState,
    currentMessage?: string,
  ): Promise<string> {
    const baseSummary = this.memory.getContextSummary(conversation.context);
    
    // 如果没有记忆管理器或没有消息，使用基础提示
    if (!this.memoryManager || !currentMessage) {
      return `${config.systemPrompt}\n\n## 当前用户信息\n${baseSummary}`;
    }

    try {
      // 获取增强上下文
      const context = await this.memoryManager.getRetrievalContext(
        conversation.userId,
        currentMessage,
        conversation.id,
      );

      const enhancedContext = this.memoryManager.buildContextSummary(context);

      return `${config.systemPrompt}

## 当前用户信息
${baseSummary}

## 记忆上下文
${enhancedContext}`;
    } catch (error) {
      this.logger.error('Failed to build enhanced context', error);
      return `${config.systemPrompt}\n\n## 当前用户信息\n${baseSummary}`;
    }
  }

  /**
   * 使用企业级记忆系统处理消息
   */
  async handleMessageWithMemory(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<AgentResponse> {
    if (!this.memoryManager) {
      return this.handleMessage(userId, message, conversationId);
    }

    // 使用企业级记忆管理器
    const conv = await this.memoryManager.getOrCreateConversation(userId, conversationId);

    // 添加用户消息
    await this.memoryManager.addMessage(conv.id, {
      role: 'user',
      content: message,
    });

    // 获取原有对话状态（兼容旧系统）
    const conversation = await this.memory.getOrCreateConversation(userId, conv.id);
    this.memory.addMessage(conversation, { role: 'user', content: message });

    // 处理消息
    const response = await this.handleMessage(userId, message, conv.id);

    // 保存 assistant 响应
    await this.memoryManager.addMessage(conv.id, {
      role: 'assistant',
      content: response.message,
      agentType: response.agentType,
    });

    return response;
  }

  /**
   * 获取对话历史（企业级）
   */
  async getConversationHistory(conversationId: string): Promise<any[]> {
    if (this.memoryManager) {
      return this.memoryManager.getConversationHistory(conversationId);
    }
    return [];
  }

  /**
   * 获取用户记忆统计
   */
  async getMemoryStats(userId: string): Promise<any> {
    if (this.memoryManager) {
      return this.memoryManager.getStats(userId);
    }
    return null;
  }

  private extractSuggestions(message: string): string[] | undefined {
    const suggestions: string[] = [];
    const lines = message.split('\n');
    for (const line of lines) {
      const match = line.match(/^[\d\-\*]\s*[\.）\)]\s*(.+)$/);
      if (match) suggestions.push(match[1].trim());
    }
    return suggestions.length > 0 ? suggestions.slice(0, 5) : undefined;
  }

  private generateActions(message: string): any[] | undefined {
    const actions: any[] = [];
    const lower = message.toLowerCase();
    if (lower.includes('档案')) actions.push({ label: '完善档案', action: 'navigate:/profile' });
    if (lower.includes('文书')) actions.push({ label: '文书管理', action: 'navigate:/essays' });
    if (lower.includes('学校') || lower.includes('排名')) actions.push({ label: '查看排名', action: 'navigate:/ranking' });
    return actions.length > 0 ? actions : undefined;
  }
}

