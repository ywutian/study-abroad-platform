/**
 * StatsBar — compact bar shown above the card stack in game view.
 *
 * 2026-05 Hall Plan C (C3): de-gamified. Shows only the private calibration
 * accuracy and a toggle to the full stats view — no streak, no badge.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
  fontFamily,
} from '@/utils/theme';

import { SwipeStatsDto } from './types';

interface StatsBarProps {
  onShowStats: () => void;
}

export default function StatsBar({ onShowStats }: StatsBarProps) {
  const { t } = useTranslation();
  const c = useColors();

  const { data: stats } = useQuery<SwipeStatsDto>({
    queryKey: qk.swipe.stats(),
    queryFn: () => apiClient.get<SwipeStatsDto>(`${API_ROUTES.HALLS}/swipe/stats`),
    staleTime: 30_000,
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.statsBar, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: c.primary, fontFamily: fontFamily.mono }]}>
          {stats ? `${Math.round(stats.accuracy)}%` : '--'}
        </Text>
        <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>{t('swipe.accuracy')}</Text>
      </View>

      <View style={[styles.statDivider, { backgroundColor: c.border }]} />

      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: c.foreground, fontFamily: fontFamily.mono }]}>
          {stats ? `${stats.correctCount}/${stats.totalSwipes}` : '--'}
        </Text>
        <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>
          {t('swipe.correctCount')}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onShowStats();
        }}
        style={[styles.statsToggle, { backgroundColor: c.muted }]}
        accessibilityRole="button"
        accessibilityLabel={t('swipe.statsTitle')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="bar-chart-outline" size={18} color={c.foreground} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  statsToggle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
});
