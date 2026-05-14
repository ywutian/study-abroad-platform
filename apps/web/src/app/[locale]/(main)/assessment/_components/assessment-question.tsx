'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, ChevronRight, ChevronLeft, Check, Lightbulb, Target } from 'lucide-react';
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
}: AssessmentQuestionProps) {
  const t = useTranslations('assessment');

  const question = assessment.questions[currentQuestion];
  if (!question) return null;

  const selectedAnswer = answers[question.id];
  const isLikert = isLikertQuestion(question.options);

  const progress = Math.round(((currentQuestion + 1) / assessment.questions.length) * 100);

  const remainingQuestions = assessment.questions.length - currentQuestion - 1;
  const remainingSeconds = remainingQuestions * SECONDS_PER_QUESTION;
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  const currentDimension = question.dimension ? DIMENSION_NAMES[question.dimension] || null : null;

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* Progress info */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span className="font-medium">
              {currentQuestion + 1} / {assessment.questions.length}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {currentDimension && (
            <Badge variant="outline" className="bg-primary/5 dark:bg-primary/10">
              <Target className="h-3 w-3 mr-1" />
              {currentDimension}
            </Badge>
          )}
          {remainingQuestions > 0 && (
            <span className="text-muted-foreground">
              {t('timeRemaining', { minutes: remainingMinutes })}
            </span>
          )}
        </div>
      </div>

      {/* Question card */}
      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 leading-relaxed">
          {question.textZh}
        </h3>

        {isLikert ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex justify-between text-xs sm:text-sm text-muted-foreground px-1">
              <span>{t('likert.stronglyDisagree')}</span>
              <span>{t('likert.stronglyAgree')}</span>
            </div>

            <div className="flex justify-between gap-2 sm:gap-3 px-1">
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

            <div className="hidden sm:flex justify-between gap-1 text-xs text-muted-foreground px-1">
              {question.options.map((option) => (
                <span key={option.value} className="flex-1 text-center truncate">
                  {option.textZh}
                </span>
              ))}
            </div>

            <div className="hidden sm:flex justify-center">
              <span className="text-xs text-muted-foreground bg-muted/50 dark:bg-muted/30 px-3 py-1 rounded-full">
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
