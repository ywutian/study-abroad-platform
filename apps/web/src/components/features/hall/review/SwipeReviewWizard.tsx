'use client';

/**
 * SwipeReviewWizard — Tinder-style review flow.
 *
 * Single card, 4 sequential dimension steps (academic / test / activity / award).
 * Three swipe directions per step:
 *   left  → not_enough   (low score)
 *   up    → unsure       (neutral score)
 *   right → impressive   (high score)
 * Drag distance maps to a 0-100 confidence which nudges the score within its
 * band (see `swipeToScore`). A final step collects a ≥5-char rationale plus
 * optional quick tags, then submits with reviewMethod='SWIPE' + swipeData.
 *
 * Gesture physics are shared with the case deck via `useSwipeGesture`.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  ThumbsDown,
  ThumbsUp,
  HelpCircle,
  ChevronLeft,
  Send,
  Star,
  Send as SendIcon,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSwipeGesture,
  type SwipeDirection,
  type SwipeGestureResult,
} from '@/lib/hooks/useSwipeGesture';
import {
  REVIEW_DIMENSIONS,
  REVIEW_TAGS,
  MIN_RATIONALE_LENGTH,
  computeOverall,
  swipeToScore,
  type DimensionKey,
  type ReviewScores,
} from './review-shared';
import type { ReviewSwipeData, ReviewSwipeDirection } from '@/hooks/use-hall-api';
import type { PublicProfile } from '@/types/hall';

export interface SwipeReviewSubmitPayload {
  scores: ReviewScores;
  rationale: string;
  tags: string[];
  swipeData: ReviewSwipeData;
  reviewerConfidence: number;
}

interface SwipeReviewWizardProps {
  profile: PublicProfile;
  onSubmit: (payload: SwipeReviewSubmitPayload) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

/** Visual config for the three swipe directions. */
const DIRECTION_META: Record<
  SwipeDirection,
  { icon: typeof ThumbsUp; label: string; tone: string }
> = {
  left: { icon: ThumbsDown, label: 'notEnough', tone: 'text-rose-500' },
  up: { icon: HelpCircle, label: 'unsure', tone: 'text-amber-500' },
  right: { icon: ThumbsUp, label: 'impressive', tone: 'text-emerald-500' },
};

