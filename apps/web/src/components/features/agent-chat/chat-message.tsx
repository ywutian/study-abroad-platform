'use client';

/**
 * 聊天消息组件 - 支持 Markdown 渲染、动画和工具状态可视化
 */

import { memo, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Wrench,
  CheckCircle2,
  User,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
  Search,
  FileText,
  BarChart3,
  School,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { ChatMessage as ChatMessageType, AGENT_INFO, AgentType, ToolCallInfo } from './types';
import { Streamdown } from 'streamdown';
import { cjk } from '@streamdown/cjk';
import { transitions } from '@/lib/motion';

interface ChatMessageProps {
  message: ChatMessageType;
  isLast?: boolean;
}

// 工具图标映射
const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_schools: <School className="h-3 w-3" />,
  get_user_profile: <User className="h-3 w-3" />,
  analyze_profile: <BarChart3 className="h-3 w-3" />,
  search_cases: <Search className="h-3 w-3" />,
  get_deadlines: <Calendar className="h-3 w-3" />,
  review_essay: <FileText className="h-3 w-3" />,
  query_database: <Database className="h-3 w-3" />,
};

export const ChatMessage = memo(function ChatMessage({
  message,
  isLast: _isLast,
}: ChatMessageProps) {
  const t = useTranslations('agentChat');

  // 工具名称格式化
  const formatToolName = (name: string) => {
    const labels: Record<string, string> = {
      search_schools: t('tools.searchSchools'),
      get_user_profile: t('tools.getProfile'),
      analyze_profile: t('tools.analyzeProfile'),
      search_cases: t('tools.searchCases'),
      get_deadlines: t('tools.getDeadlines'),
      review_essay: t('tools.reviewEssay'),
      query_database: t('tools.queryDatabase'),
      generate_essay_outline: t('tools.generateOutline'),
      recommend_schools: t('tools.recommendSchools'),
      analyze_admission_chance: t('tools.analyzeChance'),
    };
    return labels[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const locale = useLocale();
  const isUser = message.role === 'user';
  const agentInfo = message.agent ? AGENT_INFO[message.agent] : null;
  const agentName = agentInfo ? getLocalizedName(agentInfo.nameZh, agentInfo.name, locale) : null;
  const prefersReducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  // 复制消息内容
  const handleCopy = async () => {
    if (message.content) {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 消息入场动画
  const messageVariants = {
    hidden: {
      opacity: 0,
      y: 16,
      scale: 0.96,
      x: isUser ? 12 : -12,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      x: 0,
      transition: transitions.springGentle,
    },
  };

  // 头像动画
  const avatarVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { ...transitions.springSnappy, delay: 0.1 },
    },
  };

  // 工具调用动画
  const toolVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: 'auto',
      transition: transitions.springGentle,
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: transitions.easeOutFast,
    },
  };

  if (prefersReducedMotion) {
    return (
      <StaticChatMessage
        message={message}
        agentInfo={agentInfo}
        agentName={agentName}
        isUser={isUser}
      />
    );
  }

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <motion.div variants={avatarVariants}>
        <Avatar
          className={cn(
            'h-8 w-8 shrink-0 ring-2 ring-background shadow-md',
            isUser ? 'bg-primary' : 'bg-primary/10'
          )}
        >
          <AvatarFallback
            className={cn('text-sm', isUser ? 'bg-primary text-primary-foreground' : '')}
          >
            {isUser ? (
              <User className="h-4 w-4" />
            ) : (
              <span className="text-lg">{agentInfo?.icon || '🤖'}</span>
            )}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {/* Agent Badge with animation */}
        {!isUser && agentInfo && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <Sparkles className="h-3 w-3 text-primary/60" />
            <span className={cn('text-xs font-medium', agentInfo.color)}>{agentName}</span>
          </motion.div>
        )}

        {/* Message Bubble */}
        <motion.div
          className={cn(
            'relative rounded-lg px-4 py-2.5 shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border rounded-bl-md'
          )}
          whileHover={!isUser ? { scale: 1.005 } : undefined}
        >
          {/* Tool Calls - Collapsible */}
          <AnimatePresence>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <motion.div
                variants={toolVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mb-3"
              >
                {/* Tool Header */}
                <button
                  onClick={() => setToolsExpanded(!toolsExpanded)}
                  className={cn(
                    'flex items-center gap-2 text-xs w-full mb-2',
                    isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  <Wrench className="h-3 w-3" />
                  <span>{t('usingTools', { count: message.toolCalls.length })}</span>
                  {toolsExpanded ? (
                    <ChevronUp className="h-3 w-3 ml-auto" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  )}
                </button>

                {/* Tool List */}
                <AnimatePresence>
                  {toolsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5"
                    >
                      {message.toolCalls.map((tool, idx) => (
                        <ToolCallCard
                          key={`${tool.name}-${idx}`}
                          tool={tool}
                          isUser={isUser}
                          index={idx}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message Content - Streamdown 处理流式和完成态的 Markdown 渲染 */}
          {message.content ? (
            <div
              className={cn(
                'prose prose-sm max-w-none',
                isUser ? 'prose-invert' : 'dark:prose-invert'
              )}
            >
              <MarkdownContent content={message.content} isStreaming={message.isStreaming} />
            </div>
          ) : message.isStreaming ? (
            <ThinkingIndicator thinkingText={t('thinking')} />
          ) : null}

          {/* Copy Button (for assistant messages) */}
          {!isUser && message.content && !message.isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 rounded-full bg-background shadow-sm"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Timestamp */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xs text-muted-foreground px-1"
        >
          {formatTime(message.timestamp)}
        </motion.span>
      </div>
    </motion.div>
  );
});

// 工具调用卡片组件
function ToolCallCard({
  tool,
  isUser,
  index,
}: {
  tool: ToolCallInfo;
  isUser: boolean;
  index: number;
}) {
  const t = useTranslations('agentChat');
  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';

  const formatToolName = (name: string): string => {
    const labels: Record<string, string> = {
      search_schools: t('tools.searchSchools'),
      get_user_profile: t('tools.getProfile'),
      analyze_profile: t('tools.analyzeProfile'),
      search_cases: t('tools.searchCases'),
      get_deadlines: t('tools.getDeadlines'),
      review_essay: t('tools.reviewEssay'),
      query_database: t('tools.queryDatabase'),
      generate_essay_outline: t('tools.generateOutline'),
      recommend_schools: t('tools.recommendSchools'),
      analyze_admission_chance: t('tools.analyzeChance'),
    };
    return labels[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg',
        isUser
          ? 'bg-primary-foreground/10'
          : isError
            ? 'bg-destructive/10 border border-destructive/20'
            : isRunning
              ? 'bg-primary/10 border border-primary/20'
              : 'bg-muted/50 border border-border/50'
      )}
    >
      {/* Status Icon */}
      {isRunning ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-3 w-3 text-primary" />
        </motion.div>
      ) : isError ? (
        <AlertCircle className="h-3 w-3 text-destructive" />
      ) : (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={transitions.springSnappy}
        >
          <CheckCircle2 className="h-3 w-3 text-success" />
        </motion.div>
      )}

      {/* Tool Icon */}
      {TOOL_ICONS[tool.name] || <Wrench className="h-3 w-3" />}

      {/* Tool Name */}
      <span className={cn('font-medium', isRunning && 'text-primary')}>
        {formatToolName(tool.name)}
      </span>

      {/* Running Animation */}
      {isRunning && (
        <motion.div className="flex gap-0.5 ml-auto">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1 h-1 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// 思考指示器
function ThinkingIndicator({ thinkingText }: { thinkingText: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <motion.div
        className="flex items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-primary/60"
            animate={{
              y: [0, -6, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
      <motion.span
        className="text-xs text-muted-foreground"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {thinkingText}
      </motion.span>
    </div>
  );
}

// 学校推荐数据类型
interface SchoolRecommendation {
  name: string;
  nameZh: string;
  tier: 'reach' | 'target' | 'safety';
  reason: string;
}

// 学校推荐卡片组件
function SchoolRecommendationCards({ schools }: { schools: SchoolRecommendation[] }) {
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const tierConfig = {
    reach: {
      label: t('tierReach'),
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      icon: '🎯',
    },
    target: {
      label: t('tierTarget'),
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      icon: '✅',
    },
    safety: {
      label: t('tierSafety'),
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      icon: '🛡️',
    },
  };

  // 按 tier 分组
  const grouped = schools.reduce(
    (acc, school) => {
      const tier = school.tier || 'target';
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(school);
      return acc;
    },
    {} as Record<string, SchoolRecommendation[]>
  );

  const tierOrder: Array<'reach' | 'target' | 'safety'> = ['reach', 'target', 'safety'];

  return (
    <div className="my-3 space-y-3">
      {tierOrder.map((tier) => {
        const tierSchools = grouped[tier];
        if (!tierSchools?.length) return null;
        const config = tierConfig[tier];

        return (
          <div key={tier} className="space-y-2">
            <div className="flex items-center gap-2">
              <span>{config.icon}</span>
              <Badge variant="secondary" className={cn('text-xs', config.color)}>
                {t('tierSchoolCount', { label: config.label, count: tierSchools.length })}
              </Badge>
            </div>
            <div className="grid gap-2">
              {tierSchools.map((school, idx) => (
                <motion.div
                  key={`${school.name}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <School className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{getSchoolName(school, locale)}</span>
                      {getSchoolSubName(school, locale) && (
                        <span className="text-xs text-muted-foreground">
                          {getSchoolSubName(school, locale)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {school.reason}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 尝试解析结构化数据
function tryParseStructuredData(
  content: string
): { type: 'schools'; data: SchoolRecommendation[] } | null {
  // 匹配 JSON 代码块
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);

    // 检测学校推荐格式
    if (parsed.schools && Array.isArray(parsed.schools)) {
      const schools = parsed.schools.filter((s: SchoolRecommendation) => s.name);
      if (schools.length > 0) {
        return { type: 'schools', data: schools };
      }
    }
  } catch {
    // 解析失败，返回 null
  }

  return null;
}

// 共享 Markdown 组件覆盖 — Streamdown components prop
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className;
    return isInline ? (
      <code className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-sm font-mono">
        {children}
      </code>
    ) : (
      <code className="block p-3 rounded-lg bg-black/10 dark:bg-white/10 text-sm font-mono overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="relative my-2 overflow-hidden rounded-lg">{children}</pre>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="font-semibold text-base mt-4 mb-2">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="font-medium mt-3 mb-1.5">{children}</h4>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
};

// Markdown 渲染（Streamdown 统一处理流式与完成态）
function MarkdownContent({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  // 流式输出时跳过结构化数据解析，避免解析不完整的 JSON
  const structuredData = useMemo(
    () => (isStreaming ? null : tryParseStructuredData(content)),
    [content, isStreaming]
  );

  const cleanedContent = useMemo(() => {
    if (structuredData) {
      // Remove the JSON code block and any introductory line about structured data
      return content
        .replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/, '')
        .replace(/.*结构化数据.*\n?/g, '')
        .trim();
    }
    return content;
  }, [content, structuredData]);

  return (
    <>
      <Streamdown components={markdownComponents} plugins={{ cjk }} isAnimating={isStreaming}>
        {cleanedContent}
      </Streamdown>

      {/* 渲染结构化数据 */}
      {structuredData?.type === 'schools' && (
        <SchoolRecommendationCards schools={structuredData.data} />
      )}
    </>
  );
}

// 静态版本（用于 reduced motion）
function StaticChatMessage({
  message,
  agentInfo,
  agentName,
  isUser,
}: {
  message: ChatMessageType;
  agentInfo: (typeof AGENT_INFO)[AgentType] | null;
  agentName: string | null;
  isUser: boolean;
}) {
  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar className={cn('h-8 w-8 shrink-0', isUser ? 'bg-primary' : '')}>
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : '')}>
          {isUser ? <User className="h-4 w-4" /> : agentInfo?.icon || '🤖'}
        </AvatarFallback>
      </Avatar>
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && agentInfo && (
          <span className={cn('text-xs', agentInfo.color)}>{agentName}</span>
        )}
        <div
          className={cn(
            'rounded-lg px-4 py-2.5',
            isUser ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
          )}
        >
          <MarkdownContent content={message.content} isStreaming={false} />
        </div>
        <span className="text-2xs text-muted-foreground px-1">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

// Tool name formatting is now handled via translations in component

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
