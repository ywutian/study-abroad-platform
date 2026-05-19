/**
 * ChinaAdmitDashboard — mainland-China admit trend cards (Stage 4 M5).
 *
 * Mobile equivalent of the web `ChinaAdmitDashboard`. Each card shows one
 * school's year-over-year verified admit counts (SVG bar chart) plus:
 *  - an A/B/C/D data-reliability rating
 *  - an admit-RATE trend signal (stable / declining / surging) — C4: derived
 *    from admitted ÷ total, not raw count, to avoid sampling artifacts
 *
 * D-reliability schools never render a misleading admit number — the chart
 * is replaced with an explicit "no data" placeholder.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Loading } from '@/components/ui';
import { hallRoutes } from '@study-abroad/shared';
import type {
  ChinaAdmitTrendResponse,
  DifficultySignal,
  DifficultySignalEntry,
  DataReliability,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { ChinaAdmitChart, ChinaAdmitNoData } from './ChinaAdmitChart';

/** Theme color token per data-reliability rating (resolved via useColors). */
const RELIABILITY_TOKEN: Record<
  DataReliability,
  'success' | 'info' | 'warning' | 'foregroundMuted'
> = {
  A: 'success',
  B: 'info',
  C: 'warning',
  D: 'foregroundMuted',
};

/** Icon + theme color token per year-over-year difficulty signal. */
const SIGNAL_META: Record<
  DifficultySignal,
  { icon: keyof typeof Ionicons.glyphMap; token: 'success' | 'warning' | 'error' }
> = {
  stable: { icon: 'remove-outline', token: 'success' },
  declining: { icon: 'trending-down-outline', token: 'warning' },
  surging: { icon: 'trending-up-outline', token: 'error' },
};

export function ChinaAdmitDashboard() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const isZh = i18n.language === 'zh';

  const { data: trend, isLoading } = useQuery<ChinaAdmitTrendResponse>({
    queryKey: ['hall-china-admit-trend'],
    queryFn: () =>
      apiClient.get<ChinaAdmitTrendResponse>(hallRoutes.verifiedChinaAdmitTrend(), {
        params: { years: 4 },
      }),
    staleTime: 10 * 60_000,
  });

  const { data: signals } = useQuery<DifficultySignalEntry[]>({
    queryKey: ['hall-difficulty-signal'],
    queryFn: () => apiClient.get<DifficultySignalEntry[]>(hallRoutes.verifiedDifficultySignal()),
    staleTime: 10 * 60_000,
  });

  const signalMap = useMemo(() => {
    const m = new Map<string, DifficultySignalEntry>();
    (signals ?? []).forEach((s) => m.set(s.schoolId, s));
    return m;
  }, [signals]);

  if (isLoading) return <Loading text={t('hall.loading')} />;

  const schools = trend?.schools ?? [];
  const lastUpdated = trend?.lastUpdated
    ? new Date(trend.lastUpdated).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')
    : '—';

  return (
    <View>
      {/* Data transparency banner */}
      <View
        style={[S.banner, { backgroundColor: c.primary + '12', borderColor: c.primary + '40' }]}
      >
        <Ionicons name="shield-checkmark-outline" size={16} color={c.primary} />
        <Text style={[S.bannerText, { color: c.primary }]}>
          {t('hall.verified.chinaAdmit.banner', {
            count: schools.length,
            date: lastUpdated,
          })}
        </Text>
      </View>

      {schools.length === 0 ? (
        <View style={[S.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[S.emptyTitle, { color: c.foreground }]}>
            {t('hall.verified.chinaAdmit.emptyTitle')}
          </Text>
          <Text style={[S.emptyBody, { color: c.foregroundMuted }]}>
            {t('hall.verified.chinaAdmit.emptyBody')}
          </Text>
        </View>
      ) : (
        schools.map((school, idx) => {
          const signal = signalMap.get(school.schoolId);
          const sigKey: DifficultySignal = signal?.signal ?? 'stable';
          const sig = SIGNAL_META[sigKey];
          const sigColor = c[sig.token];
          const label = isZh && school.schoolNameZh ? school.schoolNameZh : school.schoolName;
          return (
            <Animated.View
              key={school.schoolId}
              entering={FadeInUp.delay(Math.min(idx * 40, 320)).springify()}
              style={[S.card, { backgroundColor: c.card, borderColor: c.border }]}
            >
              {/* Header — school name + reliability rating */}
              <View style={S.cardHeader}>
                <View style={[S.signalDot, { backgroundColor: sigColor }]} />
                <View style={S.cardHeaderText}>
                  <Text style={[S.schoolName, { color: c.foreground }]} numberOfLines={1}>
                    {label}
                  </Text>
                  {school.schoolRank ? (
                    <Text style={[S.schoolRank, { color: c.foregroundMuted }]}>
                      {t('hall.verified.chinaAdmit.rank', { rank: school.schoolRank })}
                    </Text>
                  ) : null}
                </View>
                <ReliabilityBadge reliability={school.reliability} />
              </View>

              {/* Chart or no-data placeholder */}
              {school.reliability === 'D' ? (
                <ChinaAdmitNoData label={t('hall.verified.chinaAdmit.noChinaData')} />
              ) : (
                <ChinaAdmitChart yearly={school.yearly} color={sigColor} />
              )}

              {/* Admit-rate trend label (C4: rate-based, not raw count) */}
              <View style={S.signalRow}>
                <Ionicons name={sig.icon} size={14} color={sigColor} />
                <Text style={[S.signalText, { color: sigColor }]}>
                  {t(`hall.verified.chinaAdmit.signal.${sigKey}`)}
                </Text>
                {signal && signal.changePct !== 0 ? (
                  <Text style={[S.signalChange, { color: c.foregroundMuted }]}>
                    ({signal.changePct > 0 ? '+' : ''}
                    {signal.changePct}
                    {t('hall.verified.chinaAdmit.changePctUnit')})
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          );
        })
      )}
    </View>
  );
}

function ReliabilityBadge({ reliability }: { reliability: DataReliability }) {
  const { t } = useTranslation();
  const c = useColors();
  const color = c[RELIABILITY_TOKEN[reliability]];
  return (
    <View
      style={[S.reliabilityBadge, { backgroundColor: color + '22' }]}
      accessibilityLabel={t(`hall.verified.chinaAdmit.reliability.${reliability}`)}
    >
      <Text style={[S.reliabilityText, { color }]}>{reliability}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  emptyBody: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: fontSize.sm * 1.4,
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  schoolName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  schoolRank: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  reliabilityBadge: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reliabilityText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  signalText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  signalChange: {
    fontSize: fontSize.xs,
  },
});
