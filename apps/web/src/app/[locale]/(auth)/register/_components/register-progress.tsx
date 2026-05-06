'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface RegisterProgressProps {
  steps: { key: string; label: string }[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export function RegisterProgress({ steps, currentStep, onStepClick }: RegisterProgressProps) {
  const ta = useTranslations('auth.register');

  return (
    <>
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => index < currentStep && onStepClick(index)}
                disabled={index > currentStep}
                aria-label={step.label}
                aria-current={index === currentStep ? 'step' : undefined}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all sm:h-9 sm:w-9',
                  index < currentStep &&
                    'bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90',
                  index === currentStep &&
                    'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  index > currentStep && 'bg-muted text-muted-foreground'
                )}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </button>
              <span
                className={cn(
                  'text-xs mt-1.5',
                  index === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-16 h-0.5 mx-2 -mt-5',
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Title area */}
      <div className="text-center mb-6">
        <h1 className="text-title">
          {currentStep === 0 && ta('steps.account.title')}
          {currentStep === 1 && ta('steps.profile.title')}
          {currentStep === 2 && ta('steps.scores.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {currentStep === 0 && ta('steps.account.desc')}
          {currentStep === 1 && ta('steps.profile.desc')}
          {currentStep === 2 && ta('steps.scores.desc')}
        </p>
      </div>
    </>
  );
}
