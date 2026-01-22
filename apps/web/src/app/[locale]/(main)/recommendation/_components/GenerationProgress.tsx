'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PopIn, AnimatedProgress, AnimatePresence } from '@/components/ui/motion';
import { User, Database, Sparkles, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { icon: User, durationMs: 3000 },
  { icon: Database, durationMs: 5000 },
  { icon: Sparkles, durationMs: 7000 },
  { icon: CheckCircle, durationMs: 5000 },
] as const;

export function GenerationProgress() {
  const t = useTranslations('recommendation');
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const stepKeys = ['progressStep1', 'progressStep2', 'progressStep3', 'progressStep4'] as const;

  useEffect(() => {
    const stepProgress = (currentStep / STEPS.length) * 100;
    const stepIncrement = 100 / STEPS.length;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const target = stepProgress + stepIncrement * 0.8;
        if (prev >= target) return prev;
        return prev + 0.5;
      });
    }, 50);

    const timeout = setTimeout(() => {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1);
        setProgress(((currentStep + 1) / STEPS.length) * 100);
      }
    }, STEPS[currentStep].durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentStep]);

  const StepIcon = STEPS[currentStep].icon;

  return (
    <PopIn className="flex flex-col items-center justify-center py-20 space-y-8">
      {/* Animated Icon */}
      <AnimatePresence mode="wait">
        <PopIn key={currentStep} className="p-6 rounded-2xl bg-primary/10">
          <StepIcon className="h-12 w-12 text-primary" />
        </PopIn>
      </AnimatePresence>

      {/* Step Text */}
      <div className="text-center space-y-2">
        <AnimatePresence mode="wait">
          <PopIn key={`text-${currentStep}`}>
            <p className="text-lg font-medium">{t(stepKeys[currentStep])}</p>
          </PopIn>
        </AnimatePresence>
        <p className="text-sm text-muted-foreground">
          {t('progressStepOf', {
            current: currentStep + 1,
            total: STEPS.length,
          })}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md space-y-2">
        <AnimatedProgress value={progress} />
        <div className="flex justify-between">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-colors duration-300',
                i <= currentStep ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>
    </PopIn>
  );
}
