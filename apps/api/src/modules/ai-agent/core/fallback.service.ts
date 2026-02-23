/**
 * 降级与兜底响应服务
 */

import { Injectable, Logger } from '@nestjs/common';
import { AgentType, AgentResponse } from '../types';

// Bilingual fallback messages
const FALLBACK_MESSAGES = {
  default: {
    zh: '抱歉，我暂时无法处理您的请求。请稍后再试，或尝试换一种方式提问。',
    en: 'Sorry, I cannot process your request right now. Please try again later, or try rephrasing your question.',
  },
  busy: {
    zh: '当前使用人数较多，请稍后再试。您也可以先浏览院校库或案例库。',
    en: 'The service is currently busy. Please try again later. You can also browse the school or case database.',
  },
  quota: {
    zh: '您今日的对话次数已达上限。升级会员可获得更多对话额度，或明天再来。',
    en: 'You have reached your daily conversation limit. Upgrade your membership for more, or come back tomorrow.',
  },
  network: {
    zh: '网络连接不稳定，请检查网络后重试。',
    en: 'Network connection is unstable. Please check your connection and try again.',
  },
  moderation: {
    zh: '抱歉，您的问题暂时无法回答。请调整问题内容后重试。',
    en: 'Sorry, your question cannot be answered at this time. Please modify your question and try again.',
  },
  essay: {
    zh: '文书服务暂时不可用。您可以先整理思路，稍后再让我帮您分析。',
    en: 'The essay service is temporarily unavailable. You can organize your thoughts and try again later.',
  },
  school: {
    zh: '选校服务暂时不可用。您可以先浏览院校库了解学校信息。',
    en: 'The school selection service is temporarily unavailable. You can browse the school database.',
  },
  profile: {
    zh: '档案分析服务暂时不可用。建议先完善您的档案信息。',
    en: 'The profile analysis service is temporarily unavailable. Consider completing your profile.',
  },
  timeline: {
    zh: '时间规划服务暂时不可用。您可以先查看目标学校的截止日期。',
    en: 'The planning service is temporarily unavailable. You can check your target school deadlines.',
  },
};

const FALLBACK_SUGGESTIONS = {
  default: {
    zh: ['稍后重试', '简化问题', '联系客服'],
    en: ['Try later', 'Simplify your question', 'Contact support'],
  },
  network: {
    zh: ['检查网络', '刷新页面'],
    en: ['Check network', 'Refresh page'],
  },
  essay: {
    zh: ['先写一个初稿', '列出想表达的要点', '稍后再试'],
    en: ['Write a first draft', 'List your key points', 'Try later'],
  },
};

const FALLBACK_ACTIONS = {
  busy: [
    { zh: '浏览院校', en: 'Browse Schools', action: 'navigate:/schools' },
    { zh: '查看案例', en: 'View Cases', action: 'navigate:/cases' },
  ],
  quota: [{ zh: '升级会员', en: 'Upgrade', action: 'navigate:/pricing' }],
  school: [
    { zh: '浏览院校库', en: 'Browse Schools', action: 'navigate:/schools' },
    { zh: '查看排名', en: 'View Rankings', action: 'navigate:/ranking' },
  ],
  profile: [
    { zh: '完善档案', en: 'Complete Profile', action: 'navigate:/profile' },
  ],
  timeline: [
    { zh: '查看截止日期', en: 'View Deadlines', action: 'navigate:/schools' },
  ],
};

function getMsg(key: keyof typeof FALLBACK_MESSAGES, locale: string): string {
  return locale === 'zh'
    ? FALLBACK_MESSAGES[key].zh
    : FALLBACK_MESSAGES[key].en;
}

function getActions(key: keyof typeof FALLBACK_ACTIONS, locale: string) {
  return FALLBACK_ACTIONS[key].map((a) => ({
    label: locale === 'zh' ? a.zh : a.en,
    action: a.action,
  }));
}

function getSuggestions(
  key: keyof typeof FALLBACK_SUGGESTIONS,
  locale: string,
): string[] {
  return locale === 'zh'
    ? FALLBACK_SUGGESTIONS[key].zh
    : FALLBACK_SUGGESTIONS[key].en;
}

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
      locale?: string;
    },
  ): AgentResponse {
    const category = this.categorizeError(error);
    const locale = context?.locale || 'zh';

    this.logger.warn(
      `Fallback triggered: category=${category}, agent=${agentType}, error=${error.message}`,
    );

    const fallbackData = {
      fallback: true,
      category,
      originalError:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    };

    // 先尝试 Agent 专属降级
    if (agentType) {
      const agentKey =
        agentType.toLowerCase() as keyof typeof FALLBACK_MESSAGES;
      if (agentKey in FALLBACK_MESSAGES) {
        const response: AgentResponse = {
          message: getMsg(agentKey, locale),
          agentType,
          data: fallbackData,
        };
        if (agentKey in FALLBACK_SUGGESTIONS) {
          response.suggestions = getSuggestions(
            agentKey as keyof typeof FALLBACK_SUGGESTIONS,
            locale,
          );
        }
        if (agentKey in FALLBACK_ACTIONS) {
          response.actions = getActions(
            agentKey as keyof typeof FALLBACK_ACTIONS,
            locale,
          );
        }
        return response;
      }
    }

    // 根据错误类别选择降级响应
    let msgKey: keyof typeof FALLBACK_MESSAGES = 'default';
    switch (category) {
      case 'rate_limit':
      case 'circuit_open':
        msgKey = 'busy';
        break;
      case 'quota':
        msgKey = 'quota';
        break;
      case 'network':
      case 'timeout':
        msgKey = 'network';
        break;
      case 'moderation':
        msgKey = 'moderation';
        break;
    }

    const response: AgentResponse = {
      message: getMsg(msgKey, locale),
      agentType: AgentType.ORCHESTRATOR,
      data: fallbackData,
    };

    if (msgKey in FALLBACK_SUGGESTIONS) {
      response.suggestions = getSuggestions(
        msgKey as keyof typeof FALLBACK_SUGGESTIONS,
        locale,
      );
    }
    if (msgKey in FALLBACK_ACTIONS) {
      response.actions = getActions(
        msgKey as keyof typeof FALLBACK_ACTIONS,
        locale,
      );
    }

    return response;
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
  getUserFriendlyMessage(error: Error, locale = 'zh'): string {
    const category = this.categorizeError(error);
    const isZh = locale === 'zh';

    const messages: Record<ErrorCategory, { zh: string; en: string }> = {
      timeout: {
        zh: '请求处理时间较长，请稍后重试',
        en: 'Request took too long. Please try again later',
      },
      rate_limit: {
        zh: '请求过于频繁，请稍后再试',
        en: 'Too many requests. Please try again later',
      },
      quota: {
        zh: '您的使用额度已达上限',
        en: 'You have reached your usage limit',
      },
      network: {
        zh: '网络连接出现问题，请检查网络',
        en: 'Network issue detected. Please check your connection',
      },
      circuit_open: {
        zh: '服务暂时不可用，请稍后重试',
        en: 'Service temporarily unavailable. Please try again later',
      },
      moderation: {
        zh: '您的问题无法处理，请修改后重试',
        en: 'Your question cannot be processed. Please modify and try again',
      },
      unknown: {
        zh: '遇到了一些问题，请稍后重试',
        en: 'Something went wrong. Please try again later',
      },
    };

    return isZh ? messages[category].zh : messages[category].en;
  }
}
