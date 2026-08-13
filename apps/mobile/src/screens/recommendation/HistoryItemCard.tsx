import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { AnimatedButton, AnimatedCard, CardContent } from '@/components/ui';
import { spacing, fontSize, fontWeight, fontFamily } from '@/utils/theme';

import { RecommendationResult, ColorsType, getTierConfig, formatDate } from './types';

interface HistoryItemCardProps {
  item: RecommendationResult;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onViewResult: (item: RecommendationResult) => void;
  colors: ColorsType;
}

export const HistoryItemCard = memo(function HistoryItemCard({
  item,
  isExpanded,
  onToggle,
  onViewResult,
  colors,
}: HistoryItemCardProps) {
  const { t } = useTranslation();
  const tierConfig = getTierConfig(colors);
  const reachCount = item.recommendations.filter((r) => r.tier === 'reach').length;
  const matchCount = item.recommendations.filter((r) => r.tier === 'match').length;
  const safetyCount = item.recommendations.filter((r) => r.tier === 'safety').length;
  const tierSummaryBase: Array<{
    tier: 'reach' | 'match' | 'safety';
    count: number;
    label: string;
  }> = [
    { tier: 'reach', count: reachCount, label: t('recommendation.tierReach') },
    { tier: 'match', count: matchCount, label: t('recommendation.tierMatch') },
    { tier: 'safety', count: safetyCount, label: t('recommendation.tierSafety') },
  ];
  const tierSummary = tierSummaryBase.filter((item) => item.count > 0);

  return (
    <AnimatedCard
      style={styles.historyCard}
      onPress={() => onToggle(item.id)}
      accessibilityLabel={`${formatDate(item.createdAt)}, ${item.recommendations.length} ${t('recommendation.schools')}`}
    >
      <CardContent>
        <View style={styles.historyCardHeader}>
          <View style={styles.historyCardInfo}>
            <Text style={[styles.historyDate, { color: colors.foreground }]}>
              {formatDate(item.createdAt)}
            </Text>
            <Text style={[styles.historySchoolCount, { color: colors.foregroundMuted }]}>
              <Text style={{ fontFamily: fontFamily.mono }}>{item.recommendations.length}</Text>{' '}
              {t('recommendation.schools')}
            </Text>
          </View>
          <View style={styles.historyTierRow}>
            {tierSummary.map((tier) => (
              <View
                key={tier.tier}
                style={[styles.historyTierBadge, { backgroundColor: colors.muted }]}
              >
                <View
                  style={[
                    styles.historyTierBadgeDot,
                    { backgroundColor: tierConfig[tier.tier].color },
                  ]}
                />
                <Text style={[styles.historyTierBadgeText, { color: colors.foregroundMuted }]}>
                  {tier.label} <Text style={{ fontFamily: fontFamily.mono }}>{tier.count}</Text>
                </Text>
              </View>
            ))}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.foregroundMuted}
          />
        </View>

        {isExpanded && (
          <View style={[styles.historyExpandedContent, { borderTopColor: colors.border }]}>
            <Text
              style={[styles.historySummary, { color: colors.foregroundSecondary }]}
              numberOfLines={3}
            >
              {item.summary}
            </Text>

            <View style={styles.historySchoolList}>
              {item.recommendations.slice(0, 5).map((school, sIndex) => (
                <View key={sIndex} style={styles.historySchoolRow}>
                  <View
                    style={[
                      styles.historySchoolDot,
                      { backgroundColor: tierConfig[school.tier].color },
                    ]}
                  />
                  <Text
                    style={[styles.historySchoolName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {school.schoolName}
                  </Text>
                  <Text style={[styles.historySchoolScore, { color: colors.foregroundMuted }]}>
                    {t('recommendation.fitScore')}{' '}
                    <Text style={{ fontFamily: fontFamily.mono }}>{school.fitScore}</Text>
                  </Text>
                </View>
              ))}
              {item.recommendations.length > 5 && (
                <Text style={[styles.historyMoreText, { color: colors.foregroundMuted }]}>
                  <Text style={{ fontFamily: fontFamily.mono }}>
                    +{item.recommendations.length - 5}
                  </Text>{' '}
                  {t('recommendation.moreSchools')}
                </Text>
              )}
            </View>

            <AnimatedButton
              onPress={() => onViewResult(item)}
              variant="outline"
              size="sm"
              style={styles.historyViewButton}
            >
              {t('recommendation.viewFull')}
            </AnimatedButton>
          </View>
        )}
      </CardContent>
    </AnimatedCard>
  );
});

const styles = StyleSheet.create({
  historyCard: {
    marginBottom: spacing.md,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyCardInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  historySchoolCount: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  historyTierRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginRight: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  historyTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  historyTierBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyTierBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  historyExpandedContent: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
  },
  historySummary: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing.md,
  },
  historySchoolList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  historySchoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historySchoolDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historySchoolName: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  historySchoolScore: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  historyMoreText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginLeft: spacing.lg,
  },
  historyViewButton: {
    alignSelf: 'flex-start',
  },
});
