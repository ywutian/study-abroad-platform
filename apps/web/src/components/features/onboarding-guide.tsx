'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@/lib/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  User,
  Target,
  GraduationCap,
  ChevronRight,
  CheckCircle2,
  Circle,
  Sparkles,
  Rocket,
  X,
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  completed: boolean;
  gradient: string;
}

interface OnboardingGuideProps {
  profileProgress: number;
  hasSchools: boolean;
  hasPredictions: boolean;
  onDismiss?: () => void;
}

export function OnboardingGuide({
  profileProgress,
  hasSchools,
  hasPredictions,
  onDismiss,
}: OnboardingGuideProps) {
  const t = useTranslations('dashboard.onboarding');
  const [dismissed, setDismissed] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      title: t('step1Title'),
      description: t('step1Desc'),
      icon: User,
      href: '/profile',
      completed: profileProgress >= 60,
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      id: 'schools',
      title: t('step2Title'),
      description: t('step2Desc'),
      icon: GraduationCap,
      href: '/schools',
      completed: hasSchools,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'prediction',
      title: t('step3Title'),
      description: t('step3Desc'),
      icon: Target,
      href: '/prediction',
      completed: hasPredictions,
      gradient: 'from-emerald-500 to-teal-500',
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const allCompleted = completedCount === steps.length;
  const currentStep = steps.find((s) => !s.completed) || steps[steps.length - 1];

  // 如果用户完成了所有步骤或者关闭了引导，就不显示
  if (dismissed || allCompleted) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-8"
    >
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-blue-500/5">
        {/* 顶部进度条 */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>

        <CardContent className="p-6">
          {/* 头部 */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-blue-500 text-white">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  {t('title')}
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('subtitle', { completed: completedCount, total: steps.length })}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 步骤列表 */}
          <div className="space-y-3">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep.id;

              return (
                <Link key={step.id} href={step.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      'group flex items-center gap-4 p-4 rounded-xl transition-all duration-300',
                      step.completed
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : isActive
                        ? 'bg-primary/10 border border-primary/20 shadow-sm'
                        : 'bg-muted/50 border border-transparent hover:border-border'
                    )}
                  >
                    {/* 步骤图标 */}
                    <div
                      className={cn(
                        'relative shrink-0 p-2.5 rounded-xl transition-all duration-300',
                        step.completed
                          ? 'bg-emerald-500 text-white'
                          : isActive
                          ? `bg-gradient-to-br ${step.gradient} text-white`
                          : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                      )}
                    >
                      {step.completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                      {/* 步骤编号 */}
                      <div
                        className={cn(
                          'absolute -top-1 -left-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center',
                          step.completed
                            ? 'bg-emerald-500 text-white border-2 border-background'
                            : 'bg-muted-foreground/20 text-muted-foreground border-2 border-background'
                        )}
                      >
                        {index + 1}
                      </div>
                    </div>

                    {/* 步骤内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'font-medium',
                            step.completed
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {step.title}
                        </span>
                        {step.completed && (
                          <span className="text-xs text-emerald-500 font-medium">
                            {t('completed')}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-sm truncate',
                          step.completed ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-muted-foreground'
                        )}
                      >
                        {step.description}
                      </p>
                    </div>

                    {/* 箭头 */}
                    {!step.completed && (
                      <ChevronRight
                        className={cn(
                          'h-5 w-5 shrink-0 transition-transform',
                          isActive
                            ? 'text-primary group-hover:translate-x-1'
                            : 'text-muted-foreground group-hover:translate-x-1'
                        )}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>

          {/* 底部提示 */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              {t('hint')}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

