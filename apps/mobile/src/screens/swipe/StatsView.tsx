/**
 * StatsView — Full-screen stats and leaderboard view.
 * Shows badge hero, stats grid, daily challenge progress, and leaderboard.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Loading, ProgressBar } from '@/components/ui';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

import {
  SwipeStatsDto,
  LeaderboardEntryDto,
  SCREEN_WIDTH,
  BADGE_COLORS,
  BADGE_ICONS,
  BADGE_THRESHOLDS,
  getNextBadge,
} from './types';
import LeaderboardItem from './LeaderboardItem';

interface StatsViewProps {
  onBack: () => void;
}

export default function StatsView({ onBack }: StatsViewProps) {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const { data: stats, isLoading: statsLoading } = useQuery<SwipeStatsDto>({
    queryKey: ['swipe', 'stats'],
    queryFn: () => apiClient.get<SwipeStatsDto>(`${API_ROUTES.HALLS}/swipe/stats`),
    staleTime: 30_000,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntryDto[]>({
    queryKey: ['swipe', 'leaderboard'],
    queryFn: () =>
      apiClient.get<LeaderboardEntryDto[]>(`${API_ROUTES.HALLS}/swipe/leaderboard`, {
        params: { limit: 20 },
      }),
    staleTime: 60_000,
  });

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
            onBack();
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
              <Text style={[styles.statsCardValue, { color: c.primary }]}>{stats.totalSwipes}</Text>
              <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                {t('swipe.totalSwipes')}
              </Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.statsCardValue, { color: c.success }]}>
                {Math.round(stats.accuracy)}%
              </Text>
              <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                {t('swipe.accuracy')}
              </Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.statsCardValue, { color: c.warning }]}>
                {stats.currentStreak}
              </Text>
              <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                {t('swipe.streak')}
              </Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.statsCardValue, { color: c.violet }]}>{stats.bestStreak}</Text>
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
                stats.dailyChallengeCount >= stats.dailyChallengeTarget ? c.success : c.primary
              }
              label={`${stats.dailyChallengeCount} / ${stats.dailyChallengeTarget}`}
              showValue
              size="lg"
            />
            {stats.dailyChallengeCount >= stats.dailyChallengeTarget && (
              <View style={styles.challengeComplete}>
                <Ionicons name="checkmark-circle" size={18} color={c.success} />
                <Text style={[styles.challengeCompleteText, { color: c.success }]}>
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
                {leaderboard.map((entry) => (
                  <LeaderboardItem key={entry.userId} entry={entry} />
                ))}
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
}

const styles = StyleSheet.create({
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
  emptyLeaderboard: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  emptyLeaderboardText: {
    fontSize: fontSize.sm,
  },
});
