/**
 * ReviewSwipeTab — Tinder-style peer review (Hall refactor Stage 4 M4).
 *
 * Replaces the legacy slider-modal review flow. The reviewer walks a deck of
 * desensitized public profiles; each profile is reviewed across 4 dimension
 * steps (academic / test / activity / award) via swipe:
 *   right = strong · left = weak · up = unsure (excluded from the average).
 *
 * When all 4 steps of a profile are scored, a `SWIPE`-method review is POSTed
 * to `/halls/reviews` with `swipeData.directionsPerStep` for transparency.
 *
 * Cannot reuse the web framer-motion SwipeStack — built on Reanimated 4 +
 * react-native-gesture-handler, mirroring `screens/swipe/GameView.tsx`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { hallRoutes } from '@study-abroad/shared';
import type { ReviewSwipeData, ReviewSwipeDirection } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';
import {
  REVIEW_STEPS,
  SWIPE_SCORE,
  type CreateReviewDto,
  type ReviewProfileCard as ReviewProfileCardData,
  type ReviewStep,
} from './types';
import ReviewProfileCard from './ReviewProfileCard';

const { width: SCREEN_W, height: SCREEN_H } = require('react-native').Dimensions.get('window');
const SWIPE_X_THRESHOLD = SCREEN_W * 0.28;
const SWIPE_UP_THRESHOLD = SCREEN_H * 0.14;

type ProfilesResponse = { items: ReviewProfileCardData[] } | ReviewProfileCardData[];

function normalizeProfiles(data: ProfilesResponse | undefined): ReviewProfileCardData[] {
  if (!data) return [];
  return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
}

/** Build a SWIPE-method review DTO from one profile's collected directions. */
function buildReviewDto(
  profileUserId: string,
  directions: Partial<Record<ReviewStep, ReviewSwipeDirection>>
): CreateReviewDto {
  const score = (step: ReviewStep): number => SWIPE_SCORE[directions[step] ?? 'up'];
  // `up` (unsure) steps are excluded from the overall average to avoid bias.
  const scored = REVIEW_STEPS.filter((s) => directions[s] && directions[s] !== 'up');
  const overall =
    scored.length > 0
      ? Math.round(scored.reduce((sum, s) => sum + score(s), 0) / scored.length)
      : 5;
  const swipeData: ReviewSwipeData = {
    directionsPerStep: {
      academic: directions.academic,
      test: directions.test,
      activity: directions.activity,
      award: directions.award,
    },
    totalSteps: REVIEW_STEPS.length,
  };
  return {
    profileUserId,
    academicScore: score('academic'),
    testScore: score('test'),
    activityScore: score('activity'),
    awardScore: score('award'),
    overallScore: overall,
    method: 'SWIPE',
    swipeData,
  };
}

