/**
 * StatsView — private calibration-accuracy view for the case study loop.
 *
 * 2026-05 Hall Plan C (C3): de-gamified. The badge hero, streak cards, daily
 * challenge progress and leaderboard were removed. What remains is the
 * private calibration stat (total / correct / accuracy) — visible only to
 * the user, never aggregated into a leaderboard.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useColors, spacing, fontSize, fontWeight, borderRadius, fontFamily } from '@/utils/theme';

import { SwipeStatsDto, SCREEN_WIDTH } from './types';

interface StatsViewProps {
  onBack: () => void;
}

export default function StatsView({ onBack }: StatsViewProps) {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const { data: stats, isLoading: statsLoading } = useQuery<SwipeStatsDto>({
    queryKey: qk.swipe.stats(),
    queryFn: () => apiClient.get<SwipeStatsDto>(`${API_ROUTES.HALLS}/swipe/stats`),
    staleTime: 30_000,
  });

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
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.foreground} />
        </TouchableOpacity>
        <Text style={[styles.statsTitle, { color: c.foreground }]}>{t('swipe.statsTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {statsLoading ? (
        <Loading text={t('swipe.loading')} />
      ) : stats && stats.totalSwipes > 0 ? (
        <>
          {/* Calibration hero */}
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            style={[styles.calibrationHero, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Ionicons name="locate-outline" size={40} color={c.success} />
            <Text
              style={[
                styles.calibrationValue,
                { color: c.foreground, fontFamily: fontFamily.mono },
              ]}
            >
              {Math.round(stats.accuracy)}%
            </Text>
            <Text style={[styles.calibrationLabel, { color: c.foregroundMuted }]}>
              {t('swipe.calibration.title')}
            </Text>
            <Text style={[styles.calibrationHint, { color: c.foregroundMuted }]}>
              {t('swipe.calibration.description')}
            </Text>
          </Animated.View>

          {/* Stats grid */}
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.statsCardGrid}>
            <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text
                style={[styles.statsCardValue, { color: c.primary, fontFamily: fontFamily.mono }]}
              >
                {stats.totalSwipes}
              </Text>
              <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                {t('swipe.totalSwipes')}
              </Text>
            </View>
            <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text
                style={[styles.statsCardValue, { color: c.success, fontFamily: fontFamily.mono }]}
              >
                {stats.correctCount}
              </Text>
              <Text style={[styles.statsCardLabel, { color: c.foregroundMuted }]}>
                {t('swipe.correctCount')}
              </Text>
            </View>
          </Animated.View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: c.foregroundMuted }]}>
            {t('swipe.calibration.empty')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerSpacer: { width: 32 },
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
  calibrationHero: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  calibrationValue: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },
  calibrationLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  calibrationHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
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
  emptyState: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
