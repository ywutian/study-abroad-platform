'use client';

/**
 * 多步骤表单组件 - 带动画效果
 */

import { ReactNode, createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';
import { Check, ChevronRight, Circle, Loader2 } from 'lucide-react';
import { Button } from './button';

// ============================================
// Types
// ============================================

interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}

interface StepperContextValue {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  markComplete: (step: number) => void;
  isStepComplete: (step: number) => boolean;
  isStepActive: (step: number) => boolean;
}

const StepperContext = createContext<StepperContextValue | null>(null);

function useStepperContext() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error('Stepper components must be used within a StepperProvider');
  }
  return context;
}

// ============================================
// Stepper Provider
// ============================================

interface StepperProviderProps {
  children: ReactNode;
  steps: Step[];
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

export function StepperProvider({
  children,
  steps,
  initialStep = 0,
  onStepChange,
}: StepperProviderProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
      onStepChange?.(step);
    }
  }, [steps.length, onStepChange]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, steps.length, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const markComplete = useCallback((step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  }, []);

  const isStepComplete = useCallback((step: number) => {
    return completedSteps.has(step);
  }, [completedSteps]);

  const isStepActive = useCallback((step: number) => {
    return step === currentStep;
  }, [currentStep]);

  return (
    <StepperContext.Provider
      value={{
        steps,
        currentStep,
        completedSteps,
        goToStep,
        nextStep,
        prevStep,
        markComplete,
        isStepComplete,
        isStepActive,
      }}
    >
      {children}
    </StepperContext.Provider>
  );
}

// ============================================
// Stepper Header (Progress indicators)
// ============================================

interface StepperHeaderProps {
  className?: string;
  variant?: 'default' | 'compact' | 'dots';
}