export function ReviewSwipeTab() {
  const { t } = useTranslation();
  const c = useColors();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const [profileIndex, setProfileIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  // Directions collected for the profile currently under review.
  const directionsRef = useRef<Partial<Record<ReviewStep, ReviewSwipeDirection>>>({});

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const { data, isLoading, refetch } = useQuery<ProfilesResponse>({
    queryKey: ['hall-review-profiles'],
    queryFn: () =>
      apiClient.get<ProfilesResponse>(hallRoutes.publicProfiles(), { params: { limit: 20 } }),
    staleTime: 2 * 60_000,
  });

  const profiles = normalizeProfiles(data);
  const currentProfile = profiles[profileIndex];
  const nextProfile = profiles[profileIndex + 1];
  const currentStep: ReviewStep = REVIEW_STEPS[stepIndex];

  const submitReview = useMutation<unknown, Error, CreateReviewDto>({
    mutationFn: (dto) => apiClient.post(hallRoutes.reviews(), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-reviews'] });
    },
    onError: (err) => {
      toastRef.current.show({ type: 'error', message: err.message });
    },
  });

  const resetCard = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [translateX, translateY]);

  // Advance one step; when the 4th step is scored, submit + move to next profile.
  const advance = useCallback(
    (direction: ReviewSwipeDirection) => {
      directionsRef.current[currentStep] = direction;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const isLastStep = stepIndex >= REVIEW_STEPS.length - 1;
      if (isLastStep) {
        if (currentProfile) {
          submitReview.mutate(buildReviewDto(currentProfile.userId, directionsRef.current));
          toastRef.current.show({ type: 'success', message: t('hall.review.created') });
        }
        directionsRef.current = {};
        setStepIndex(0);
        setProfileIndex((i) => i + 1);
      } else {
        setStepIndex((i) => i + 1);
      }
      resetCard();
      setIsAnimating(false);
    },
    [currentStep, stepIndex, currentProfile, submitReview, t, resetCard]
  );

  const onSwipeRight = useCallback(() => advance('right'), [advance]);
  const onSwipeLeft = useCallback(() => advance('left'), [advance]);
  const onSwipeUp = useCallback(() => advance('up'), [advance]);

  const panGesture = Gesture.Pan()
    .enabled(!isAnimating && !!currentProfile)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const absX = Math.abs(e.translationX);
      if (-e.translationY > SWIPE_UP_THRESHOLD && -e.translationY > absX) {
        translateY.value = withTiming(-SCREEN_H, { duration: 280 });
        runOnJS(setIsAnimating)(true);
        runOnJS(onSwipeUp)();
        return;
      }
      if (e.translationX > SWIPE_X_THRESHOLD) {
        translateX.value = withTiming(SCREEN_W * 1.5, { duration: 280 });
        runOnJS(setIsAnimating)(true);
        runOnJS(onSwipeRight)();
        return;
      }
      if (e.translationX < -SWIPE_X_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_W * 1.5, { duration: 280 });
        runOnJS(setIsAnimating)(true);
        runOnJS(onSwipeLeft)();
        return;
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-14, 0, 14],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  const strongOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_X_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const weakOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_X_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const unsureOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_UP_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.max(Math.abs(translateX.value), Math.abs(translateY.value));
    return {
      transform: [
        { scale: interpolate(progress, [0, SWIPE_X_THRESHOLD], [0.94, 1], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(progress, [0, SWIPE_X_THRESHOLD], [0.6, 1], Extrapolation.CLAMP),
    };
  });

  useEffect(() => {
    resetCard();
  }, [stepIndex, profileIndex, resetCard]);

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

  return (
    <View style={S.container}>
      {/* Progress strip — step within the current profile */}
      <View style={S.progressRow}>
        {REVIEW_STEPS.map((step, i) => (
          <View
            key={step}
            style={[
              S.progressDot,
              {
                backgroundColor: i <= stepIndex && !deckExhausted ? c.primary : c.muted,
              },
            ]}
          />
        ))}
      </View>

      {deckExhausted ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={t('hall.review.emptyDesc')}
          description={t('hall.review.next')}
          action={{
            label: t('hall.review.next'),
            onPress: () => {
              setProfileIndex(0);
              setStepIndex(0);
              directionsRef.current = {};
              refetch();
            },
          }}
        />
      ) : (
        <View style={S.deck}>
          {nextProfile && (
            <Animated.View style={[S.cardWrap, S.nextCard, nextCardStyle]}>
              <ReviewProfileCard
                profile={nextProfile}
                step={REVIEW_STEPS[0]}
                stepIndex={0}
                totalSteps={REVIEW_STEPS.length}
                isTop={false}
              />
            </Animated.View>
          )}
          {currentProfile && (
            <GestureDetector gesture={panGesture}>
              <Animated.View
                entering={FadeIn.duration(220)}
                style={[S.cardWrap, cardAnimatedStyle]}
              >
                <ReviewProfileCard
                  profile={currentProfile}
                  step={currentStep}
                  stepIndex={stepIndex}
                  totalSteps={REVIEW_STEPS.length}
                  isTop
                  strongOverlayStyle={strongOverlayStyle}
                  weakOverlayStyle={weakOverlayStyle}
                  unsureOverlayStyle={unsureOverlayStyle}
                />
              </Animated.View>
            </GestureDetector>
          )}
        </View>
      )}

      <Text style={[S.footerHint, { color: c.foregroundMuted }]}>
        {t('hall.review.stepProgress', {
          current: Math.min(profileIndex + 1, profiles.length),
          total: profiles.length,
        })}
      </Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  deck: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    position: 'absolute',
    width: '100%',
  },
  nextCard: {
    zIndex: -1,
  },
  footerHint: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
