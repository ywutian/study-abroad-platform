/**
 * 留学申请 AI Agent 核心服务
 * 
 * 架构设计:
 * 1. ReAct 模式: Reasoning + Acting
 * 2. 多轮对话支持，维护上下文
 * 3. 工具调用能力 (Function Calling)
 * 4. 任务规划和执行
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolExecutor } from './tools.executor';
import { getToolDefinitions, toOpenAITools, AGENT_TOOLS } from './tools.registry';
import {
  AgentTool,
  AgentMessage,
  AgentState,
  AgentContext,
  AgentResponse,
  AgentConfig,
  ToolCall,
} from './agent.types';

const DEFAULT_CONFIG: AgentConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4000,
  maxIterations: 10,
  tools: Object.values(AgentTool),
};

const SYSTEM_PROMPT = `你是「Study Abroad Assistant」，一位专业、友好的留学申请 AI 顾问。

## 你的能力
1. **档案分析**: 评估学生背景，找出优势和不足
2. **选校指导**: 根据学生条件推荐冲刺/匹配/保底校
3. **文书辅导**: 评估文书、生成大纲、润色、提供灵感
4. **时间规划**: 制定申请时间线，提醒截止日期
5. **案例参考**: 搜索类似背景的录取案例

## 工作方式
- 当需要获取信息时，使用工具而不是猜测
- 主动询问缺失的关键信息
- 给出具体、可操作的建议
- 保持对话的连贯性，记住之前讨论的内容

## 沟通风格
- 使用中文回复
- 专业但不刻板
- 鼓励但也诚实指出问题
- 适时使用 emoji 让对话更生动

## 当前用户上下文
{{context}}`;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  
  // 会话状态存储 (生产环境应使用 Redis)
  private sessions: Map<string, AgentState> = new Map();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private toolExecutor: ToolExecutor,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.baseUrl = this.configService.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
  }

  /**
   * 处理用户消息，返回 Agent 响应
   */
  async chat(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<AgentResponse> {
    // 获取或创建会话状态
    const sessionKey = `${userId}:${conversationId || 'default'}`;
    let state = this.sessions.get(sessionKey);

    if (!state) {
      state = await this.initializeState(userId, conversationId || 'default');
      this.sessions.set(sessionKey, state);
    }

    // 添加用户消息
    state.messages.push({ role: 'user', content: message });

    // 执行 Agent 循环
    const response = await this.runAgentLoop(state, DEFAULT_CONFIG);

    // 保存状态
    this.sessions.set(sessionKey, state);

    return response;
  }

  /**
   * 初始化会话状态
   */
  private async initializeState(userId: string, conversationId: string): Promise<AgentState> {
    // 加载用户上下文
    const context = await this.loadUserContext(userId);

    return {
      userId,
      conversationId,
      messages: [],
      context,
    };
  }

  /**
   * 加载用户上下文信息
   */
  private async loadUserContext(userId: string): Promise<AgentContext> {
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        include: {
          testScores: true,
          activities: { take: 5 },
          awards: { take: 5 },
        },
      });

      if (!profile) {
        return {};
      }

      return {
        profile: {
          gpa: profile.gpa ? Number(profile.gpa) : undefined,
          gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
          testScores: profile.testScores?.map(s => ({
            type: s.type,
            score: s.score,
          })),
          targetMajor: profile.targetMajor || undefined,
          budgetTier: profile.budgetTier || undefined,
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to load user context', error);
      return {};
    }
  }

  /**
   * Agent 主循环 - ReAct 模式
   */
  private async runAgentLoop(
    state: AgentState,
    config: AgentConfig,
  ): Promise<AgentResponse> {
    let iterations = 0;
    const toolsUsed: string[] = [];

    while (iterations < config.maxIterations) {
      iterations++;

      // 构建系统提示词
      const systemPrompt = this.buildSystemPrompt(state.context);

      // 调用 LLM
      const response = await this.callLLM(
        systemPrompt,
        state.messages,
        config,
      );

      // 如果没有工具调用，返回最终响应
      if (!response.toolCalls?.length) {
        state.messages.push({
          role: 'assistant',
          content: response.content,
        });

        return {
          message: response.content,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
          suggestions: this.extractSuggestions(response.content),
          nextActions: this.generateNextActions(state, response.content),
        };
      }

      // 执行工具调用
      state.messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);

        this.logger.debug(`Executing tool: ${toolName}`);

        let args: Record<string, any> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {}

        const result = await this.toolExecutor.execute(
          toolName,
          args,
          state.userId,
          state.context,
        );

        // 添加工具结果
        state.messages.push({
          role: 'tool',
          content: JSON.stringify(result.result),
          toolCallId: toolCall.id,
        });

        // 更新上下文
        this.updateContext(state.context, toolName, result.result);
      }
    }

    // 超过最大迭代次数
    return {
      message: '抱歉，处理您的请求时遇到了一些问题。请尝试简化您的问题或分步骤提问。',
      toolsUsed,
    };
  }

  /**
   * 调用 LLM API
   */
  private async callLLM(
    systemPrompt: string,
    messages: AgentMessage[],
    config: AgentConfig,
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // 转换消息格式
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            content: m.content,
            tool_call_id: m.toolCallId,
          };
        }
        if (m.toolCalls) {
          return {
            role: 'assistant' as const,
            content: m.content || null,
            tool_calls: m.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      }),
    ];

    // 获取工具定义
    const tools = toOpenAITools(getToolDefinitions(config.tools));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: openaiMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`LLM API error: ${error}`);
      throw new Error('AI service error');
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    };
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(context: AgentContext): string {
    let contextStr = '暂无用户档案信息';

    if (context.profile) {
      const parts = [];
      if (context.profile.gpa) {
        parts.push(`GPA: ${context.profile.gpa}/${context.profile.gpaScale || 4.0}`);
      }
      if (context.profile.testScores?.length) {
        parts.push(`标化: ${context.profile.testScores.map(s => `${s.type}: ${s.score}`).join(', ')}`);
      }
      if (context.profile.targetMajor) {
        parts.push(`目标专业: ${context.profile.targetMajor}`);
      }
      if (parts.length > 0) {
        contextStr = parts.join('\n');
      }
    }

    return SYSTEM_PROMPT.replace('{{context}}', contextStr);
  }

  /**
   * 更新上下文
   */
  private updateContext(context: AgentContext, toolName: string, result: any) {
    // 根据工具结果更新上下文
    if (toolName === AgentTool.GET_PROFILE && result && !result.error) {
      context.profile = {
        gpa: result.gpa,
        gpaScale: result.gpaScale,
        testScores: result.testScores,
        targetMajor: result.targetMajor,
        budgetTier: result.budgetTier,
      };
    }
  }

  /**
   * 从响应中提取建议
   */
  private extractSuggestions(content: string): string[] | undefined {
    // 简单实现：提取带序号的建议
    const suggestions: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\d+[\.\)]\s*(.+)$/);
      if (match) {
        suggestions.push(match[1].trim());
      }
    }

    return suggestions.length > 0 ? suggestions.slice(0, 5) : undefined;
  }

  /**
   * 生成下一步操作建议
   */
  private generateNextActions(
    state: AgentState,
    response: string,
  ): Array<{ label: string; action: string }> | undefined {
    const actions: Array<{ label: string; action: string }> = [];

    // 根据对话内容推断可能的下一步
    if (!state.context.profile?.gpa) {
      actions.push({ label: '完善档案', action: 'navigate:/profile' });
    }

    if (response.includes('文书') || response.includes('essay')) {
      actions.push({ label: '管理文书', action: 'navigate:/essays' });
    }

    if (response.includes('学校') || response.includes('选校')) {
      actions.push({ label: '查看排名', action: 'navigate:/ranking' });
    }

    return actions.length > 0 ? actions : undefined;
  }

  /**
   * 清除会话
   */
  clearSession(userId: string, conversationId?: string) {
    const sessionKey = `${userId}:${conversationId || 'default'}`;
    this.sessions.delete(sessionKey);
  }

  /**
   * 获取会话历史
   */
  getSessionHistory(userId: string, conversationId?: string): AgentMessage[] {
    const sessionKey = `${userId}:${conversationId || 'default'}`;
    const state = this.sessions.get(sessionKey);
    return state?.messages || [];
  }
}




