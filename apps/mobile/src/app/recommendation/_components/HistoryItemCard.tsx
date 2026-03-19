import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { AnimatedButton, AnimatedCard, CardContent } from '@/components/ui';
import { colors as themeColors, spacing, fontSize, fontWeight } from '@/utils/theme';

import { RecommendationResult, ColorsType, TIER_CONFIG, formatDate } from './types';

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
  const reachCount = item.recommendations.filter((r) => r.tier === 'reach').length;
  const matchCount = item.recommendations.filter((r) => r.tier === 'match').length;
  const safetyCount = item.recommendations.filter((r) => r.tier === 'safety').length;

  return (
    <AnimatedCard style={styles.historyCard} onPress={() => onToggle(item.id)}>
      <CardContent>
        <View style={styles.historyCardHeader}>
          <View style={styles.historyCardInfo}>
            <Text style={[styles.historyDate, { color: colors.foreground }]}>
              {formatDate(item.createdAt)}
            </Text>
            <Text style={[styles.historySchoolCount, { color: colors.foregroundMuted }]}>
              {item.recommendations.length} {t('recommendation.schools', 'schools')}
            </Text>
          </View>
          <View style={styles.historyTierRow}>
            {reachCount > 0 && (
              <View style={[styles.historyTierDot, { backgroundColor: TIER_CONFIG.reach.color }]}>
                <Text style={styles.historyTierDotText}>{reachCount}</Text>
              </View>
            )}
            {matchCount > 0 && (
              <View style={[styles.historyTierDot, { backgroundColor: TIER_CONFIG.match.color }]}>
                <Text style={styles.historyTierDotText}>{matchCount}</Text>
              </View>
            )}
            {safetyCount > 0 && (
              <View style={[styles.historyTierDot, { backgroundColor: TIER_CONFIG.safety.color }]}>
                <Text style={styles.historyTierDotText}>{safetyCount}</Text>
              </View>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.foregroundMuted}
          />
        </View>

        {isExpanded && (
          <View style={styles.historyExpandedContent}>
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
                      { backgroundColor: TIER_CONFIG[school.tier].color },
                    ]}
                  />
                  <Text
                    style={[styles.historySchoolName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {school.schoolName}
                  </Text>
                  <Text style={[styles.historySchoolScore, { color: colors.foregroundMuted }]}>
                    {school.fitScore}
                  </Text>
                </View>
              ))}
              {item.recommendations.length > 5 && (
                <Text style={[styles.historyMoreText, { color: colors.foregroundMuted }]}>
                  +{item.recommendations.length - 5} {t('recommendation.moreSchools', 'more')}
                </Text>
              )}
            </View>

            <AnimatedButton
              onPress={() => onViewResult(item)}
              variant="outline"
              size="sm"
              style={styles.historyViewButton}
            >
              {t('recommendation.viewFull', 'View Full Results')}
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
  },
  historyTierDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTierDotText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: themeColors.light.onGradient,
  },
  historyExpandedContent: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: themeColors.light.border,
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
