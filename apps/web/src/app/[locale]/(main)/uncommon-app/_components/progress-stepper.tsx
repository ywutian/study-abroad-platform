'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { User, Database, Sparkles, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AnimatedProgress, PopIn } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

interface RecommendationLoadingStateProps {
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function RecommendationLoadingState({ t }: RecommendationLoadingStateProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    { icon: User, labelKey: 'loadingStep1' },
    { icon: Database, labelKey: 'loadingStep2' },
    { icon: Sparkles, labelKey: 'loadingStep3' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const target = ((step + 1) / steps.length) * 85;
        if (prev >= target) return prev;
        return prev + 0.4;
      });
    }, 100);

    const timeout = setTimeout(
      () => {
        if (step < steps.length - 1) {
          setStep((prev) => prev + 1);
        }
      },
      step === 0 ? 8000 : 15000
    );

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [step, steps.length]);

  const StepIcon = steps[step].icon;

  return (
    <div className="flex flex-col items-center text-center py-10 space-y-5">
      <AnimatePresence mode="wait">
        <PopIn key={step} className="p-4 rounded-2xl bg-primary/10">
          <StepIcon className="h-8 w-8 text-primary" />
        </PopIn>
      </AnimatePresence>

      <div className="space-y-1">
        <AnimatePresence mode="wait">
          <PopIn key={`text-${step}`}>
            <p className="text-sm font-medium">{t(steps[step].labelKey)}</p>
          </PopIn>
        </AnimatePresence>
        <p className="text-xs text-muted-foreground">
          {t('loadingStepOf', { current: step + 1, total: steps.length })}
        </p>
      </div>

      <div className="w-full max-w-[240px] space-y-2">
        <AnimatedProgress
          value={progress}
          barClassName="bg-gradient-to-r from-primary to-violet-500"
        />
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors duration-300',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-primary">{children}</h1>,
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mb-2 mt-4 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-medium mb-2 mt-3 text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-medium mb-1 mt-2 text-muted-foreground">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed mb-2 text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => <ul className="space-y-1.5 mb-3">{children}</ul>,
        ol: ({ children }) => (
          <ol className="space-y-1.5 mb-3 list-decimal list-inside">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm flex items-start gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span className="flex-1">{children}</span>
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="text-primary">{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
