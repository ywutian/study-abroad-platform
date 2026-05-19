'use client';

/**
 * QualitativeReviewForm — single qualitative peer-feedback form.
 *
 * Plan C / batch C2: replaces the numeric `ClassicReviewWizard` (sliders) and
 * `SwipeReviewWizard` (swipe→score). No steps, no sliders, no N/10 readouts.
 *
 * The reviewer writes a short note per dimension (academic / test / activity /
 * award), picks optional quick tags, and writes a required overall reflection
 * (min length enforced). Submit sends `comment` + per-dimension `*Comment` +
 * `quickTags` only — no score fields.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageSquare, Tag, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  REVIEW_DIMENSIONS,
  REVIEW_TAGS,
  DEFAULT_COMMENTS,
  MIN_RATIONALE_LENGTH,
  type ReviewComments,
} from './review-shared';

export interface QualitativeReviewSubmitPayload {
  comments: ReviewComments;
  tags: string[];
}

interface QualitativeReviewFormProps {
  onSubmit: (payload: QualitativeReviewSubmitPayload) => void;
  isSubmitting: boolean;
}

export function QualitativeReviewForm({ onSubmit, isSubmitting }: QualitativeReviewFormProps) {
  const t = useTranslations();

  const [comments, setComments] = useState<ReviewComments>(DEFAULT_COMMENTS);
  const [tags, setTags] = useState<string[]>([]);

  const generalTooShort = comments.general.trim().length < MIN_RATIONALE_LENGTH;

  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }, []);

  const handleSubmit = useCallback(() => {
    if (generalTooShort) return;
    onSubmit({ comments, tags });
  }, [generalTooShort, onSubmit, comments, tags]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Per-dimension written feedback */}
      {REVIEW_DIMENSIONS.map((dim) => {
        const Icon = dim.icon;
        return (
          <Card key={dim.key} className="overflow-hidden">
            <div className={cn('h-1.5', dim.bg.replace('/10', ''))} />
            <CardHeader>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    dim.bg,
                    dim.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg">{t(`hall.review.dimension.${dim.key}`)}</CardTitle>
                  <CardDescription>{t(`hall.review.dimensionDesc.${dim.key}`)}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('hall.review.dimensionFeedback')}</label>
                <Textarea
                  value={comments[dim.key]}
                  onChange={(e) => setComments((prev) => ({ ...prev, [dim.key]: e.target.value }))}
                  placeholder={t(`hall.review.commentHint.${dim.key}`)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Quick tags + overall written feedback */}
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <CardHeader>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{t('hall.review.overallFeedback')}</CardTitle>
              <CardDescription>{t('hall.review.overallFeedbackDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <p
              className={cn(
                'text-xs',
                generalTooShort ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {t('hall.review.generalCommentMin', { min: MIN_RATIONALE_LENGTH })}
            </p>
          </div>

          {/* Review-is-opinion compliance disclaimer */}
          <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">{t('hall.review.disclaimer')}</span>
          </p>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || generalTooShort}
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
    </motion.div>
  );
}
