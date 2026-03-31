/**
 * GameView — The main Tinder-like card swiping interface.
 *
 * Owns all Reanimated shared values, gesture handling, card animation,
 * batch loading, and the predict mutation. Renders StatsBar, card stack,
 * result overlay, and action buttons.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AnimatedButton } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

import {
  SwipeCaseDto,
  SwipeResultDto,
  PredictionType,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  SWIPE_THRESHOLD,
  SWIPE_DOWN_THRESHOLD,
  CARD_WIDTH,
  BATCH_SIZE,
  RELOAD_THRESHOLD,
} from './types';
import StatsBar from './StatsBar';
import CaseCard from './CaseCard';
import ResultOverlay from './ResultOverlay';

interface GameViewProps {
  onShowStats: () => void;
}

export default function GameView({ onShowStats }: GameViewProps) {
  const { t } = useTranslation();
  const c = useColors();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();

  const [cases, setCases] = useState<SwipeCaseDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resultOverlay, setResultOverlay] = useState<SwipeResultDto | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Shared values for card animation ──────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // ── Batch loading ─────────────────────────────────────
  const loadBatch = useCallback(async () => {
    try {
      const batch = await apiClient.get<SwipeCaseDto[]>(`${API_ROUTES.HALLS}/swipe/batch`, {
        params: { count: BATCH_SIZE },
      });
      setCases((prev) => [...prev, ...batch]);
    } catch (err) {
      if (err instanceof Error) {
        toastRef.current.show({ type: 'error', message: err.message });
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  // Auto-reload when running low
  useEffect(() => {
    const remaining = cases.length - currentIndex;
    if (remaining <= RELOAD_THRESHOLD && remaining > 0) {
      loadBatch();
    }
  }, [currentIndex, cases.length, loadBatch]);

  // ── Predict mutation ──────────────────────────────────
  const predictMutation = useMutation<
    SwipeResultDto,
    Error,
    { caseId: string; prediction: PredictionType }
  >({
    mutationFn: ({ caseId, prediction }) =>
      apiClient.post<SwipeResultDto>(`${API_ROUTES.HALLS}/swipe/predict`, { caseId, prediction }),
    onSuccess: (result) => {
      if (result.isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      setResultOverlay(result);
      queryClient.invalidateQueries({ queryKey: ['swipe', 'stats'] });

      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => {
        setResultOverlay(null);
        setCurrentIndex((idx) => idx + 1);
        setIsAnimating(false);
      }, 1500);
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      setIsAnimating(false);
    },
  });

  // ── Swipe handler ─────────────────────────────────────
  const handleSwipe = useCallback(
    (prediction: PredictionType) => {
      const currentCase = cases[currentIndex];
      if (!currentCase || isAnimating) return;
      setIsAnimating(true);
      predictMutation.mutate({ caseId: currentCase.id, prediction });
    },
    [cases, currentIndex, isAnimating, predictMutation]
  );

  const onSwipeRight = useCallback(() => handleSwipe('admit'), [handleSwipe]);
  const onSwipeLeft = useCallback(() => handleSwipe('reject'), [handleSwipe]);
  const onSwipeDown = useCallback(() => handleSwipe('waitlist'), [handleSwipe]);

  // ── Pan gesture ───────────────────────────────────────
  const panGesture = Gesture.Pan()
    .enabled(!isAnimating && currentIndex < cases.length)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const absX = Math.abs(e.translationX);
      const absY = e.translationY;

      if (absY > SWIPE_DOWN_THRESHOLD && absY > absX) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        translateX.value = withTiming(0, { duration: 300 });
        runOnJS(onSwipeDown)();
        return;
      }

      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        translateY.value = withTiming(e.translationY, { duration: 300 });
        runOnJS(onSwipeRight)();
        return;
      }

      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        translateY.value = withTiming(e.translationY, { duration: 300 });
        runOnJS(onSwipeLeft)();
        return;
      }

      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  // ── Animated styles ───────────────────────────────────
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-15, 0, 15],
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

  const admitOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SCREEN_WIDTH * 0.3],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const rejectOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 0.3, 0],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const waitlistOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT * 0.12],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const nextCardAnimStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.max(Math.abs(translateX.value), Math.abs(translateY.value)),
      [0, SWIPE_THRESHOLD],
      [0.92, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      opacity: interpolate(
        Math.max(Math.abs(translateX.value), Math.abs(translateY.value)),
        [0, SWIPE_THRESHOLD],
        [0.6, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  // ── Button-based prediction ───────────────────────────
  const handleButtonPredict = useCallback(
    (prediction: PredictionType) => {
      if (isAnimating || currentIndex >= cases.length) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (prediction === 'admit') {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 350 });
      } else if (prediction === 'reject') {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 350 });
      } else {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 350 });
      }

      handleSwipe(prediction);
    },
    [isAnimating, currentIndex, cases.length, handleSwipe, translateX, translateY]
  );

  // Reset card position when result overlay is cleared
  useEffect(() => {
    if (!resultOverlay) {
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [resultOverlay, translateX, translateY]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  // ── Current / Next case ───────────────────────────────
  const currentCase = cases[currentIndex];
  const nextCase = cases[currentIndex + 1];
  const disabled = isAnimating || !currentCase;

  // ── Render ────────────────────────────────────────────
  return (
    <View style={styles.gameContainer}>
      <StatsBar onShowStats={onShowStats} />

      {/* Card Stack */}
      {cases.length === 0 || currentIndex >= cases.length ? (
        <View style={styles.emptyStack}>
          <Ionicons name="albums-outline" size={64} color={c.foregroundMuted} />
          <Text style={[styles.emptyTitle, { color: c.foreground }]}>{t('swipe.noMoreCards')}</Text>
          <Text style={[styles.emptyDesc, { color: c.foregroundMuted }]}>
            {t('swipe.noMoreCardsDesc')}
          </Text>
          <AnimatedButton
            onPress={() => {
              setCases([]);
              setCurrentIndex(0);
              loadBatch();
            }}
            style={{ marginTop: spacing.lg }}
          >
            {t('swipe.loadMore')}
          </AnimatedButton>
        </View>
      ) : (
        <View style={styles.cardStack}>
          {/* Next card (background) */}
          {nextCase && (
            <Animated.View style={[styles.cardContainer, styles.nextCard, nextCardAnimStyle]}>
              <CaseCard caseData={nextCase} isTop={false} />
            </Animated.View>
          )}

          {/* Current card (top, draggable) */}
          {currentCase && (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
                <CaseCard
                  caseData={currentCase}
                  isTop={true}
                  admitOverlayStyle={admitOverlayStyle}
                  rejectOverlayStyle={rejectOverlayStyle}
                  waitlistOverlayStyle={waitlistOverlayStyle}
                />
              </Animated.View>
            </GestureDetector>
          )}

          {/* Result overlay */}
          {resultOverlay && <ResultOverlay result={resultOverlay} />}
        </View>
      )}

      {/* Action Buttons */}
      <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.actionButtons}>
        {/* Reject */}
        <TouchableOpacity
          onPress={() => handleButtonPredict('reject')}
          disabled={disabled}
          style={[
            styles.actionBtn,
            styles.rejectBtn,
            { backgroundColor: c.error + '15', borderColor: c.error + '40' },
            disabled && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="thumbs-down" size={28} color={disabled ? c.foregroundMuted : c.error} />
          <Text style={[styles.actionLabel, { color: disabled ? c.foregroundMuted : c.error }]}>
            {t('swipe.reject')}
          </Text>
        </TouchableOpacity>

        {/* Waitlist */}
        <TouchableOpacity
          onPress={() => handleButtonPredict('waitlist')}
          disabled={disabled}
          style={[
            styles.actionBtn,
            styles.waitlistBtn,
            { backgroundColor: c.warning + '15', borderColor: c.warning + '40' },
            disabled && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="pause" size={24} color={disabled ? c.foregroundMuted : c.warning} />
          <Text style={[styles.actionLabel, { color: disabled ? c.foregroundMuted : c.warning }]}>
            {t('swipe.waitlist')}
          </Text>
        </TouchableOpacity>

        {/* Admit */}
        <TouchableOpacity
          onPress={() => handleButtonPredict('admit')}
          disabled={disabled}
          style={[
            styles.actionBtn,
            styles.admitBtn,
            { backgroundColor: c.success + '15', borderColor: c.success + '40' },
            disabled && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="thumbs-up" size={28} color={disabled ? c.foregroundMuted : c.success} />
          <Text style={[styles.actionLabel, { color: disabled ? c.foregroundMuted : c.success }]}>
            {t('swipe.admit')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  gameContainer: {
    flex: 1,
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  cardContainer: {
    position: 'absolute',
    width: CARD_WIDTH,
  },
  nextCard: {
    zIndex: -1,
  },
  emptyStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 2,
    paddingVertical: spacing.md,
  },
  rejectBtn: {
    width: 72,
    height: 72,
  },
  waitlistBtn: {
    width: 60,
    height: 60,
  },
  admitBtn: {
    width: 72,
    height: 72,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
