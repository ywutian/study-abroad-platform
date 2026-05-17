/**
 * HallHeroBar — compact overview strip for the Hall (Stage 4 M5).
 *
 * Consumes the `GET /halls/me/overview` BFF (`HallOverviewPayload`):
 * points balance, swipe badge/streak, reviewer level/credit and the daily
 * challenge progress — surfaced at the top of every Hall tab.
 *
 * Renders nothing while loading or on error so it never blocks the tabs.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { hallRoutes } from '@study-abroad/shared';
import type { HallOverviewPayload } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

const BADGE_COLOR: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#9CA3AF',
  gold: '#F59E0B',
  platinum: '#60A5FA',
  diamond: '#22D3EE',
};

interface HeroStatProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
  sub?: string;
}

function HeroStat({ icon, iconColor, value, label, sub }: HeroStatProps) {
  const c = useColors();
  return (
    <View style={S.stat}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[S.statValue, { color: c.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[S.statLabel, { color: c.foregroundMuted }]} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={[S.statSub, { color: c.foregroundMuted }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function HallHeroBar() {
  const { t } = useTranslation();
  const c = useColors();

  const { data } = useQuery<HallOverviewPayload>({
    queryKey: ['hall-overview'],
    queryFn: () => apiClient.get<HallOverviewPayload>(hallRoutes.meOverview()),
    staleTime: 60_000,
  });

  if (!data) return null;

  const badgeKey = String(data.swipe.badge).toLowerCase();
  const badgeColor = BADGE_COLOR[badgeKey] ?? c.primary;
  const badgeLabel = t(`hall.hero.badges.${badgeKey}`, { defaultValue: data.swipe.badge });
  const levelLabel = t(`hall.hero.levels.${data.reviewer.level}`, {
    defaultValue: data.reviewer.level,
  });

  return (
    <View style={[S.bar, { backgroundColor: c.card, borderColor: c.border }]}>
      <HeroStat
        icon="diamond-outline"
        iconColor={c.primary}
        value={String(data.points.balance)}
        label={t('hall.hero.points')}
        sub={
          data.points.todayEarned > 0
            ? t('hall.hero.today', { count: data.points.todayEarned })
            : undefined
        }
      />
      <View style={[S.divider, { backgroundColor: c.border }]} />
      <HeroStat
        icon="flame-outline"
        iconColor={badgeColor}
        value={String(data.swipe.currentStreak)}
        label={badgeLabel}
        sub={t('hall.hero.best', { count: data.swipe.bestStreak })}
      />
      <View style={[S.divider, { backgroundColor: c.border }]} />
      <HeroStat
        icon="ribbon-outline"
        iconColor={c.info}
        value={levelLabel}
        label={t('hall.hero.reviewer')}
        sub={t('hall.hero.credit', { count: data.reviewer.credit })}
      />
      <View style={[S.divider, { backgroundColor: c.border }]} />
      <HeroStat
        icon={data.dailyChallenge.completed ? 'checkmark-circle' : 'today-outline'}
        iconColor={data.dailyChallenge.completed ? c.success : c.warning}
        value={t('hall.hero.dailyProgress', {
          count: data.dailyChallenge.count,
          target: data.dailyChallenge.target,
        })}
        label={t('hall.hero.dailyChallenge')}
      />
    </View>
  );
}

const S = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  statLabel: {
    fontSize: fontSize.xs,
  },
  statSub: {
    fontSize: 10,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
  },
});