export function StepperHeader({ className, variant = 'default' }: StepperHeaderProps) {
  const { steps, currentStep, isStepComplete, goToStep } = useStepperContext();
  const prefersReducedMotion = useReducedMotion();

  if (variant === 'dots') {
    return (
      <div className={cn('flex justify-center gap-2', className)}>
        {steps.map((_, index) => {
          const isComplete = isStepComplete(index);
          const isActive = index === currentStep;

          return (
            <motion.button
              key={index}
              type="button"
              onClick={() => isComplete && goToStep(index)}
              className={cn(
                'h-2 rounded-full transition-all',
                isActive ? 'w-8 bg-primary' : 'w-2',
                isComplete && !isActive && 'bg-primary/50 cursor-pointer',
                !isComplete && !isActive && 'bg-muted'
              )}
              whileHover={isComplete ? { scale: 1.2 } : undefined}
              whileTap={isComplete ? { scale: 0.9 } : undefined}
            />
          );
        })}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-between', className)}>
        <span className="text-sm text-muted-foreground">
          步骤 {currentStep + 1} / {steps.length}
        </span>
        <div className="flex-1 mx-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={transitions.springGentle}
            />
          </div>
        </div>
        <span className="text-sm font-medium">{steps[currentStep]?.title}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((step, index) => {
        const isComplete = isStepComplete(index);
        const isActive = index === currentStep;
        const isPast = index < currentStep;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <motion.button
              type="button"
              onClick={() => (isComplete || isPast) && goToStep(index)}
              className={cn(
                'relative flex items-center justify-center rounded-full border-2 transition-colors',
                'h-10 w-10',
                isActive && 'border-primary bg-primary text-primary-foreground',
                isComplete && !isActive && 'border-primary bg-primary/10 text-primary cursor-pointer',
                !isActive && !isComplete && 'border-muted bg-background text-muted-foreground'
              )}
              whileHover={(isComplete || isPast) ? { scale: 1.1 } : undefined}
              whileTap={(isComplete || isPast) ? { scale: 0.95 } : undefined}
            >
              <AnimatePresence mode="wait">
                {isComplete ? (
                  <motion.div
                    key="check"
                    initial={prefersReducedMotion ? {} : { scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={transitions.springSnappy}
                  >
                    <Check className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <motion.span
                    key="number"
                    initial={prefersReducedMotion ? {} : { scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-sm font-semibold"
                  >
                    {step.icon || index + 1}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Active pulse */}
              {isActive && !prefersReducedMotion && (
                <motion.span
                  className="absolute inset-0 rounded-full bg-primary/20"
                  animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.button>

            {/* Step Label */}
            <div className="ml-3 hidden sm:block">
              <p className={cn(
                'text-sm font-medium',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground">{step.description}</p>
              )}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="mx-4 flex-1 min-w-[40px] sm:min-w-[60px]">
                <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: isComplete || isPast ? '100%' : '0%' }}
                    transition={transitions.springGentle}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Stepper Content (with animation)
// ============================================

interface StepperContentProps {
  children: ReactNode[];
  className?: string;
}

export function StepperContent({ children, className }: StepperContentProps) {
  const { currentStep } = useStepperContext();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
          transition={transitions.easeOut}
        >
          {children[currentStep]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Stepper Navigation
// ============================================

interface StepperNavigationProps {
  className?: string;
  onComplete?: () => void;
  completeLabel?: string;
  nextLabel?: string;
  prevLabel?: string;
  isLoading?: boolean;
  canProceed?: boolean;
}

export function StepperNavigation({
  className,
  onComplete,
  completeLabel = '完成',
  nextLabel = '下一步',
  prevLabel = '上一步',
  isLoading = false,
  canProceed = true,
}: StepperNavigationProps) {
  const { steps, currentStep, nextStep, prevStep, markComplete } = useStepperContext();

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    markComplete(currentStep);
    if (isLastStep) {
      onComplete?.();
    } else {
      nextStep();
    }
  };

  return (
    <div className={cn('flex items-center justify-between pt-6', className)}>
      <Button
        type="button"
        variant="outline"
        onClick={prevStep}
        disabled={isFirstStep || isLoading}
        className="gap-1"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        {prevLabel}
      </Button>

      <Button
        type="button"
        onClick={handleNext}
        disabled={!canProceed || isLoading}
        className="gap-1"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            处理中...
          </>
        ) : (
          <>
            {isLastStep ? completeLabel : nextLabel}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================
// Success Animation
// ============================================

interface SuccessAnimationProps {
  show: boolean;
  title?: string;
  description?: string;
  onComplete?: () => void;
}

export function SuccessAnimation({
  show,
  title = '提交成功！',
  description,
  onComplete,
}: SuccessAnimationProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={() => {
            setTimeout(() => onComplete?.(), 1500);
          }}
        >
          <motion.div
            className="flex flex-col items-center text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={transitions.springGentle}
          >
            {/* Animated Checkmark */}
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...transitions.springSnappy, delay: 0.2 }}
            >
              <motion.div
                className="flex items-center justify-center w-20 h-20 rounded-full bg-success/20"
                animate={prefersReducedMotion ? {} : { scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <motion.div
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <Check className="w-10 h-10 text-success" strokeWidth={3} />
                </motion.div>
              </motion.div>

              {/* Confetti-like particles */}
              {!prefersReducedMotion && (
                <>
                  {[...Array(8)].map((_, i) => (
                    <motion.span
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: ['#10b981', '#6366f1', '#f59e0b', '#ef4444'][i % 4],
                        left: '50%',
                        top: '50%',
                      }}
                      initial={{ x: 0, y: 0, scale: 0 }}
                      animate={{
                        x: Math.cos((i * 45 * Math.PI) / 180) * 60,
                        y: Math.sin((i * 45 * Math.PI) / 180) * 60,
                        scale: [0, 1.5, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.03 }}
                    />
                  ))}
                </>
              )}
            </motion.div>

            {/* Text */}
            <motion.h2
              className="text-2xl font-bold text-foreground mb-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {title}
            </motion.h2>
            {description && (
              <motion.p
                className="text-muted-foreground max-w-sm"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {description}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Export hook
export { useStepperContext };




