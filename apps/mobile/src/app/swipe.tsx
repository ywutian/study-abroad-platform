/**
 * Swipe Prediction Game Page
 *
 * Tinder-like card swiping interface where users predict college admission
 * outcomes (admit / reject / waitlist). Features gesture-based card interactions,
 * animated overlays, stats tracking, and a leaderboard view.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeInDown,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton, AnimatedCard, Badge, Loading, ProgressBar } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/utils/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwipeCaseDto {
  id: string;
  schoolName: string;
  schoolNameZh?: string;
  year: number;
  round?: string;
  major?: string;
  gpaRange?: string;
  satRange?: string;
  actRange?: string;
  toeflRange?: string;
  tags?: string[];
  isVerified: boolean;
  usNewsRank?: number;
  acceptanceRate?: number;
  activityCount?: number;
  activityHighlights?: string[];
  awardCount?: number;
  highestAwardLevel?: string;
  apCount?: number;
}

interface SwipeResultDto {
  caseId: string;
  prediction: 'admit' | 'reject' | 'waitlist';
  actualResult: string;
  isCorrect: boolean;
  currentStreak: number;
  pointsEarned: number;
  badgeUpgraded: boolean;
  currentBadge: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
}

interface SwipeStatsDto {
  totalSwipes: number;
  correctCount: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  badge: string;
  toNextBadge: number;
  dailyChallengeCount: number;
  dailyChallengeTarget: number;
}

interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  accuracy: number;
  totalSwipes: number;
  badge: string;
  isCurrentUser?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_DOWN_THRESHOLD = SCREEN_HEIGHT * 0.15;
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.52;
const BATCH_SIZE = 5;
const RELOAD_THRESHOLD = 2;

const BADGE_COLORS: Record<string, string> = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  PLATINUM: '#E5E4E2',
  DIAMOND: '#B9F2FF',
};

const BADGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  BRONZE: 'shield-outline',
  SILVER: 'shield-half-outline',
  GOLD: 'shield',
  PLATINUM: 'diamond-outline',
  DIAMOND: 'diamond',
};

const BADGE_THRESHOLDS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 100,
  GOLD: 500,
  PLATINUM: 2000,
  DIAMOND: 5000,
};

type PredictionType = 'admit' | 'reject' | 'waitlist';
type ViewMode = 'game' | 'stats';

// ---------------------------------------------------------------------------
// Helper: tier gradient color from rank
// ---------------------------------------------------------------------------

function getTierColor(rank?: number): string {
  if (!rank) return '#6366f1';
  if (rank <= 10) return '#8b5cf6';
  if (rank <= 25) return '#3b82f6';
  if (rank <= 50) return '#10b981';
  if (rank <= 100) return '#f59e0b';
  return '#64748b';
}

function getTierBgColor(rank?: number): string {
  if (!rank) return '#6366f1' + '12';
  if (rank <= 10) return '#8b5cf6' + '15';
  if (rank <= 25) return '#3b82f6' + '12';
  if (rank <= 50) return '#10b981' + '10';
  if (rank <= 100) return '#f59e0b' + '10';
  return '#64748b' + '10';
}

function getNextBadge(badge: string): string {
  const order = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const idx = order.indexOf(badge);
  if (idx < order.length - 1) return order[idx + 1];
  return badge;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SwipePage() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isZh = i18n.language === 'zh';

  const [viewMode, setViewMode] = useState<ViewMode>('game');
  const [cases, setCases] = useState<SwipeCaseDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resultOverlay, setResultOverlay] = useState<SwipeResultDto | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Shared values for card animation ──────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);

  // ── Queries ───────────────────────────────────────────
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<SwipeStatsDto>({
    queryKey: ['swipe', 'stats'],
    queryFn: () => apiClient.get<SwipeStatsDto>('/swipe/stats'),
    staleTime: 30_000,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntryDto[]>({
    queryKey: ['swipe', 'leaderboard'],
    queryFn: () =>
      apiClient.get<LeaderboardEntryDto[]>('/swipe/leaderboard', {
        params: { limit: 20 },
      }),
    enabled: viewMode === 'stats',
    staleTime: 60_000,
  });

  // Batch loading
  const loadBatch = useCallback(async () => {
    try {
      const batch = await apiClient.get<SwipeCaseDto[]>('/swipe/batch', {
        params: { count: BATCH_SIZE },
      });
      setCases((prev) => [...prev, ...batch]);
    } catch (err) {
      if (err instanceof Error) {
        toast.show({ type: 'error', message: err.message });
      }
    }
  }, [toast]);

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

  // Predict mutation
  const predictMutation = useMutation<
    SwipeResultDto,
    Error,
    { caseId: string; prediction: PredictionType }
  >({
    mutationFn: ({ caseId, prediction }) =>
      apiClient.post<SwipeResultDto>('/swipe/predict', { caseId, prediction }),
    onSuccess: (result) => {
      // Haptic feedback
      if (result.isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Show result overlay
      setResultOverlay(result);

      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: ['swipe', 'stats'] });

      // Auto-dismiss after 1.5s
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => {
        setResultOverlay(null);
        setCurrentIndex((idx) => idx + 1);
        setIsAnimating(false);
      }, 1500);
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
      // Snap back
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

  // JS callbacks for runOnJS
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

      // Check down swipe first (waitlist)
      if (absY > SWIPE_DOWN_THRESHOLD && absY > absX) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        translateX.value = withTiming(0, { duration: 300 });
        runOnJS(onSwipeDown)();
        return;
      }

      // Swipe right (admit)
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        translateY.value = withTiming(e.translationY, { duration: 300 });
        runOnJS(onSwipeRight)();
        return;
      }

      // Swipe left (reject)
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        translateY.value = withTiming(e.translationY, { duration: 300 });
        runOnJS(onSwipeLeft)();
        return;
      }

      // Snap back
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

  // Next card scale
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

      // Animate card out
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

  // ── Current case ──────────────────────────────────────
  const currentCase = cases[currentIndex];
  const nextCase = cases[currentIndex + 1];

  // ── Render: Stats Bar ─────────────────────────────────
  const renderStatsBar = () => {
    const badge = stats?.badge || 'BRONZE';
    const badgeColor = BADGE_COLORS[badge] || BADGE_COLORS.BRONZE;
    const badgeIcon = BADGE_ICONS[badge] || BADGE_ICONS.BRONZE;

    return (
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.statsBar, { backgroundColor: c.card, borderColor: c.border }]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.primary }]}>
            {stats ? `${Math.round(stats.accuracy)}%` : '--'}
          </Text>
          <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>
            {t('swipe.accuracy')}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: c.border }]} />

        <View style={styles.statItem}>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={16} color="#f59e0b" />
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>
              {stats?.currentStreak ?? 0}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>{t('swipe.streak')}</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: c.border }]} />

        <View style={styles.statItem}>
          <Ionicons name={badgeIcon} size={22} color={badgeColor} />
          <Text style={[styles.statLabel, { color: badgeColor, fontWeight: fontWeight.semibold }]}>
            {t(`swipe.badges.${badge.toLowerCase()}`)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode('stats');
          }}
          style={[styles.statsToggle, { backgroundColor: c.muted }]}
        >
          <Ionicons name="bar-chart-outline" size={18} color={c.foreground} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ── Render: Swipe Case Card ───────────────────────────
  const renderCaseCard = (caseData: SwipeCaseDto, isTop: boolean) => {
    const tierColor = getTierColor(caseData.usNewsRank);
    const tierBg = getTierBgColor(caseData.usNewsRank);
    const schoolLabel = isZh && caseData.schoolNameZh ? caseData.schoolNameZh : caseData.schoolName;

    return (
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        {/* Tier gradient header */}
        <View style={[styles.cardHeader, { backgroundColor: tierBg }]}>
          <View style={styles.cardHeaderTop}>
            <View style={styles.schoolRow}>
              <Text style={[styles.schoolName, { color: c.foreground }]} numberOfLines={2}>
                {schoolLabel}
              </Text>
              {caseData.isVerified && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#10b981"
                  style={{ marginLeft: spacing.xs }}
                />
              )}
            </View>
            {caseData.usNewsRank && (
              <View style={[styles.rankBadge, { backgroundColor: tierColor + '20' }]}>
                <Text style={[styles.rankText, { color: tierColor }]}>#{caseData.usNewsRank}</Text>
              </View>
            )}
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            {caseData.year > 0 && (
              <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
                <Text style={[styles.metaText, { color: c.foregroundSecondary }]}>
                  {caseData.year}
                </Text>
              </View>
            )}
            {caseData.round && (
              <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
                <Text style={[styles.metaText, { color: c.foregroundSecondary }]}>
                  {caseData.round}
                </Text>
              </View>
            )}
            {caseData.major && (
              <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
                <Text style={[styles.metaText, { color: c.foregroundSecondary }]} numberOfLines={1}>
                  {caseData.major}
                </Text>
              </View>
            )}
            {caseData.acceptanceRate != null && (
              <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
                <Text style={[styles.metaText, { color: c.foregroundSecondary }]}>
                  {t('swipe.acceptanceRate')}: {Math.round(caseData.acceptanceRate)}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {caseData.gpaRange && (
            <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
              <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>GPA</Text>
              <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.gpaRange}</Text>
            </View>
          )}
          {caseData.satRange && (
            <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
              <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>SAT</Text>
              <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.satRange}</Text>
            </View>
          )}
          {caseData.actRange && (
            <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
              <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>ACT</Text>
              <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.actRange}</Text>
            </View>
          )}
          {caseData.toeflRange && (
            <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
              <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>TOEFL</Text>
              <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.toeflRange}</Text>
            </View>
          )}
          {caseData.apCount != null && caseData.apCount > 0 && (
            <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
              <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>AP</Text>
              <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.apCount}</Text>
            </View>
          )}
        </View>

        {/* Activity / Award summary */}
        <View style={styles.summarySection}>
          {caseData.activityCount != null && caseData.activityCount > 0 && (
            <View style={styles.summaryRow}>
              <Ionicons name="people-outline" size={16} color={c.foregroundMuted} />
              <Text style={[styles.summaryText, { color: c.foregroundSecondary }]}>
                {t('swipe.activities', { count: caseData.activityCount })}
              </Text>
            </View>
          )}
          {caseData.activityHighlights && caseData.activityHighlights.length > 0 && (
            <View style={styles.chipsRow}>
              {caseData.activityHighlights.slice(0, 3).map((hl, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: c.primary + '12' }]}>
                  <Text style={[styles.chipText, { color: c.primary }]} numberOfLines={1}>
                    {hl}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {caseData.awardCount != null && caseData.awardCount > 0 && (
            <View style={styles.summaryRow}>
              <Ionicons name="trophy-outline" size={16} color="#f59e0b" />
              <Text style={[styles.summaryText, { color: c.foregroundSecondary }]}>
                {t('swipe.awards', { count: caseData.awardCount })}
                {caseData.highestAwardLevel ? ` (${caseData.highestAwardLevel})` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {caseData.tags && caseData.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {caseData.tags.slice(0, 4).map((tag, i) => (
              <View key={i} style={[styles.tagChip, { backgroundColor: c.muted }]}>
                <Text style={[styles.tagText, { color: c.foregroundMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Swipe direction overlays */}
        {isTop && (
          <>
            {/* ADMIT overlay (right) */}
            <Animated.View
              style={[styles.directionOverlay, styles.admitOverlay, admitOverlayStyle]}
              pointerEvents="none"
            >
              <View style={[styles.overlayBadge, { borderColor: '#10b981' }]}>
                <Text style={[styles.overlayText, { color: '#10b981' }]}>{t('swipe.admit')}</Text>
              </View>
            </Animated.View>

            {/* REJECT overlay (left) */}
            <Animated.View
              style={[styles.directionOverlay, styles.rejectOverlay, rejectOverlayStyle]}
              pointerEvents="none"
            >
              <View style={[styles.overlayBadge, { borderColor: '#ef4444' }]}>
                <Text style={[styles.overlayText, { color: '#ef4444' }]}>{t('swipe.reject')}</Text>
              </View>
            </Animated.View>

            {/* WAITLIST overlay (down) */}
            <Animated.View
              style={[styles.directionOverlay, styles.waitlistOverlay, waitlistOverlayStyle]}
              pointerEvents="none"
            >
              <View style={[styles.overlayBadge, { borderColor: '#f59e0b' }]}>
                <Text style={[styles.overlayText, { color: '#f59e0b' }]}>
                  {t('swipe.waitlist')}
                </Text>
              </View>
            </Animated.View>
          </>
        )}
      </View>
    );
  };

  // ── Render: Result Overlay ────────────────────────────
  const renderResultOverlay = () => {
    if (!resultOverlay) return null;

    const isCorrect = resultOverlay.isCorrect;
    const bgColor = isCorrect ? '#10b981' + '20' : '#ef4444' + '20';
    const fgColor = isCorrect ? '#10b981' : '#ef4444';
    const icon = isCorrect ? 'checkmark-circle' : 'close-circle';

    return (
      <Animated.View
        entering={FadeInDown.duration(300).springify()}
        style={[styles.resultOverlay, { backgroundColor: bgColor }]}
      >
        <Ionicons name={icon} size={56} color={fgColor} />
        <Text style={[styles.resultTitle, { color: fgColor }]}>
          {isCorrect ? t('swipe.correct') : t('swipe.incorrect')}
        </Text>

        {isCorrect ? (
          <View style={styles.resultDetails}>
            <Text style={[styles.resultPoints, { color: fgColor }]}>
              +{resultOverlay.pointsEarned} {t('swipe.points')}
            </Text>
            <View style={styles.resultStreakRow}>
              <Ionicons name="flame" size={20} color="#f59e0b" />
              <Text style={[styles.resultStreak, { color: '#f59e0b' }]}>
                {resultOverlay.currentStreak}
              </Text>
            </View>
            {resultOverlay.badgeUpgraded && (
              <View
                style={[
                  styles.badgeUpgrade,
                  { backgroundColor: BADGE_COLORS[resultOverlay.currentBadge] + '20' },
                ]}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={18}
                  color={BADGE_COLORS[resultOverlay.currentBadge]}
                />
                <Text
                  style={[
                    styles.badgeUpgradeText,
                    { color: BADGE_COLORS[resultOverlay.currentBadge] },
                  ]}
                >
                  {t('swipe.badgeUpgraded', {
                    badge: t(`swipe.badges.${resultOverlay.currentBadge.toLowerCase()}`),
                  })}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.resultDetails}>
            <Text style={[styles.resultActual, { color: c.foregroundSecondary }]}>
              {t('swipe.actualResult')}: {resultOverlay.actualResult}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  // ── Render: Card Stack ────────────────────────────────
  const renderCardStack = () => {
    if (cases.length === 0 || currentIndex >= cases.length) {
      return (
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
      );
    }

    return (
      <View style={styles.cardStack}>
        {/* Next card (background) */}
        {nextCase && (
          <Animated.View style={[styles.cardContainer, styles.nextCard, nextCardAnimStyle]}>
            {renderCaseCard(nextCase, false)}
          </Animated.View>
        )}

        {/* Current card (top, draggable) */}
        {currentCase && (
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
              {renderCaseCard(currentCase, true)}
            </Animated.View>
          </GestureDetector>
        )}

        {/* Result overlay on top of everything */}
        {renderResultOverlay()}
      </View>
    );
  };

  // ── Render: Action Buttons ────────────────────────────
  const renderActionButtons = () => {
    const disabled = isAnimating || !currentCase;

    return (
      <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.actionButtons}>
        {/* Reject */}
        <TouchableOpacity
          onPress={() => handleButtonPredict('reject')}
          disabled={disabled}
          style={[
            styles.actionBtn,
            styles.rejectBtn,
            { backgroundColor: '#ef4444' + '15', borderColor: '#ef4444' + '40' },
            disabled && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="thumbs-down" size={28} color={disabled ? c.foregroundMuted : '#ef4444'} />
          <Text style={[styles.actionLabel, { color: disabled ? c.foregroundMuted : '#ef4444' }]}>
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
            { backgroundColor: '#f59e0b' + '15', borderColor: '#f59e0b' + '40' },
            disabled && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="pause" size={24} color={disabled ? c.foregroundMuted : '#f59e0b'} />
          <Text style={[styles.actionLabel, { color: disabled ? c.foregroundMuted : '#f59e0b' }]}>
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
            { backgroundColor: '#10b981' + '15', borderColor: '#10b981' + '40' },
            disabled && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="thumbs-up" size={28} color={disabled ? c.foregroundMuted : '#10b981'} />
          <Text style={[styles.actionLabel, { color: disabled ? c.foregroundMuted : '#10b981' }]}>
            {t('swipe.admit')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ── Render: Game View ─────────────────────────────────
  const renderGameView = () => (
    <View style={styles.gameContainer}>
      {renderStatsBar()}
      {renderCardStack()}
      {renderActionButtons()}
    </View>
  );

  // ── Render: Stats & Leaderboard View ──────────────────
  const renderStatsView = () => {
    const badge = stats?.badge || 'BRONZE';
    const badgeColor = BADGE_COLORS[badge] || BADGE_COLORS.BRONZE;
    const badgeIcon = BADGE_ICONS[badge] || BADGE_ICONS.BRONZE;
    const nextBadgeName = getNextBadge(badge);
    const nextBadgeThreshold = BADGE_THRESHOLDS[nextBadgeName] || 0;
    const currentThreshold = BADGE_THRESHOLDS[badge] || 0;
    const progressToNext = stats
      ? Math.min(
          ((stats.totalSwipes - currentThreshold) / (nextBadgeThreshold - currentThreshold || 1)) *
            100,
          100
        )
      : 0;

    return (
      <ScrollView
        style={styles.statsViewContainer}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        <View style={styles.statsHeader}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode('game');
            }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={c.foreground} />
          </TouchableOpacity>
          <Text style={[styles.statsTitle, { color: c.foreground }]}>{t('swipe.statsTitle')}</Text>
          <View style={{ width: 32 }} />
        </View>

        {statsLoading ? (
          <Loading text={t('swipe.loading')} />
        ) : stats ? (
          <>
            {/* Badge hero */}
            <Animated.View
              entering={FadeInDown.duration(400).springify()}
              style={[styles.badgeHero, { backgroundColor: badgeColor + '12' }]}
            >
              <Ionicons name={badgeIcon} size={56} color={badgeColor} />
              <Text style={[styles.badgeName, { color: badgeColor }]}>
                {t(`swipe.badges.${badge.toLowerCase()}`)}
              </Text>
              {badge !== 'DIAMOND' && (
                <View style={styles.badgeProgress}>
                  <ProgressBar
                    value={progressToNext}
                    max={100}
                    color={BADGE_COLORS[nextBadgeName]}
                    label={`${t(`swipe.badges.${badge.toLowerCase()}`)} → ${t(`swipe.badges.${nextBadgeName.toLowerCase()}`)}`}
                    showValue
                    size="md"
                  />
                  <Text style={[styles.badgeProgressHint, { color: c.foregroundMuted }]}>
                    {t('swipe.toNextBadge', { count: stats.toNextBadge })}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Stats grid */}
            <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.statsCardGrid}>
              <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.statsCardValue, { color: c.primary }]}>
                  {stats.totalSwipes}
                </Text>
                <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                  {t('swipe.totalSwipes')}
                </Text>
              </View>
              <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.statsCardValue, { color: '#10b981' }]}>
                  {Math.round(stats.accuracy)}%
                </Text>
                <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                  {t('swipe.accuracy')}
                </Text>
              </View>
              <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.statsCardValue, { color: '#f59e0b' }]}>
                  {stats.currentStreak}
                </Text>
                <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                  {t('swipe.streak')}
                </Text>
              </View>
              <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.statsCardValue, { color: '#8b5cf6' }]}>
                  {stats.bestStreak}
                </Text>
                <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                  {t('swipe.bestStreak')}
                </Text>
              </View>
            </Animated.View>

            {/* Daily challenge */}
            <Animated.View
              entering={FadeInUp.delay(200).springify()}
              style={[styles.dailyChallenge, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <View style={styles.dailyChallengeHeader}>
                <Ionicons name="today-outline" size={20} color={c.primary} />
                <Text style={[styles.dailyChallengeTitle, { color: c.foreground }]}>
                  {t('swipe.dailyChallenge')}
                </Text>
              </View>
              <ProgressBar
                value={stats.dailyChallengeCount}
                max={stats.dailyChallengeTarget}
                color={
                  stats.dailyChallengeCount >= stats.dailyChallengeTarget ? '#10b981' : c.primary
                }
                label={`${stats.dailyChallengeCount} / ${stats.dailyChallengeTarget}`}
                showValue
                size="lg"
              />
              {stats.dailyChallengeCount >= stats.dailyChallengeTarget && (
                <View style={styles.challengeComplete}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={[styles.challengeCompleteText, { color: '#10b981' }]}>
                    {t('swipe.challengeComplete')}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Leaderboard */}
            <Animated.View entering={FadeInUp.delay(300).springify()}>
              <View style={styles.leaderboardHeader}>
                <Ionicons name="podium-outline" size={20} color={c.foreground} />
                <Text style={[styles.leaderboardTitle, { color: c.foreground }]}>
                  {t('swipe.leaderboard')}
                </Text>
              </View>

              {leaderboardLoading ? (
                <Loading text={t('swipe.loading')} />
              ) : leaderboard && leaderboard.length > 0 ? (
                <View style={styles.leaderboardList}>
                  {leaderboard.map((entry, idx) => {
                    const entryBadgeColor = BADGE_COLORS[entry.badge] || BADGE_COLORS.BRONZE;
                    const entryBadgeIcon = BADGE_ICONS[entry.badge] || BADGE_ICONS.BRONZE;
                    const isMe = entry.isCurrentUser;

                    return (
                      <Animated.View
                        key={entry.userId}
                        entering={FadeInUp.delay(idx * 40).springify()}
                      >
                        <View
                          style={[
                            styles.leaderboardEntry,
                            {
                              backgroundColor: isMe ? c.primary + '08' : c.card,
                              borderColor: isMe ? c.primary + '30' : c.border,
                            },
                          ]}
                        >
                          {/* Rank */}
                          <View style={styles.rankCol}>
                            {entry.rank <= 3 ? (
                              <View
                                style={[
                                  styles.topRankBadge,
                                  {
                                    backgroundColor:
                                      entry.rank === 1
                                        ? '#FFD700' + '20'
                                        : entry.rank === 2
                                          ? '#C0C0C0' + '20'
                                          : '#CD7F32' + '20',
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="trophy"
                                  size={16}
                                  color={
                                    entry.rank === 1
                                      ? '#FFD700'
                                      : entry.rank === 2
                                        ? '#C0C0C0'
                                        : '#CD7F32'
                                  }
                                />
                              </View>
                            ) : (
                              <Text style={[styles.rankNumber, { color: c.foregroundMuted }]}>
                                {entry.rank}
                              </Text>
                            )}
                          </View>

                          {/* User info */}
                          <View style={styles.userCol}>
                            <View style={styles.userNameRow}>
                              <Text
                                style={[
                                  styles.userName,
                                  { color: isMe ? c.primary : c.foreground },
                                  isMe && { fontWeight: fontWeight.bold },
                                ]}
                                numberOfLines={1}
                              >
                                {entry.nickname || t('swipe.anonymous')}
                              </Text>
                              {isMe && (
                                <Badge variant="default" style={{ marginLeft: spacing.xs }}>
                                  {t('swipe.you')}
                                </Badge>
                              )}
                            </View>
                            <Text style={[styles.userSwipes, { color: c.foregroundMuted }]}>
                              {t('swipe.swipesCount', { count: entry.totalSwipes })}
                            </Text>
                          </View>

                          {/* Badge + accuracy */}
                          <View style={styles.entryRight}>
                            <Ionicons name={entryBadgeIcon} size={18} color={entryBadgeColor} />
                            <Text style={[styles.entryAccuracy, { color: c.foreground }]}>
                              {Math.round(entry.accuracy)}%
                            </Text>
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyLeaderboard}>
                  <Text style={[styles.emptyLeaderboardText, { color: c.foregroundMuted }]}>
                    {t('swipe.noLeaderboard')}
                  </Text>
                </View>
              )}
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
    );
  };

  // ── Main Render ───────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ title: t('swipe.title'), headerShown: viewMode === 'game' }} />

      <View
        style={[styles.container, { backgroundColor: c.background, paddingBottom: insets.bottom }]}
      >
        {viewMode === 'game' ? renderGameView() : renderStatsView()}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Game View ───────────────────────────────────────
  gameContainer: {
    flex: 1,
  },

  // ── Stats Bar ───────────────────────────────────────
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsToggle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  // ── Card Stack ──────────────────────────────────────
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

  // ── Case Card ───────────────────────────────────────
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.lg,
    maxHeight: CARD_HEIGHT,
  },
  cardHeader: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    flexShrink: 1,
  },
  rankBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  rankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  metaText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // ── Stats Grid ──────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gridItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 70,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gridValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },

  // ── Summary Section ─────────────────────────────────
  summarySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: fontSize.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingLeft: spacing.xl + spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    maxWidth: 140,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // ── Tags Row ────────────────────────────────────────
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },

  // ── Swipe Direction Overlays ────────────────────────
  directionOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
  },
  admitOverlay: {
    backgroundColor: '#10b981' + '15',
  },
  rejectOverlay: {
    backgroundColor: '#ef4444' + '15',
  },
  waitlistOverlay: {
    backgroundColor: '#f59e0b' + '15',
  },
  overlayBadge: {
    borderWidth: 3,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    transform: [{ rotate: '-15deg' }],
  },
  overlayText: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // ── Result Overlay ──────────────────────────────────
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  resultTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },
  resultDetails: {
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  resultPoints: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  resultStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resultStreak: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  resultActual: {
    fontSize: fontSize.base,
  },
  badgeUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  badgeUpgradeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // ── Empty Stack ─────────────────────────────────────
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

  // ── Action Buttons ──────────────────────────────────
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

  // ── Stats & Leaderboard View ────────────────────────
  statsViewContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },

  // Badge hero
  badgeHero: {
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  badgeName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  badgeProgress: {
    width: '100%',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  badgeProgressHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },

  // Stats cards grid
  statsCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2 - 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statsCardValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statsCardLabel: {
    fontSize: fontSize.xs,
  },

  // Daily challenge
  dailyChallenge: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  dailyChallengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dailyChallengeTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  challengeComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  challengeCompleteText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Leaderboard
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  leaderboardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  leaderboardList: {
    gap: spacing.sm,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  rankCol: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  userCol: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
  },
  userSwipes: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  entryRight: {
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  entryAccuracy: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  emptyLeaderboard: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  emptyLeaderboardText: {
    fontSize: fontSize.sm,
  },
});
