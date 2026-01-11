'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  HelpCircle,
  ThumbsUp,
  X,
  Send,
  Check,
  Loader2,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 反馈类型
type FeedbackType = 'bug' | 'feature' | 'question' | 'other';

interface FeedbackTypeOption {
  id: FeedbackType;
  labelKey: string;
  icon: React.ElementType;
  color: string;
  placeholderKey: string;
}

const feedbackTypes: FeedbackTypeOption[] = [
  {
    id: 'bug',
    labelKey: 'bug',
    icon: Bug,
    color: 'text-red-500 bg-red-500/10',
    placeholderKey: 'bug',
  },
  {
    id: 'feature',
    labelKey: 'feature',
    icon: Lightbulb,
    color: 'text-yellow-500 bg-yellow-500/10',
    placeholderKey: 'feature',
  },
  {
    id: 'question',
    labelKey: 'question',
    icon: HelpCircle,
    color: 'text-blue-500 bg-blue-500/10',
    placeholderKey: 'question',
  },
  {
    id: 'other',
    labelKey: 'other',
    icon: MessageSquarePlus,
    color: 'text-purple-500 bg-purple-500/10',
    placeholderKey: 'other',
  },
];

export function FeedbackWidget() {
  const t = useTranslations('feedback');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'type' | 'form' | 'success'>('type');
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // 重置表单
  const resetForm = () => {
    setStep('type');
    setSelectedType(null);
    setContent('');
    setEmail('');
    setScreenshot(null);
  };

  // 选择类型
  const handleSelectType = (type: FeedbackType) => {
    setSelectedType(type);
    setStep('form');
  };

  // 截图功能（模拟）
  const handleScreenshot = async () => {
    // 实际应该使用 html2canvas 或类似库
    toast.info(t('screenshotInDev'));
  };

  // 提交反馈
  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error(t('contentRequired'));
      return;
    }

    setSubmitting(true);
    
    try {
      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 实际应该调用 API
      // await api.submitFeedback({
      //   type: selectedType,
      //   content,
      //   email,
      //   screenshot,
      //   url: window.location.href,
      //   userAgent: navigator.userAgent,
      // });

      setStep('success');
      toast.success(t('successTitle'));
    } catch (error) {
      toast.error(t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // 关闭时重置
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(resetForm, 200);
    }
  };

  const currentType = feedbackTypes.find(t => t.id === selectedType);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-6 left-6 z-50 h-12 px-4 shadow-lg border-2 hover:scale-105 transition-transform"
        >
          <MessageSquarePlus className="w-5 h-5 mr-2" />
          {t('button')}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[360px] p-0" 
        align="start"
        side="top"
        sideOffset={16}
      >
        <AnimatePresence mode="wait">
          {/* 步骤1：选择类型 */}
          {step === 'type' && (
            <motion.div
              key="type"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4"
            >
              <h4 className="font-semibold mb-3">{t('selectType')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {feedbackTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                        'hover:border-primary hover:bg-primary/5'
                      )}
                    >
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', type.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">{t(`types.${type.labelKey}`)}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* 步骤2：填写表单 */}
          {step === 'form' && currentType && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setStep('type')}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', currentType.color)}>
                  <currentType.icon className="w-4 h-4" />
                </div>
                <span className="font-semibold">{t(`types.${currentType.labelKey}`)}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="feedback-content" className="text-xs text-muted-foreground">
                    {t('detailDescription')}
                  </Label>
                  <Textarea
                    id="feedback-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t(`placeholders.${currentType.placeholderKey}`)}
                    rows={4}
                    className="mt-1.5 resize-none"
                  />
                </div>

                <div>
                  <Label htmlFor="feedback-email" className="text-xs text-muted-foreground">
                    {t('emailLabel')}
                  </Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="mt-1.5"
                  />
                </div>

                {/* 截图按钮 */}
                {currentType.id === 'bug' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleScreenshot}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {t('addScreenshot')}
                  </Button>
                )}

                <Button 
                  className="w-full" 
                  onClick={handleSubmit}
                  disabled={submitting || !content.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {t('submit')}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* 步骤3：成功 */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="w-8 h-8 text-success" />
              </motion.div>
              <h4 className="font-semibold mb-2">{t('successTitle')}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {t('successDesc')}
              </p>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {tCommon('close')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}

// 简化版反馈按钮（用于特定页面）
export function QuickFeedbackButton({ 
  label,
  pageId,
}: { 
  label?: string;
  pageId: string;
}) {
  const t = useTranslations('feedback');
  const displayLabel = label || t('quickLabel');
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleFeedback = async (type: 'up' | 'down') => {
    setFeedback(type);
    // 实际应该调用 API
    toast.success(type === 'up' ? t('thumbsUpThanks') : t('thumbsDownThanks'));
  };

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span>{displayLabel}</span>
      <div className="flex items-center gap-1">
        <Button
          variant={feedback === 'up' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2"
          onClick={() => handleFeedback('up')}
          disabled={feedback !== null}
        >
          <ThumbsUp className={cn('w-4 h-4', feedback === 'up' && 'fill-current')} />
        </Button>
        <Button
          variant={feedback === 'down' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2"
          onClick={() => handleFeedback('down')}
          disabled={feedback !== null}
        >
          <ThumbsUp className={cn('w-4 h-4 rotate-180', feedback === 'down' && 'fill-current')} />
        </Button>
      </div>
    </div>
  );
}



