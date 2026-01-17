'use client';

/**
 * AI 助手侧边面板组件
 *
 * 可嵌入到任何页面，提供上下文相关的 AI 助手功能
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MessageCircle, Sparkles, Lightbulb, HelpCircle, Zap } from 'lucide-react';
import { AgentChat } from './agent-chat';

export interface ContextAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  /** 点击操作时发送的消息 - 支持 message 或 prompt 两种写法 */
  message?: string;
  prompt?: string;
  description?: string;
}

interface AiAssistantPanelProps {
  /** 页面上下文标题 - 支持 contextTitle 或 title 两种写法 */
  contextTitle?: string;
  title?: string;
  /** 页面上下文描述 - 支持 contextDescription 或 description 两种写法 */
  contextDescription?: string;
  description?: string;
  /** 上下文相关的快捷操作 */
  contextActions?: ContextAction[];
  /** 触发器按钮的位置 */
  triggerPosition?: 'fixed' | 'inline';
  /** 面板默认是否打开 */
  defaultOpen?: boolean;
  /** 外部控制的打开状态 */
  isOpen?: boolean;
  /** 关闭面板的回调 */
  onClose?: () => void;
  /** 面板宽度 */
  panelWidth?: 'sm' | 'md' | 'lg';
  /** 额外的 className */
  className?: string;
  /** 子组件（inline 模式下作为触发器） */
  children?: React.ReactNode;
  /** 初始消息（用于欢迎语） */
  initialMessage?: string;
}

const panelWidths = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[500px]',
  lg: 'sm:max-w-[600px]',
};

export function AiAssistantPanel({
  contextTitle,
  title,
  contextDescription,
  description,
  contextActions = [],
  triggerPosition = 'fixed',
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onClose,
  panelWidth = 'md',
  className,
  children,
  initialMessage: _initialMessage,
}: AiAssistantPanelProps) {
  const t = useTranslations('agentChat');
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  // 支持受控和非受控模式
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = isControlled
    ? (open: boolean) => {
        if (!open && onClose) onClose();
      }
    : setInternalIsOpen;

  // 合并 title/contextTitle 和 description/contextDescription
  const displayTitle = title || contextTitle;
  const displayDescription = description || contextDescription;

  // 处理快捷操作点击
  const handleActionClick = useCallback((action: ContextAction) => {
    setSelectedAction(action.id);
    // 支持 message 或 prompt 两种写法
    const messageToSend = action.message || action.prompt;
    // 触发聊天发送消息（通过自定义事件）
    window.dispatchEvent(
      new CustomEvent('ai-assistant-action', { detail: { message: messageToSend } })
    );
  }, []);

  // 固定位置的触发按钮
  const fixedTrigger = (
    <motion.div
      className="fixed bottom-6 right-6 z-40"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        size="lg"
        className={cn(
          'h-14 w-14 rounded-full shadow-lg',
          'bg-gradient-to-br from-primary to-primary/80',
          'hover:shadow-xl transition-all',
          'relative group'
        )}
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle className="h-6 w-6" />
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/30"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </Button>
    </motion.div>
  );

  // 内联触发器
  const inlineTrigger = children || (
    <Button variant="outline" className="gap-2">
      <Sparkles className="h-4 w-4" />
      {t('assistant')}
    </Button>
  );

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Context Header */}
      {(displayTitle || displayDescription) && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1">
              {displayTitle && <h4 className="text-sm font-semibold">{displayTitle}</h4>}
              {displayDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {displayDescription}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Context Actions */}
      {contextActions.length > 0 && (
        <div className="px-3 py-2 border-b bg-muted/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">
              {t('quickActions.title')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {contextActions.map((action) => (
              <motion.div key={action.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 text-xs rounded-full px-3 gap-1.5',
                    'hover:bg-primary/10 hover:text-primary',
                    selectedAction === action.id && 'bg-primary/10 text-primary'
                  )}
                  onClick={() => handleActionClick(action)}
                >
                  {action.icon}
                  {action.label}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Content */}
      <div className="flex-1 overflow-hidden">
        <AgentChat showHeader={false} showQuickActions={contextActions.length === 0} />
      </div>
    </div>
  );

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {triggerPosition === 'inline' && <SheetTrigger asChild>{inlineTrigger}</SheetTrigger>}
        <SheetContent
          side="right"
          className={cn('p-0 flex flex-col', panelWidths[panelWidth], className)}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t('title')}</SheetTitle>
            <SheetDescription>{t('welcomeDesc')}</SheetDescription>
          </SheetHeader>
          {panelContent}
        </SheetContent>
      </Sheet>

      {triggerPosition === 'fixed' && !isOpen && fixedTrigger}
    </>
  );
}

// 预设的上下文操作
/**
 * 创建上下文操作的工厂函数
 * 因为模块级常量无法使用 useTranslations，所以需要在组件中调用这些函数
 */
export const createEssayContextActions = (
  t: ReturnType<typeof useTranslations>
): ContextAction[] => [
  {
    id: 'review',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    label: t('essayActions.review'),
    message: t('essayActions.reviewPrompt'),
    description: t('essayActions.reviewDesc'),
  },
  {
    id: 'polish',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    label: t('essayActions.polish'),
    message: t('essayActions.polishPrompt'),
    description: t('essayActions.polishDesc'),
  },
  {
    id: 'brainstorm',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    label: t('essayActions.brainstorm'),
    message: t('essayActions.brainstormPrompt'),
    description: t('essayActions.brainstormDesc'),
  },
];

export const createAssessmentContextActions = (
  t: ReturnType<typeof useTranslations>
): ContextAction[] => [
  {
    id: 'interpret',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    label: t('assessmentActions.interpret'),
    message: t('assessmentActions.interpretPrompt'),
    description: t('assessmentActions.interpretDesc'),
  },
  {
    id: 'suggest-major',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    label: t('assessmentActions.suggestMajor'),
    message: t('assessmentActions.suggestMajorPrompt'),
    description: t('assessmentActions.suggestMajorDesc'),
  },
  {
    id: 'activities',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    label: t('assessmentActions.activities'),
    message: t('assessmentActions.activitiesPrompt'),
    description: t('assessmentActions.activitiesDesc'),
  },
];

export const createForumContextActions = (
  t: ReturnType<typeof useTranslations>
): ContextAction[] => [
  {
    id: 'summarize',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    label: t('forumActions.summarize'),
    message: t('forumActions.summarizePrompt'),
    description: t('forumActions.summarizeDesc'),
  },
  {
    id: 'answer',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    label: t('forumActions.answer'),
    message: t('forumActions.answerPrompt'),
    description: t('forumActions.answerDesc'),
  },
];

export const createSwipeContextActions = (
  t: ReturnType<typeof useTranslations>
): ContextAction[] => [
  {
    id: 'explain',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    label: t('swipeActions.explain'),
    message: t('swipeActions.explainPrompt'),
    description: t('swipeActions.explainDesc'),
  },
  {
    id: 'compare',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    label: t('swipeActions.compare'),
    message: t('swipeActions.comparePrompt'),
    description: t('swipeActions.compareDesc'),
  },
  {
    id: 'tips',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    label: t('swipeActions.tips'),
    message: t('swipeActions.tipsPrompt'),
    description: t('swipeActions.tipsDesc'),
  },
];
