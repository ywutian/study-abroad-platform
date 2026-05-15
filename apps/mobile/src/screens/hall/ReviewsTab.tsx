import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, RefreshControl, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton, EmptyState, Loading, Segment, Modal } from '@/components/ui';
import { Slider } from '@/components/ui/Slider';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { API_ROUTES, hallRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import type { Review, ReviewsResponse, CreateReviewDto } from './types';
import { SCORE_LABELS } from './types';
import { ReviewItem } from './ReviewItem';

export function ReviewsTab() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [reviewMode, setReviewMode] = useState<'popular' | 'mine'>('popular');
  const [refreshing, setRefreshing] = useState(false);
  const [writeReviewVisible, setWriteReviewVisible] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState('');
  const [reviewScores, setReviewScores] = useState({
    academicScore: 5,
    testScore: 5,
    activityScore: 5,
    awardScore: 5,
    overallScore: 5,
  });
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState('');

  const {
    data: reviewsData,
    isLoading,
    refetch,
  } = useQuery<ReviewsResponse>({
    queryKey: ['hall-reviews', reviewMode],
    queryFn: () =>
      reviewMode === 'mine'
        ? apiClient.get<ReviewsResponse>(`${API_ROUTES.HALLS}/reviews/me`)
        : apiClient.get<ReviewsResponse>(`${API_ROUTES.HALLS}/reviews/popular`),
    staleTime: 2 * 60_000,
  });

  const createReviewMutation = useMutation<Review, Error, CreateReviewDto>({
    mutationFn: (dto) => apiClient.post<Review>(hallRoutes.reviews(), dto),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: t('hallOfFame.reviews.created'),
      });
      queryClient.invalidateQueries({ queryKey: ['hall-reviews'] });
      closeWriteReview();
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  const reactMutation = useMutation<
    void,
    Error,
    { reviewId: string; type: 'helpful' | 'insightful' }
  >({
    mutationFn: ({ reviewId, type }) => apiClient.post(hallRoutes.reviewReact(reviewId), { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-reviews'] });
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const openWriteReview = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReviewTargetId('');
    setReviewScores({
      academicScore: 5,
      testScore: 5,
      activityScore: 5,
      awardScore: 5,
      overallScore: 5,
    });
    setReviewComment('');
    setReviewTags('');
    setWriteReviewVisible(true);
  }, []);

  const closeWriteReview = useCallback(() => {
    setWriteReviewVisible(false);
    setReviewTargetId('');
  }, []);

  const submitReview = useCallback(() => {
    if (!reviewTargetId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const tags = reviewTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    createReviewMutation.mutate({
      profileUserId: reviewTargetId,
      ...reviewScores,
      comment: reviewComment || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  }, [reviewTargetId, reviewScores, reviewComment, reviewTags, createReviewMutation]);

  const handleReact = useCallback(
    (reviewId: string, type: 'helpful' | 'insightful') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      reactMutation.mutate({ reviewId, type });
    },
    [reactMutation]
  );

  const scoreLabel = useCallback(
    (key: string): string => {
      const map: Record<string, string> = {
        academic: t('hallOfFame.reviews.scores.academic'),
        test: t('hallOfFame.reviews.scores.test'),
        activity: t('hallOfFame.reviews.scores.activity'),
        award: t('hallOfFame.reviews.scores.award'),
        overall: t('hallOfFame.reviews.scores.overall'),
      };
      return map[key] || key;
    },
    [t]
  );

  const renderReviewCard = useCallback(
    ({ item }: { item: Review }) => <ReviewItem item={item} colors={c} onReact={handleReact} />,
    [c, handleReact]
  );

  if (isLoading) return <Loading text={t('hallOfFame.loading')} />;

  const reviews = reviewsData?.items || [];

  return (
    <View style={{ flex: 1 }}>
      <Animated.View entering={FadeInDown.duration(300)} style={S.reviewControls}>
        <Segment
          segments={[
            { key: 'popular', label: t('hallOfFame.reviews.popular') },
            { key: 'mine', label: t('hallOfFame.reviews.mine') },
          ]}
          value={reviewMode}
          onChange={(key) => setReviewMode(key as 'popular' | 'mine')}
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <AnimatedButton
          size="sm"
          onPress={openWriteReview}
          leftIcon={<Ionicons name="create-outline" size={16} color={c.primaryForeground} />}
        >
          {t('hallOfFame.reviews.write')}
        </AnimatedButton>
      </Animated.View>

      {reviews.length === 0 ? (
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title={t('hallOfFame.reviews.empty')}
          description={t('hallOfFame.reviews.emptyDesc')}
        />
      ) : (
        <FlashList
          data={reviews}
          renderItem={renderReviewCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Write Review Modal */}
      <Modal
        visible={writeReviewVisible}
        onClose={closeWriteReview}
        title={t('hallOfFame.reviews.writeReview')}
        footer={
          <View style={S.modalFooter}>
            <AnimatedButton variant="outline" onPress={closeWriteReview}>
              {t('hallOfFame.cancel')}
            </AnimatedButton>
            <AnimatedButton onPress={submitReview} loading={createReviewMutation.isPending}>
              {t('hallOfFame.reviews.submit')}
            </AnimatedButton>
          </View>
        }
      >
        <View style={S.modalBody}>
          <View style={S.inputGroup}>
            <Text style={[S.inputLabel, { color: c.foreground }]}>
              {t('hallOfFame.reviews.targetUser')}
            </Text>
            <TextInput
              style={[
                S.textInput,
                { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
              ]}
              value={reviewTargetId}
              onChangeText={setReviewTargetId}
              placeholder={t('hallOfFame.reviews.targetPlaceholder')}
              placeholderTextColor={c.placeholder}
            />
          </View>

          {SCORE_LABELS.map((key) => (
            <Slider
              key={key}
              label={scoreLabel(key)}
              value={reviewScores[`${key}Score` as keyof typeof reviewScores]}
              onValueChange={(val) =>
                setReviewScores((prev) => ({ ...prev, [`${key}Score`]: Math.round(val) }))
              }
              minimumValue={1}
              maximumValue={10}
              step={1}
            />
          ))}

          <View style={S.inputGroup}>
            <Text style={[S.inputLabel, { color: c.foreground }]}>
              {t('hallOfFame.reviews.comment')}
            </Text>
            <TextInput
              style={[
                S.textInput,
                S.textArea,
                { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
              ]}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder={t('hallOfFame.reviews.commentPlaceholder')}
              placeholderTextColor={c.placeholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={S.inputGroup}>
            <Text style={[S.inputLabel, { color: c.foreground }]}>
              {t('hallOfFame.reviews.tags')}
            </Text>
            <TextInput
              style={[
                S.textInput,
                { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
              ]}
              value={reviewTags}
              onChangeText={setReviewTags}
              placeholder={t('hallOfFame.reviews.tagsPlaceholder')}
              placeholderTextColor={c.placeholder}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalBody: {
    paddingBottom: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    minHeight: 48,
  },
  textArea: {
    minHeight: 120,
  },
});
