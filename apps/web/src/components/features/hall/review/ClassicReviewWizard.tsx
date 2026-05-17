'use client';

/**
 * ClassicReviewWizard — slider + textarea review flow (fallback mode).
 *
 * Four sequential dimension steps (academic / test / activity / award) followed
 * by a summary step. Scores/comments accumulate locally and submit once via the
 * parent `onSubmit` callback — fixing the legacy per-module overwrite bug.
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ChevronLeft, ChevronRight, Send, Star, Tag, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  REVIEW_DIMENSIONS,
  REVIEW_TAGS,
  DEFAULT_SCORES,
  DEFAULT_COMMENTS,
  computeOverall,
  type DimensionKey,
  type ReviewScores,
  type ReviewComments,
} from './review-shared';

export interface ClassicReviewSubmitPayload {
  scores: ReviewScores;
  comments: ReviewComments;
  tags: string[];
}

interface ClassicReviewWizardProps {
  onSubmit: (payload: ClassicReviewSubmitPayload) => void;
  isSubmitting: boolean;
}

type Step = DimensionKey | 'summary';

const STEPS: Step[] = ['academic', 'test', 'activity', 'award', 'summary'];

export function ClassicReviewWizard({ onSubmit, isSubmitting }: ClassicReviewWizardProps) {
  const t = useTranslations();

  const [step, setStep] = useState<Step>('academic');
  const [scores, setScores] = useState<ReviewScores>(DEFAULT_SCORES);
  const [comments, setComments] = useState<ReviewComments>(DEFAULT_COMMENTS);
  const [tags, setTags] = useState<string[]>([]);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const suggestedOverall = useMemo(() => Math.round(computeOverall(scores)), [scores]);

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit({ scores, comments, tags });
  }, [onSubmit, scores, comments, tags]);

  const renderDimension = (dimension: DimensionKey) => {
    const config = REVIEW_DIMENSIONS.find((d) => d.key === dimension)!;
    const Icon = config.icon;
    return (
      <Card className="overflow-hidden">
        <div className={cn('h-1.5', config.bg.replace('/10', ''))} />
        <CardHeader>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                config.bg,
                config.color
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{t(`hall.review.dimension.${dimension}`)}</CardTitle>
              <CardDescription>{t(`hall.review.dimensionDesc.${dimension}`)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('hall.review.score')}</span>
              <span className="text-2xl font-bold">{scores[dimension]}/10</span>
            </div>
            <Slider
              value={[scores[dimension]]}
              min={1}
              max={10}
              step={1}
              onValueChange={([val]) => setScores((prev) => ({ ...prev, [dimension]: val }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('hall.review.weak')}</span>
              <span>{t('hall.review.average')}</span>
              <span>{t('hall.review.excellent')}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('hall.review.moduleComment')}</label>
            <Textarea
              value={comments[dimension]}
              onChange={(e) => setComments((prev) => ({ ...prev, [dimension]: e.target.value }))}
              placeholder={t(`hall.review.commentHint.${dimension}`)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={goBack} disabled={stepIndex === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
            <Button onClick={goNext} className="gap-1">
              {t('common.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSummary = () => (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-primary to-destructive" />
      <CardHeader>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Star className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg">{t('hall.review.summary')}</CardTitle>
            <CardDescription>{t('hall.review.summaryDesc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {REVIEW_DIMENSIONS.map((dim) => {
            const Icon = dim.icon;
            return (
              <div key={dim.key} className={cn('rounded-xl p-4 text-center min-w-0', dim.bg)}>
                <Icon className={cn('h-6 w-6 mx-auto mb-1', dim.color)} />
                <p className="text-xs text-muted-foreground">
                  {t(`hall.review.dimension.${dim.key}`)}
                </p>
                <p className="text-xl font-bold">{scores[dim.key]}/10</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('hall.review.finalScore')}</span>
            <span className="text-3xl font-bold text-primary">{scores.overall}/10</span>
          </div>
          <Slider
            value={[scores.overall]}
            min={1}
            max={10}
            step={1}
            onValueChange={([val]) => setScores((prev) => ({ ...prev, overall: val }))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground text-center">
            {t('hall.review.suggestedScore', { score: suggestedOverall })}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('hall.review.tags')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => (
              <Badge
                key={tag}
                variant={tags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => toggleTag(tag)}
              >
                {t(`hall.review.quickTag.${tag}`)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('hall.review.generalComment')}</label>
          <Textarea
            value={comments.general}
            onChange={(e) => setComments((prev) => ({ ...prev, general: e.target.value }))}
            placeholder={t('hall.review.generalCommentHint')}
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Stage 6 — review-is-opinion compliance disclaimer */}
        <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{t('hall.review.disclaimer')}</span>
        </p>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={goBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              t('hall.review.processing')
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t('hall.review.submitReview')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="w-full bg-muted rounded-full h-1.5">
        <motion.div
          className="bg-primary h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'summary' ? renderSummary() : renderDimension(step)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
