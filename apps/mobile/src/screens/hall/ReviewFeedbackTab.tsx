/**
 * ReviewFeedbackTab — qualitative peer feedback (Hall Plan C / batch C2).
 *
 * Replaces the legacy Tinder-style swipe deck that mapped swipe directions to
 * 1-10 scores. Untrained peers numerically grading each other produced an
 * unreliable verdict, so the review is now qualitative-only:
 *
 *   1. Read a desensitized public profile (ReviewProfileCard).
 *   2. Optionally write a short note per dimension + pick quick tags.
 *   3. Write a required overall reflection, then submit.
 *
 * A `qualitative` review is POSTed to `/halls/reviews` with written feedback
 * only — no score fields. The reviewee never sees a numeric average.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState, Loading, Input, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { hallRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';
import {
  REVIEW_STEPS,
  REVIEW_TAGS,
  MIN_FEEDBACK_LENGTH,
  type CreateReviewDto,
  type ReviewProfileCard as ReviewProfileCardData,
  type ReviewStep,
} from './types';
import ReviewProfileCard from './ReviewProfileCard';

type ProfilesResponse = { items: ReviewProfileCardData[] } | ReviewProfileCardData[];

function normalizeProfiles(data: ProfilesResponse | undefined): ReviewProfileCardData[] {
  if (!data) return [];
  return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
}

type DimensionComments = Record<ReviewStep, string>;
const EMPTY_COMMENTS: DimensionComments = { academic: '', test: '', activity: '', award: '' };

/** Map per-dimension comment keys to the `CreateReviewDto` field names. */
const DTO_COMMENT_FIELD: Record<ReviewStep, keyof CreateReviewDto> = {
  academic: 'academicComment',
  test: 'testComment',
  activity: 'activityComment',
  award: 'awardComment',
};

export function ReviewFeedbackTab() {
  const { t } = useTranslation();
  const c = useColors();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const [profileIndex, setProfileIndex] = useState(0);
  const [comments, setComments] = useState<DimensionComments>(EMPTY_COMMENTS);
  const [general, setGeneral] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery<ProfilesResponse>({
    queryKey: ['hall-review-profiles'],
    queryFn: () =>
      apiClient.get<ProfilesResponse>(hallRoutes.publicProfiles(), { params: { limit: 20 } }),
    staleTime: 2 * 60_000,
  });

  const profiles = normalizeProfiles(data);
  const currentProfile = profiles[profileIndex];
  const generalTooShort = general.trim().length < MIN_FEEDBACK_LENGTH;

  const submitReview = useMutation<unknown, Error, CreateReviewDto>({
    mutationFn: (dto) => apiClient.post(hallRoutes.reviews(), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-reviews'] });
    },
    onError: (err) => {
      toastRef.current.show({ type: 'error', message: err.message });
    },
  });

  const resetForm = useCallback(() => {
    setComments(EMPTY_COMMENTS);
    setGeneral('');
    setTags([]);
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!currentProfile || generalTooShort) return;
    const dto: CreateReviewDto = {
      profileUserId: currentProfile.userId,
      comment: general.trim(),
      quickTags: tags.length > 0 ? tags : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
    for (const step of REVIEW_STEPS) {
      const text = comments[step].trim();
      if (text) dto[DTO_COMMENT_FIELD[step]] = text as never;
    }
    submitReview.mutate(dto, {
      onSuccess: () => {
        toastRef.current.show({ type: 'success', message: t('hall.review.created') });
        resetForm();
        setProfileIndex((i) => i + 1);
      },
    });
  }, [currentProfile, generalTooShort, general, tags, comments, submitReview, t, resetForm]);

  if (isLoading) return <Loading text={t('hall.loading')} />;

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title={t('hall.review.noProfiles')}
        description={t('hall.review.noProfilesDesc')}
      />
    );
  }

  const deckExhausted = profileIndex >= profiles.length;

  if (deckExhausted) {
    return (
      <EmptyState
        icon="checkmark-done-outline"
        title={t('hall.review.emptyDesc')}
        description={t('hall.review.next')}
        action={{
          label: t('hall.review.next'),
          onPress: () => {
            setProfileIndex(0);
            resetForm();
            refetch();
          },
        }}
      />
    );
  }

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[S.progress, { color: c.foregroundMuted }]}>
        {t('hall.review.stepProgress', {
          current: Math.min(profileIndex + 1, profiles.length),
          total: profiles.length,
        })}
      </Text>

      {currentProfile && <ReviewProfileCard profile={currentProfile} />}

      {/* Per-dimension written feedback */}
      {REVIEW_STEPS.map((step) => (
        <Input
          key={step}
          label={t(`hall.review.steps.${step}`)}
          hint={t('hall.review.dimensionFeedback')}
          placeholder={t(`hall.review.commentHint.${step}`)}
          value={comments[step]}
          onChangeText={(text) => setComments((prev) => ({ ...prev, [step]: text }))}
          multiline
          numberOfLines={3}
          style={S.multiline}
        />
      ))}

      {/* Quick tags */}
      <View style={S.tagsBlock}>
        <Text style={[S.label, { color: c.foreground }]}>{t('hall.review.tags')}</Text>
        <View style={S.tagsWrap}>
          {REVIEW_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  S.tag,
                  {
                    backgroundColor: selected ? withOpacity(c.primary, 0.15) : c.muted,
                    borderColor: selected ? c.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[S.tagText, { color: selected ? c.primary : c.foregroundMuted }]}>
                  {t(`hall.review.quickTag.${tag}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Overall written feedback (required) */}
      <Input
        label={t('hall.review.generalComment')}
        hint={t('hall.review.generalCommentMin', { min: MIN_FEEDBACK_LENGTH })}
        placeholder={t('hall.review.generalCommentHint')}
        value={general}
        onChangeText={setGeneral}
        multiline
        numberOfLines={4}
        style={S.multiline}
      />

      {/* Review-is-opinion compliance disclaimer */}
      <View style={S.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={c.foregroundMuted} />
        <Text style={[S.disclaimerText, { color: c.foregroundMuted }]}>
          {t('hall.review.disclaimer')}
        </Text>
      </View>

      <Button onPress={handleSubmit} disabled={generalTooShort} loading={submitReview.isPending}>
        {submitReview.isPending ? t('hall.review.submitting') : t('hall.review.submit')}
      </Button>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  progress: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  tagsBlock: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  disclaimerText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.4,
  },
});
