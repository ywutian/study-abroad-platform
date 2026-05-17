'use client';

/**
 * ReviewTab — 锐评模式标签页 orchestrator.
 *
 * Flow:
 *   1. Select a public profile (ProfileSelector).
 *   2. Pick a review mode — Swipe (Tinder) or Classic (slider).
 *   3. Run the chosen wizard; both accumulate into the same score shape and
 *      submit through a single `useSubmitReview` call.
 *
 * Replaces the legacy double-track design (ReviewTab + SwipeReviewMode overlay):
 * one orchestrator, two interchangeable wizards, one submit path.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, GraduationCap, Layers, Sparkles, ArrowLeft } from 'lucide-react';
import { useSubmitReview } from '@/hooks/use-hall-api';
import { ProfileSelector } from '@/components/features';
import { cn } from '@/lib/utils';
import type { PublicProfile } from '@/types/hall';
import { ClassicReviewWizard, type ClassicReviewSubmitPayload } from './ClassicReviewWizard';
import { SwipeReviewWizard, type SwipeReviewSubmitPayload } from './SwipeReviewWizard';

type ReviewMode = 'swipe' | 'classic';
type Stage = 'select-profile' | 'choose-mode' | 'review';

export function ReviewTab() {
  const t = useTranslations();

  const [stage, setStage] = useState<Stage>('select-profile');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [mode, setMode] = useState<ReviewMode>('swipe');

  const submitReview = useSubmitReview();

  const reset = useCallback(() => {
    setStage('select-profile');
    setProfile(null);
    setMode('swipe');
  }, []);

  const handleClassicSubmit = useCallback(
    (payload: ClassicReviewSubmitPayload) => {
      if (!profile) return;
      const { scores, comments, tags } = payload;
      submitReview.mutate(
        {
          profileUserId: profile.userId,
          academicScore: scores.academic,
          testScore: scores.test,
          activityScore: scores.activity,
          awardScore: scores.award,
          overallScore: scores.overall,
          comment: comments.general || undefined,
          academicComment: comments.academic || undefined,
          testComment: comments.test || undefined,
          activityComment: comments.activity || undefined,
          awardComment: comments.award || undefined,
          tags: tags.length > 0 ? tags : undefined,
          reviewMethod: 'CLASSIC',
          status: 'PUBLISHED',
        },
        {
          onSuccess: () => {
            toast.success(t('hall.review.submitSuccess'));
            reset();
          },
        }
      );
    },
    [profile, submitReview, t, reset]
  );

  const handleSwipeSubmit = useCallback(
    (payload: SwipeReviewSubmitPayload) => {
      if (!profile) return;
      const { scores, rationale, tags, swipeData, reviewerConfidence } = payload;
      submitReview.mutate(
        {
          profileUserId: profile.userId,
          academicScore: scores.academic,
          testScore: scores.test,
          activityScore: scores.activity,
          awardScore: scores.award,
          overallScore: scores.overall,
          comment: rationale,
          reviewMethod: 'SWIPE',
          swipeData,
          reviewerConfidence,
          quickTags: tags.length > 0 ? tags : undefined,
          status: 'PUBLISHED',
        },
        {
          onSuccess: () => {
            toast.success(t('hall.review.submitSuccess'));
            reset();
          },
        }
      );
    },
    [profile, submitReview, t, reset]
  );

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Stage 1 — profile selection */}
      {stage === 'select-profile' && (
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <CardHeader>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">{t('hall.review.selectProfile')}</CardTitle>
                <CardDescription>{t('hall.review.selectProfileDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProfileSelector
              onSelect={(p) => {
                setProfile(p);
                setStage('choose-mode');
              }}
              selectedProfileId={undefined}
            />
          </CardContent>
        </Card>
      )}

      {/* Stage 2 — mode selection */}
      {stage === 'choose-mode' && profile && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold truncate">
                  {profile.targetMajor || t('hall.review.noMajor')}
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  {profile.gpa != null && (
                    <Badge variant="secondary">GPA {Number(profile.gpa).toFixed(2)}</Badge>
                  )}
                  {profile._count?.activities != null && (
                    <span>
                      {t('hall.review.activitiesCount', { count: profile._count.activities })}
                    </span>
                  )}
                  {profile._count?.awards != null && (
                    <span>{t('hall.review.awardsCount', { count: profile._count.awards })}</span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={reset} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ModeCard
              active={mode === 'swipe'}
              icon={Sparkles}
              title={t('hall.review.mode.swipeTitle')}
              description={t('hall.review.mode.swipeDesc')}
              badge={t('hall.review.mode.recommended')}
              onSelect={() => setMode('swipe')}
            />
            <ModeCard
              active={mode === 'classic'}
              icon={Layers}
              title={t('hall.review.mode.classicTitle')}
              description={t('hall.review.mode.classicDesc')}
              onSelect={() => setMode('classic')}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStage('review')} className="gap-2">
              {t('hall.review.startReview')}
            </Button>
          </div>
        </div>
      )}

      {/* Stage 3 — the chosen wizard */}
      {stage === 'review' && profile && (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStage('choose-mode')}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('hall.review.changeMode')}
          </Button>
          {mode === 'swipe' ? (
            <SwipeReviewWizard
              profile={profile}
              onSubmit={handleSwipeSubmit}
              onCancel={() => setStage('choose-mode')}
              isSubmitting={submitReview.isPending}
            />
          ) : (
            <ClassicReviewWizard
              onSubmit={handleClassicSubmit}
              isSubmitting={submitReview.isPending}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}

interface ModeCardProps {
  active: boolean;
  icon: typeof Sparkles;
  title: string;
  description: string;
  badge?: string;
  onSelect: () => void;
}

function ModeCard({ active, icon: Icon, title, description, badge, onSelect }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-4 text-left transition-all min-w-0',
        active
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/40 hover:bg-muted/40'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {badge && (
          <Badge variant="secondary" className="text-2xs">
            {badge}
          </Badge>
        )}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
