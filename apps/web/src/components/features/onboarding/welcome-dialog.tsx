'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  GraduationCap,
  Brain,
  Target,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTour, TOURS, welcomeTourSteps } from './tour-provider';

// 欢迎步骤数据 - 静态配置，文本通过翻译函数获取
const welcomeStepConfigs = [
  {
    id: 'welcome',
    icon: Rocket,
    titleKey: 'welcome',
    color: 'from-primary/20 to-primary/5',
  },
  {
    id: 'schools',
    icon: GraduationCap,
    titleKey: 'schools',
    color: 'from-blue-500/20 to-blue-500/5',
  },
  {
    id: 'ai',
    icon: Brain,
    titleKey: 'ai',
    color: 'from-purple-500/20 to-purple-500/5',
  },
  {
    id: 'prediction',
    icon: Target,
    titleKey: 'prediction',
    color: 'from-green-500/20 to-green-500/5',
  },
];

const WELCOME_STORAGE_KEY = 'has_seen_welcome';

interface WelcomeDialogProps {
  /** 强制显示（用于设置中重新查看） */
  forceShow?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

export function WelcomeDialog({ forceShow = false, onClose }: WelcomeDialogProps) {
  const t = useTranslations('welcome');
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { registerTour, startTour, hasCompletedTour } = useTour();

  // 检查是否首次访问
  useEffect(() => {
    if (forceShow) {
      setOpen(true);
      return;
    }

    const hasSeen = localStorage.getItem(WELCOME_STORAGE_KEY);
    if (!hasSeen) {
      setOpen(true);
    }
  }, [forceShow]);

  // 注册欢迎 tour
  useEffect(() => {
    registerTour({
      id: TOURS.WELCOME,
      steps: welcomeTourSteps,
      onComplete: () => {
        console.log('Welcome tour completed');
      },
    });
  }, [registerTour]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    onClose?.();
  };

  const handleStartTour = () => {
    handleClose();
    // 延迟启动 tour，等待对话框关闭动画完成
    setTimeout(() => {
      startTour(TOURS.WELCOME);
    }, 300);
  };

  const handleNext = () => {
    if (currentStep < welcomeStepConfigs.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isLastStep = currentStep === welcomeStepConfigs.length - 1;
  const stepConfig = welcomeStepConfigs[currentStep];
  const Icon = stepConfig.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* 关闭按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* 内容区域 */}
        <div className="relative">
          {/* 背景渐变 */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br transition-colors duration-500',
            stepConfig.color
          )} />

          {/* 步骤内容 */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepConfig.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="relative p-8 pt-12"
            >
              {/* 图标 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="w-16 h-16 rounded-2xl bg-background/80 backdrop-blur-sm shadow-lg flex items-center justify-center mb-6"
              >
                <Icon className="w-8 h-8 text-primary" />
              </motion.div>

              {/* 标题 */}
              <h2 className="text-2xl font-bold mb-3">{t(`steps.${stepConfig.titleKey}.title`)}</h2>

              {/* 描述 */}
              <p className="text-muted-foreground leading-relaxed">
                {t(`steps.${stepConfig.titleKey}.desc`)}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 底部控制区 */}
        <div className="px-8 pb-8 space-y-4">
          {/* 步骤指示器 */}
          <div className="flex justify-center gap-1.5">
            {welcomeStepConfigs.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === currentStep
                    ? 'w-6 bg-primary'
                    : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )}
              />
            ))}
          </div>

          {/* 按钮组 */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={cn(currentStep === 0 && 'invisible')}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('prevBtn')}
            </Button>

            {isLastStep ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  {t('skipTour')}
                </Button>
                <Button onClick={handleStartTour}>
                  {t('startExperience')}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ) : (
              <Button onClick={handleNext}>
                {t('nextBtn')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 用于在设置中重新查看欢迎引导
export function ResetWelcomeButton() {
  const t = useTranslations('welcome');
  const [showWelcome, setShowWelcome] = useState(false);

  const handleReset = () => {
    localStorage.removeItem(WELCOME_STORAGE_KEY);
    setShowWelcome(true);
  };

  return (
    <>
      <Button variant="outline" onClick={handleReset}>
        {t('resetButton')}
      </Button>
      {showWelcome && (
        <WelcomeDialog forceShow onClose={() => setShowWelcome(false)} />
      )}
    </>
  );
}