export function SwipeReviewWizard({
  profile,
  onSubmit,
  onCancel,
  isSubmitting,
}: SwipeReviewWizardProps) {
  const t = useTranslations();

  // step 0-3 = dimensions; step 4 = rationale.
  const [step, setStep] = useState(0);
  const [directions, setDirections] = useState<
    Partial<Record<DimensionKey, ReviewSwipeDirection>>
  >({});
  const [confidences, setConfidences] = useState<Partial<Record<DimensionKey, number>>>({});
  const [scores, setScores] = useState<Partial<Record<DimensionKey, number>>>({});
  const [rationale, setRationale] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [flyOut, setFlyOut] = useState<SwipeDirection | null>(null);

  const isRationaleStep = step >= REVIEW_DIMENSIONS.length;
  const currentDimension = REVIEW_DIMENSIONS[step];
  const totalSteps = REVIEW_DIMENSIONS.length + 1;

  const commitSwipe = useCallback(
    (result: SwipeGestureResult) => {
      if (isRationaleStep) return;
      const dim = REVIEW_DIMENSIONS[step].key;
      const score = swipeToScore(result.direction, result.confidence);
      setDirections((prev) => ({ ...prev, [dim]: result.direction }));
      setConfidences((prev) => ({ ...prev, [dim]: result.confidence }));
      setScores((prev) => ({ ...prev, [dim]: score }));
      setFlyOut(result.direction);
      // Advance after the fly-out animation.
      window.setTimeout(() => {
        setFlyOut(null);
        setStep((s) => s + 1);
      }, 280);
    },
    [isRationaleStep, step]
  );

  const { x, y, rotate, opacity, handleDragEnd } = useSwipeGesture({ onSwipe: commitSwipe });

  const goBack = useCallback(() => {
    if (step === 0) {
      onCancel();
      return;
    }
    setStep((s) => s - 1);
  }, [step, onCancel]);

  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }, []);

  const handleSubmit = useCallback(() => {
    if (rationale.trim().length < MIN_RATIONALE_LENGTH) return;
    const fullScores: ReviewScores = {
      academic: scores.academic ?? 5,
      test: scores.test ?? 5,
      activity: scores.activity ?? 5,
      award: scores.award ?? 5,
      overall: 5,
    };
    fullScores.overall = Math.round(computeOverall(fullScores));
    const confidenceValues = Object.values(confidences).filter(
      (v): v is number => typeof v === 'number'
    );
    const reviewerConfidence =
      confidenceValues.length > 0
        ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
        : 50;
    onSubmit({
      scores: fullScores,
      rationale: rationale.trim(),
      tags,
      swipeData: {
        directionsPerStep: directions,
        confidencePerStep: confidences,
      },
      reviewerConfidence,
    });
  }, [rationale, scores, confidences, directions, tags, onSubmit]);

  // ---- Dimension card content ----------------------------------------------

  const renderDimensionContent = (dimension: DimensionKey) => {
    switch (dimension) {
      case 'academic':
        return (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">GPA</span>
                <span className="text-2xl font-bold">
                  {profile.gpa != null
                    ? `${Number(profile.gpa).toFixed(2)}/${profile.gpaScale ?? 4.0}`
                    : t('common.notAvailable')}
                </span>
              </div>
              {profile.gpa != null && (
                <Progress
                  value={(Number(profile.gpa) / (profile.gpaScale || 4)) * 100}
                  className="h-2"
                />
              )}
              {profile.grade && (
                <p className="text-xs text-muted-foreground">{profile.grade}</p>
              )}
            </div>
          </div>
        );
      case 'test':
        return (
          <div className="space-y-2">
            {profile.testScores && profile.testScores.length > 0 ? (
              profile.testScores.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-muted/50 p-3"
                >
                  <span className="font-medium">{s.type}</span>
                  <span className="text-xl font-bold">{s.score}</span>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-muted/50 p-6 text-center text-muted-foreground">
                {t('hall.review.noTestScores')}
              </div>
            )}
          </div>
        );
      case 'activity':
        return (
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {profile.activities && profile.activities.length > 0 ? (
              profile.activities.slice(0, 5).map((a, i) => (
                <div key={i} className="rounded-xl bg-muted/50 p-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{a.role}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {a.category}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-muted/50 p-6 text-center text-muted-foreground">
                {t('hall.review.noActivities')}
              </div>
            )}
          </div>
        );
      case 'award':
        return (
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {profile.awards && profile.awards.length > 0 ? (
              profile.awards.slice(0, 5).map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.name}</p>
                    {a.year && <p className="text-sm text-muted-foreground">{a.year}</p>}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {a.level}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-muted/50 p-6 text-center text-muted-foreground">
                {t('hall.review.noAwards')}
              </div>
            )}
          </div>
        );
    }
  };

  // ---- Rationale step ------------------------------------------------------

  if (isRationaleStep) {
    const rationaleTooShort = rationale.trim().length < MIN_RATIONALE_LENGTH;
    return (
      <div className="space-y-6">
        <StepProgress current={totalSteps} total={totalSteps} />
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-destructive" />
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Star className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{t('hall.review.swipe.verdictTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('hall.review.swipe.verdictDesc')}
                </p>
              </div>
            </div>

            {/* Per-dimension swipe recap */}
            <div className="grid grid-cols-2 gap-3">
              {REVIEW_DIMENSIONS.map((dim) => {
                const Icon = dim.icon;
                const dir = directions[dim.key];
                return (
                  <div key={dim.key} className={cn('rounded-xl p-3 text-center min-w-0', dim.bg)}>
                    <Icon className={cn('h-5 w-5 mx-auto mb-1', dim.color)} />
                    <p className="text-xs text-muted-foreground truncate">
                      {t(`hall.review.dimension.${dim.key}`)}
                    </p>
                    <p className="text-lg font-bold">{scores[dim.key] ?? '-'}/10</p>
                    {dir && (
                      <p className="text-2xs text-muted-foreground">
                        {t(`hall.review.swipe.direction.${DIRECTION_META[dir].label}`)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rationale */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('hall.review.swipe.rationale')}</label>
              <Textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder={t('hall.review.swipe.rationaleHint')}
                rows={4}
                className="resize-none"
              />
              <p
                className={cn(
                  'text-xs',
                  rationaleTooShort ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {t('hall.review.swipe.rationaleMin', { min: MIN_RATIONALE_LENGTH })}
              </p>
            </div>

            {/* Quick tags */}
            <div className="space-y-2">
              <span className="text-sm font-medium">{t('hall.review.swipe.quickTags')}</span>
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
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || rationaleTooShort}
                className="gap-2"
              >
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
      </div>
    );
  }

  // ---- Dimension swipe step ------------------------------------------------

  const dim = currentDimension;
  const DimIcon = dim.icon;

  return (
    <div className="space-y-6">
      <StepProgress current={step + 1} total={totalSteps} />

      <div className="relative flex flex-col items-center">
        {/* Direction hints */}
        <div className="mb-3 flex w-full max-w-md items-center justify-between text-xs">
          {(['left', 'up', 'right'] as const).map((d) => {
            const meta = DIRECTION_META[d];
            const DIcon = meta.icon;
            return (
              <div key={d} className="flex items-center gap-1">
                <DIcon className={cn('h-4 w-4', meta.tone)} />
                <span className="text-muted-foreground">
                  {t(`hall.review.swipe.direction.${meta.label}`)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Swipe card */}
        <div className="relative h-[420px] w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={dim.key}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              style={{ x, y, rotate, opacity }}
              drag={!flyOut}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.92, opacity: 0, y: 40 }}
              animate={
                flyOut
                  ? {
                      x: flyOut === 'right' ? 320 : flyOut === 'left' ? -320 : 0,
                      y: flyOut === 'up' ? -360 : 0,
                      opacity: 0,
                      scale: 0.85,
                    }
                  : { scale: 1, opacity: 1, y: 0 }
              }
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            >
              <Card className="h-full overflow-hidden border-border/60 shadow-2xl">
                <div className={cn('h-1.5', dim.bg.replace('/10', ''))} />
                <CardContent className="flex h-full flex-col gap-4 pt-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                        dim.bg,
                        dim.color
                      )}
                    >
                      <DimIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold truncate">
                        {t(`hall.review.dimension.${dim.key}`)}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {t(`hall.review.dimensionDesc.${dim.key}`)}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">{renderDimensionContent(dim.key)}</div>
                  <p className="text-center text-xs text-muted-foreground">
                    {t('hall.review.swipe.dragHint')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Tap-to-swipe fallback buttons */}
        <div className="mt-4 flex items-center gap-3">
          {(['left', 'up', 'right'] as const).map((d) => {
            const meta = DIRECTION_META[d];
            const DIcon = meta.icon;
            return (
              <Button
                key={d}
                variant="outline"
                size="lg"
                aria-label={t(`hall.review.swipe.direction.${meta.label}`)}
                className="h-12 w-12 rounded-full"
                disabled={!!flyOut}
                onClick={() => commitSwipe({ direction: d, confidence: 60 })}
              >
                <DIcon className={cn('h-5 w-5', meta.tone)} />
              </Button>
            );
          })}
        </div>

        <div className="mt-4 flex w-full max-w-md justify-between">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? t('common.cancel') : t('common.back')}
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <SendIcon className="h-3 w-3" />
            {t('hall.review.swipe.stepCounter', { current: step + 1, total: totalSteps })}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            i < current ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
}
