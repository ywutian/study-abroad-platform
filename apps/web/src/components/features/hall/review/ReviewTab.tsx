'use client';

/**
 * ReviewTab — 同伴反馈 (peer feedback) tab orchestrator.
 *
 * Plan C / batch C2: numeric scoring was removed. The flow is now two stages:
 *   1. Select a public profile (ProfileSelector).
 *   2. Write qualitative feedback (QualitativeReviewForm) and submit.
 *
 * The legacy `choose-mode` stage (Swipe vs Classic wizard) is gone — there is
 * one qualitative form, one submit path, and no score fields.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, GraduationCap, ArrowLeft } from 'lucide-react';
import { useSubmitReview } from '@/hooks/use-hall-api';
import { ProfileSelector } from '@/components/features';
import type { PublicProfile } from '@/types/hall';
import {
  QualitativeReviewForm,
  type QualitativeReviewSubmitPayload,
} from './QualitativeReviewForm';

type Stage = 'select-profile' | 'write-review';

export function ReviewTab() {
  const t = useTranslations();

  const [stage, setStage] = useState<Stage>('select-profile');
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const submitReview = useSubmitReview();

  const reset = useCallback(() => {
    setStage('select-profile');
    setProfile(null);
  }, []);

  const handleSubmit = useCallback(
    (payload: QualitativeReviewSubmitPayload) => {
      if (!profile) return;
      const { comments, tags } = payload;
      submitReview.mutate(
        {
          profileUserId: profile.userId,
          comment: comments.general,
          academicComment: comments.academic || undefined,
          testComment: comments.test || undefined,
          activityComment: comments.activity || undefined,
          awardComment: comments.award || undefined,
          quickTags: tags.length > 0 ? tags : undefined,
          tags: tags.length > 0 ? tags : undefined,
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
                setStage('write-review');
              }}
              selectedProfileId={undefined}
            />
          </CardContent>
        </Card>
      )}

      {/* Stage 2 — qualitative feedback form */}
      {stage === 'write-review' && profile && (
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

          <QualitativeReviewForm onSubmit={handleSubmit} isSubmitting={submitReview.isPending} />
        </div>
      )}
    </motion.div>
  );
}
