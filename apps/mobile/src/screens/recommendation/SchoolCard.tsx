import React, { memo } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import {
  AnimatedCard,
  CardContent,
  Badge,
  RankingBadge,
  Progress,
  AnimatedCounter,
} from '@/components/ui';
import { spacing, fontSize, fontWeight, fontFamily } from '@/utils/theme';
import { formatAcceptanceRate } from '@/utils/format';
import { SchoolAvatar } from '@/components/features/SchoolAvatar';

import { isSafeUrl } from '@study-abroad/shared/utils';

import {
  RecommendedSchool,
  ColorsType,
  TIER_CONFIG,
  getTierBadgeVariant,
  formatCurrency,
} from './types';

interface SchoolCardProps {
  school: RecommendedSchool;
  colors: ColorsType;
}

export const SchoolCard = memo(function SchoolCard({ school, colors }: SchoolCardProps) {
  const { t } = useTranslation();
  const tierConfig = TIER_CONFIG[school.tier];

  const getTierLabel = (tier: 'reach' | 'match' | 'safety') => {
    const labels: Record<string, string> = {
      reach: t('recommendation.tierReach'),
      match: t('recommendation.tierMatch'),
      safety: t('recommendation.tierSafety'),
    };
    return labels[tier] || tier;
  };

  return (
    <AnimatedCard
      style={[styles.schoolCard, { borderLeftColor: tierConfig.color, borderLeftWidth: 3 }]}
    >
      <CardContent>
        <View style={styles.schoolCardHeader}>
          <SchoolAvatar
            name={school.schoolName}
            logoUrl={school.schoolMeta?.media?.logo?.url ?? school.schoolMeta?.logoUrl}
            website={school.schoolMeta?.website}
            size="sm"
            style={styles.schoolLogo}
          />
          <View style={styles.schoolCardInfo}>
            <View style={styles.schoolNameRow}>
              <Text
                style={[styles.schoolName, { color: colors.foreground, flex: 1 }]}
                numberOfLines={2}
              >
                {school.schoolName}
              </Text>
              {isSafeUrl(school.schoolMeta?.website) && (
                <TouchableOpacity
                  onPress={() => {
                    Linking.openURL(school.schoolMeta!.website!).catch(() => {});
                  }}
                  accessibilityLabel={t('recommendation.visitWebsite')}
                  accessibilityRole="link"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.websiteButton}
                >
                  <Ionicons name="globe-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.schoolMetaRow}>
              <Badge variant={getTierBadgeVariant(school.tier)}>{getTierLabel(school.tier)}</Badge>
              <RankingBadge
                rankings={school.schoolMeta?.rankings}
                usNewsRank={school.schoolMeta?.usNewsRank}
              />
            </View>
          </View>
          <View style={styles.fitScoreContainer}>
            <AnimatedCounter
              value={school.fitScore}
              style={[styles.fitScoreValue, { color: tierConfig.color }]}
            />
            <Text style={[styles.fitScoreLabel, { color: colors.foregroundMuted }]}>
              {t('recommendation.fitScore')}
            </Text>
          </View>
        </View>

        <View style={styles.probabilitySection}>
          <View style={styles.probabilityHeader}>
            <Text style={[styles.probabilityLabel, { color: colors.foregroundMuted }]}>
              {t('recommendation.probability')}
            </Text>
            <Text
              style={[
                styles.probabilityValue,
                { color: tierConfig.color, fontFamily: fontFamily.mono },
              ]}
            >
              {Math.round(school.estimatedProbability)}%
            </Text>
          </View>
          <Progress
            value={school.estimatedProbability}
            max={100}
            height={6}
            color={tierConfig.color}
            trackColor={colors.muted}
          />
        </View>

        {school.schoolMeta && (
          <View style={styles.schoolMetaDetails}>
            {(school.schoolMeta.city || school.schoolMeta.state) && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={colors.foregroundMuted} />
                <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
                  {[school.schoolMeta.city, school.schoolMeta.state].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
            {school.schoolMeta.acceptanceRate != null && (
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={14} color={colors.foregroundMuted} />
                <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
                  {t('recommendation.acceptRate')}{' '}
                  {formatAcceptanceRate(school.schoolMeta.acceptanceRate)}
                </Text>
              </View>
            )}
            {school.schoolMeta.tuition != null && (
              <View style={styles.metaItem}>
                <Ionicons name="cash-outline" size={14} color={colors.foregroundMuted} />
                <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
                  {formatCurrency(school.schoolMeta.tuition)}/yr
                </Text>
              </View>
            )}
          </View>
        )}

        {school.reasons.length > 0 && (
          <View style={styles.reasonsSection}>
            {school.reasons.map((reason, i) => (
              <View key={i} style={styles.reasonRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.reasonText, { color: colors.foregroundSecondary }]}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        )}

        {school.concerns && school.concerns.length > 0 && (
          <View style={styles.concernsSection}>
            {school.concerns.map((concern, i) => (
              <View key={i} style={styles.reasonRow}>
                <Ionicons name="alert-circle" size={16} color={colors.warning} />
                <Text style={[styles.reasonText, { color: colors.foregroundSecondary }]}>
                  {concern}
                </Text>
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </AnimatedCard>
  );
});

const styles = StyleSheet.create({
  schoolCard: {
    marginBottom: spacing.md,
  },
  schoolCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  schoolCardInfo: {
    flex: 1,
    marginRight: spacing.md,
    gap: spacing.sm,
  },
  schoolLogo: {
    marginRight: spacing.sm,
  },
  schoolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  websiteButton: {
    padding: 2,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.base * 1.3,
  },
  schoolMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankText: {
    fontSize: fontSize.xs,
  },
  fitScoreContainer: {
    alignItems: 'center',
  },
  fitScoreValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
  fitScoreLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  probabilitySection: {
    marginBottom: spacing.md,
  },
  probabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  probabilityLabel: {
    fontSize: fontSize.xs,
  },
  probabilityValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  schoolMetaDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
  },
  reasonsSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  concernsSection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reasonText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
});
