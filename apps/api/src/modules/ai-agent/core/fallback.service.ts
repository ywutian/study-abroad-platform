/**
 * 降级与兜底响应服务
 */

import { Injectable, Logger } from '@nestjs/common';
import { AgentType, AgentResponse } from '../types';

// 预设的降级响应
const FALLBACK_RESPONSES: Record<string, AgentResponse> = {
  // 通用降级
  default: {
    message: '抱歉，我暂时无法处理您的请求。请稍后再试，或尝试换一种方式提问。',
    agentType: AgentType.ORCHESTRATOR,
    suggestions: ['稍后重试', '简化问题', '联系客服'],
  },

  // 服务繁忙
  busy: {
    message: '当前使用人数较多，请稍后再试。您也可以先浏览院校库或案例库。',
    agentType: AgentType.ORCHESTRATOR,
    actions: [
      { label: '浏览院校', action: 'navigate:/schools' },
      { label: '查看案例', action: 'navigate:/cases' },
    ],
  },

  // 配额超限
  quota: {
    message:
      '您今日的对话次数已达上限。升级会员可获得更多对话额度，或明天再来。',
    agentType: AgentType.ORCHESTRATOR,
    actions: [{ label: '升级会员', action: 'navigate:/pricing' }],
  },

  // 网络问题
  network: {
    message: '网络连接不稳定，请检查网络后重试。',
    agentType: AgentType.ORCHESTRATOR,
    suggestions: ['检查网络', '刷新页面'],
  },

  // 内容审核
  moderation: {
    message: '抱歉，您的问题暂时无法回答。请调整问题内容后重试。',
    agentType: AgentType.ORCHESTRATOR,
  },
};

// Agent 专属降级响应
const AGENT_FALLBACKS: Partial<Record<AgentType, AgentResponse>> = {
  [AgentType.ESSAY]: {
    message: '文书服务暂时不可用。您可以先整理思路，稍后再让我帮您分析。',
    agentType: AgentType.ESSAY,
    suggestions: ['先写一个初稿', '列出想表达的要点', '稍后再试'],
  },
  [AgentType.SCHOOL]: {
    message: '选校服务暂时不可用。您可以先浏览院校库了解学校信息。',
    agentType: AgentType.SCHOOL,
    actions: [
      { label: '浏览院校库', action: 'navigate:/schools' },
      { label: '查看排名', action: 'navigate:/ranking' },
    ],
  },
  [AgentType.PROFILE]: {
    message: '档案分析服务暂时不可用。建议先完善您的档案信息。',
    agentType: AgentType.PROFILE,
    actions: [{ label: '完善档案', action: 'navigate:/profile' }],
  },
  [AgentType.TIMELINE]: {
    message: '时间规划服务暂时不可用。您可以先查看目标学校的截止日期。',
    agentType: AgentType.TIMELINE,
    actions: [{ label: '查看截止日期', action: 'navigate:/schools' }],
  },
};

// 错误分类
export type ErrorCategory =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'network'
  | 'circuit_open'
  | 'moderation'
  | 'unknown';

@Injectable()
export class FallbackService {
  private readonly logger = new Logger(FallbackService.name);

  /**
   * 获取降级响应
   */
  getFallbackResponse(
    error: Error,
    agentType?: AgentType,
    context?: {
      userId?: string;
      conversationId?: string;
      userMessage?: string;
    },
  ): AgentResponse {
    const category = this.categorizeError(error);

    this.logger.warn(
      `Fallback triggered: category=${category}, agent=${agentType}, error=${error.message}`,
    );

    // 先尝试 Agent 专属降级
    if (agentType && AGENT_FALLBACKS[agentType]) {
      const agentFallback = AGENT_FALLBACKS[agentType];
      return {
        ...agentFallback,
        data: {
          fallback: true,
          category,
          originalError:
            process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
      };
    }

    // 根据错误类别选择降级响应
    let fallbackKey = 'default';
    switch (category) {
      case 'rate_limit':
      case 'circuit_open':
        fallbackKey = 'busy';
        break;
      case 'quota':
        fallbackKey = 'quota';
        break;
      case 'network':
      case 'timeout':
        fallbackKey = 'network';
        break;
      case 'moderation':
        fallbackKey = 'moderation';
        break;
    }

    const response =
      FALLBACK_RESPONSES[fallbackKey] || FALLBACK_RESPONSES.default;

    return {
      ...response,
      data: {
        fallback: true,
        category,
        originalError:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    };
  }

  /**
   * 分类错误
   */
  categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name;

    // 超时
    if (name === 'TimeoutError' || message.includes('timeout')) {
      return 'timeout';
    }

    // 限流
    if (
      name === 'RateLimitExceededError' ||
      message.includes('rate limit') ||
      message.includes('429')
    ) {
      return 'rate_limit';
    }

    // 配额
    if (name === 'QuotaExceededError' || message.includes('quota')) {
      return 'quota';
    }

    // 熔断
    if (name === 'CircuitOpenError' || message.includes('circuit')) {
      return 'circuit_open';
    }

    // 网络
    if (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('fetch failed')
    ) {
      return 'network';
    }

    // 内容审核
    if (message.includes('moderation') || message.includes('content_policy')) {
      return 'moderation';
    }

    return 'unknown';
  }

  /**
   * 判断错误是否应该重试
   */
  shouldRetry(error: Error): boolean {
    const category = this.categorizeError(error);
    // 这些错误重试可能有帮助
    return ['timeout', 'network', 'unknown'].includes(category);
  }

  /**
   * 判断错误是否应该静默（不向用户显示详细信息）
   */
  shouldSilence(error: Error): boolean {
    const category = this.categorizeError(error);
    // 内部错误不暴露细节
    return category === 'unknown';
  }

  /**
   * 生成用户友好的错误消息
   */
  getUserFriendlyMessage(error: Error): string {
    const category = this.categorizeError(error);

    const messages: Record<ErrorCategory, string> = {
      timeout: '请求处理时间较长，请稍后重试',
      rate_limit: '请求过于频繁，请稍后再试',
      quota: '您的使用额度已达上限',
      network: '网络连接出现问题，请检查网络',
      circuit_open: '服务暂时不可用，请稍后重试',
      moderation: '您的问题无法处理，请修改后重试',
      unknown: '遇到了一些问题，请稍后重试',
    };

    return messages[category];
  }
}
