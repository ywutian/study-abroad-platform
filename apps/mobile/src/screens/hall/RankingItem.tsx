import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedCard, CardContent, ProgressBar } from '@/components/ui';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { RankingResult, Colors } from './types';
import { getPercentileColor } from './types';

interface RankingItemProps {
  item: RankingResult;
  colors: Colors;
}

export const RankingItem = memo(function RankingItem({ item, colors: c }: RankingItemProps) {
  const { t } = useTranslation();
  const pColor = getPercentileColor(item.percentile);
  const breakdownKeys = item.breakdown ? Object.keys(item.breakdown) : [];

  return (
    <AnimatedCard style={S.rankingCard}>
      <CardContent>
        <View style={S.rankingHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[S.rankingSchoolName, { color: c.foreground }]} numberOfLines={1}>
              {item.schoolName}
            </Text>
            <Text style={[S.rankingApplicants, { color: c.foregroundMuted }]}>
              {t('hall.ranking.applicants', {
                count: item.totalApplicants,
              })}
            </Text>
          </View>
          <View style={[S.percentileBadge, { backgroundColor: pColor + '15' }]}>
            <Text style={[S.percentileText, { color: pColor }]}>
              {t('hall.ranking.top')} {Math.round(100 - item.percentile)}%
            </Text>
          </View>
        </View>

        <View style={S.rankScoreRow}>
          <View style={S.rankBox}>
            <Text style={[S.rankLabel, { color: c.foregroundMuted }]}>
              {t('hall.ranking.yourRank')}
            </Text>
            <Text style={[S.rankValue, { color: pColor }]}>#{item.yourRank}</Text>
          </View>
          <View style={[S.rankDivider, { backgroundColor: c.border }]} />
          <View style={S.rankBox}>
            <Text style={[S.rankLabel, { color: c.foregroundMuted }]}>
              {t('hall.ranking.score')}
            </Text>
            <Text style={[S.rankValue, { color: c.foreground }]}>{item.yourScore}</Text>
          </View>
        </View>

        {breakdownKeys.length > 0 && (
          <View style={[S.breakdownContainer, { borderTopColor: c.border }]}>
            <Text style={[S.breakdownTitle, { color: c.foregroundMuted }]}>
              {t('hall.ranking.breakdown')}
            </Text>
            {breakdownKeys.map((key) => (
              <ProgressBar
                key={key}
                label={key}
                value={item.breakdown[key]}
                max={100}
                size="sm"
                color={pColor}
                style={{ marginBottom: spacing.xs }}
              />
            ))}
          </View>
        )}
      </CardContent>
    </AnimatedCard>
  );
});

const S = StyleSheet.create({
  rankingCard: {
    marginBottom: spacing.md,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rankingSchoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  rankingApplicants: {
    fontSize: fontSize.xs,
  },
  percentileBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  percentileText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  rankScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rankBox: {
    flex: 1,
    alignItems: 'center',
  },
  rankLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  rankValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  rankDivider: {
    width: 1,
    height: 32,
  },
  breakdownContainer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  breakdownTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
});
