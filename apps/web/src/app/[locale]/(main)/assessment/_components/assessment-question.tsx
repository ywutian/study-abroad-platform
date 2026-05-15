'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Lightbulb,
  Target,
  Save,
  AlertCircle,
  CheckCircle2,
  ListChecks,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type Assessment,
  DIMENSION_NAMES,
  SECONDS_PER_QUESTION,
  isLikertQuestion,
} from './assessment-constants';

interface AssessmentQuestionProps {
  assessment: Assessment;
  currentQuestion: number;
  answers: Record<string, string>;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSelectAnswer: (questionId: string, value: string, autoAdvance?: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  onJumpToQuestion?: (index: number) => void;
  onExit?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: Date | null;
}

export function AssessmentQuestion({
  assessment,
  currentQuestion,
  answers,
  canSubmit,
  isSubmitting,
  onSelectAnswer,
  onNext,
  onPrev,
  onSubmit,
  onJumpToQuestion,
  onExit,
  saveStatus = 'idle',
  lastSavedAt,
}: AssessmentQuestionProps) {
  const t = useTranslations('assessment');
  const format = useFormatter();

  const question = assessment.questions[currentQuestion];
  if (!question) return null;

  const selectedAnswer = answers[question.id];
  const isLikert = isLikertQuestion(question.options);

  const progress = Math.round(((currentQuestion + 1) / assessment.questions.length) * 100);

  const remainingQuestions = assessment.questions.length - currentQuestion - 1;
  const remainingSeconds = remainingQuestions * SECONDS_PER_QUESTION;
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  const currentDimension = question.dimension ? DIMENSION_NAMES[question.dimension] || null : null;
  const answeredCount = Object.keys(answers).length;

  const saveMeta = {
    idle: { icon: Save, label: t('draft.idle'), className: 'text-muted-foreground' },
    saving: { icon: Loader2, label: t('draft.saving'), className: 'text-muted-foreground' },
    saved: { icon: CheckCircle2, label: t('draft.saved'), className: 'text-success' },
    error: { icon: AlertCircle, label: t('draft.error'), className: 'text-destructive' },
  }[saveStatus];
  const SaveIcon = saveMeta.icon;

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* Progress info */}
      <div className="space-y-3 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="font-medium">
              {currentQuestion + 1} / {assessment.questions.length}
            </span>
            <span>
              {t('answeredProgress', {
                answered: answeredCount,
                total: assessment.questions.length,
              })}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {currentDimension && (
              <Badge variant="outline" className="bg-primary/5 dark:bg-primary/10">
                <Target className="mr-1 h-3 w-3" />
                {currentDimension}
              </Badge>
            )}
            <span className={cn('inline-flex items-center gap-1', saveMeta.className)}>
              <SaveIcon className={cn('h-3.5 w-3.5', saveStatus === 'saving' && 'animate-spin')} />
              {saveMeta.label}
              {lastSavedAt && saveStatus === 'saved'
                ? ` · ${format.dateTime(lastSavedAt, 'short')}`
                : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {remainingQuestions > 0 && (
              <span className="text-muted-foreground">
                {t('timeRemaining', { minutes: remainingMinutes })}
              </span>
            )}
            {onExit ? (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onExit}>
                <X className="h-3.5 w-3.5" />
                {t('exit')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Question card */}
        <Card className="p-4 sm:p-6">
          <h3 className="mb-4 text-base font-semibold leading-relaxed sm:mb-6 sm:text-lg">
            {question.textZh}
          </h3>

          {isLikert ? (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex justify-between px-1 text-xs text-muted-foreground sm:text-sm">
                <span>{t('likert.stronglyDisagree')}</span>
                <span>{t('likert.stronglyAgree')}</span>
              </div>

              <div className="flex justify-between gap-2 px-1 sm:gap-3">
                {question.options.map((option, index) => (
                  <motion.button
                    key={option.value}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => onSelectAnswer(question.id, String(option.value))}
                    className={cn(
                      'flex-1 min-w-[44px] min-h-[44px] sm:min-w-[56px] sm:min-h-[56px]',
                      'aspect-square rounded-full border-2 flex items-center justify-center',
                      'transition-all duration-200 font-semibold text-base sm:text-lg',
                      selectedAnswer === String(option.value)
                        ? 'border-primary bg-primary text-white scale-105 sm:scale-110 shadow-lg shadow-primary/30'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50 active:scale-95'
                    )}
                  >
                    {option.value}
                  </motion.button>
                ))}
              </div>

              <div className="hidden justify-between gap-1 px-1 text-xs text-muted-foreground sm:flex">
                {question.options.map((option) => (
                  <span key={option.value} className="flex-1 truncate text-center">
                    {option.textZh}
                  </span>
                ))}
              </div>

              <div className="hidden justify-center sm:flex">
                <span className="rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground dark:bg-muted/30">
                  {t('keyboardHint')}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {question.options.map((option, index) => (
                <motion.button
                  key={option.value}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectAnswer(question.id, String(option.value))}
                  className={cn(
                    'w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all min-h-[52px]',
                    'active:scale-[0.98]',
                    selectedAnswer === String(option.value)
                      ? 'border-primary bg-primary/10 dark:bg-primary/20'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        selectedAnswer === String(option.value)
                          ? 'border-primary bg-primary text-white'
                          : 'border-muted-foreground'
                      )}
                    >
                      {selectedAnswer === String(option.value) && (
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      )}
                    </div>
                    <span className="text-sm sm:text-base">{option.textZh}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </Card>

        <Card className="hidden p-4 lg:block">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-primary" />
            {t('questionNavigator')}
          </div>
          <div className="grid max-h-[360px] grid-cols-6 gap-2 overflow-y-auto pr-1">
            {assessment.questions.map((item, index) => {
              const answered = Boolean(answers[item.id]);
              const active = index === currentQuestion;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onJumpToQuestion?.(index)}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md border text-xs transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : answered
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} disabled={currentQuestion === 0}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('prev')}
        </Button>

        {currentQuestion === assessment.questions.length - 1 ? (
          <Button onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="mr-2 h-4 w-4" />
            )}
            {t('submit')}
          </Button>
        ) : (
          <Button onClick={onNext} disabled={!selectedAnswer}>
            {t('next')}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
