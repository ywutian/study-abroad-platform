/**
 * Essay Gallery - List item card for each essay in the gallery.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCard, Badge } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { GalleryEssay } from './types';
import { RESULT_COLORS, resultBadgeVariant } from './types';

interface EssayCardProps {
  item: GalleryEssay;
  index: number;
  onPress: (id: string) => void;
}

export const EssayCard = React.memo(function EssayCard({ item, index, onPress }: EssayCardProps) {
  const { t } = useTranslation();
  const c = useColors();
  const resultColor = RESULT_COLORS[item.result] || c.foregroundMuted;

  const typeLabel = useCallback(
    (type: string) => {
      const map: Record<string, string> = {
        ALL: t('essayGallery.essayTypes.all'),
        COMMON_APP: t('essayGallery.essayTypes.commonApp'),
        UC: t('essayGallery.essayTypes.uc'),
        SUPPLEMENTAL: t('essayGallery.essayTypes.supplemental'),
        WHY_SCHOOL: t('essayGallery.essayTypes.whySchool'),
        OTHER: t('essayGallery.essayTypes.other'),
      };
      return map[type] || type;
    },
    [t]
  );

  const resultLabel = useCallback(
    (result: string) => {
      const map: Record<string, string> = {
        ADMITTED: t('essayGallery.results.admitted'),
        REJECTED: t('essayGallery.results.rejected'),
        WAITLISTED: t('essayGallery.results.waitlisted'),
        DEFERRED: t('essayGallery.results.deferred'),
      };
      return map[result] || result;
    },
    [t]
  );

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <AnimatedCard onPress={() => onPress(item.id)} style={S.essayCard}>
        <View style={S.essayCardInner}>
          {/* Left color indicator bar */}
          <View style={[S.resultBar, { backgroundColor: resultColor }]} />

          <View style={S.essayCardBody}>
            {/* Top row: school + rank */}
            <View style={S.essayCardTopRow}>
              <View style={S.schoolInfo}>
                <Text style={[S.schoolName, { color: c.foreground }]} numberOfLines={1}>
                  {item.school?.name || t('essayGallery.unknownSchool')}
                </Text>
                {item.school?.usNewsRank && (
                  <View style={[S.rankBadge, { backgroundColor: c.info + '20' }]}>
                    <Text style={[S.rankText, { color: c.info }]}>#{item.school.usNewsRank}</Text>
                  </View>
                )}
              </View>
              {item.isVerified && (
                <View style={S.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={RESULT_COLORS.ADMITTED} />
                  <Text style={[S.verifiedText, { color: RESULT_COLORS.ADMITTED }]}>
                    {t('essayGallery.verified')}
                  </Text>
                </View>
              )}
            </View>

            {/* Badges row */}
            <View style={S.badgeRow}>
              {item.essayType && <Badge variant="secondary">{typeLabel(item.essayType)}</Badge>}
              <Badge variant={resultBadgeVariant(item.result)}>{resultLabel(item.result)}</Badge>
              <Text style={[S.yearText, { color: c.foregroundMuted }]}>{item.year}</Text>
            </View>

            {/* Preview */}
            {item.preview && (
              <Text style={[S.previewText, { color: c.foregroundSecondary }]} numberOfLines={3}>
                {item.preview}
              </Text>
            )}

            {/* Footer: word count + tags */}
            <View style={S.essayCardFooter}>
              <Text style={[S.wordCount, { color: c.foregroundMuted }]}>
                {t('essayGallery.wordCount', { count: item.wordCount })}
              </Text>
              {item.tags.length > 0 && (
                <View style={S.tagsRow}>
                  {item.tags.slice(0, 3).map((tag) => (
                    <View key={tag} style={[S.tagChip, { backgroundColor: c.muted }]}>
                      <Text style={[S.tagText, { color: c.foregroundMuted }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </AnimatedCard>
    </Animated.View>
  );
});

const S = StyleSheet.create({
  essayCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  essayCardInner: {
    flexDirection: 'row',
  },
  resultBar: {
    width: 4,
    borderTopLeftRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.lg,
  },
  essayCardBody: {
    flex: 1,
    padding: spacing.lg,
  },
  essayCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    flexShrink: 1,
  },
  rankBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  rankText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifiedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  yearText: {
    fontSize: fontSize.xs,
  },
  previewText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing.sm,
  },
  essayCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordCount: {
    fontSize: fontSize.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: 10,
  },
});
