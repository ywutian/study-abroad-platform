/**
 * CaseCard — Renders a single admission case card with school info,
 * test scores, activities, awards, tags, and directional swipe overlays.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
  fontFamily,
  withOpacity,
} from '@/utils/theme';
import { RankingBadge } from '@/components/ui';

import { SwipeCaseDto, CARD_HEIGHT, getTierBgColor } from './types';

interface CaseCardProps {
  caseData: SwipeCaseDto;
  isTop: boolean;
  admitOverlayStyle?: AnimatedStyle<ViewStyle>;
  rejectOverlayStyle?: AnimatedStyle<ViewStyle>;
  waitlistOverlayStyle?: AnimatedStyle<ViewStyle>;
}

export default function CaseCard({
  caseData,
  isTop,
  admitOverlayStyle,
  rejectOverlayStyle,
  waitlistOverlayStyle,
}: CaseCardProps) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const isZh = i18n.language === 'zh';

  const tierBg = getTierBgColor(caseData.usNewsRank);
  const schoolLabel = isZh && caseData.schoolNameZh ? caseData.schoolNameZh : caseData.schoolName;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Tier gradient header */}
      <View style={[styles.cardHeader, { backgroundColor: tierBg }]}>
        <View style={styles.cardHeaderTop}>
          <View style={styles.schoolRow}>
            <Text style={[styles.schoolName, { color: c.foreground }]} numberOfLines={2}>
              {schoolLabel}
            </Text>
            {caseData.isVerified && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={c.success}
                style={{ marginLeft: spacing.xs }}
              />
            )}
          </View>
          <RankingBadge usNewsRank={caseData.usNewsRank} />
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          {caseData.year > 0 && (
            <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
              <Text
                style={[
                  styles.metaText,
                  { color: c.foregroundSecondary, fontFamily: fontFamily.mono },
                ]}
              >
                {caseData.year}
              </Text>
            </View>
          )}
          {caseData.round && (
            <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
              <Text style={[styles.metaText, { color: c.foregroundSecondary }]}>
                {caseData.round}
              </Text>
            </View>
          )}
          {caseData.major && (
            <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
              <Text style={[styles.metaText, { color: c.foregroundSecondary }]} numberOfLines={1}>
                {caseData.major}
              </Text>
            </View>
          )}
          {caseData.acceptanceRate != null && (
            <View style={[styles.metaChip, { backgroundColor: c.muted }]}>
              <Text style={[styles.metaText, { color: c.foregroundSecondary }]}>
                {t('swipe.acceptanceRate')}: {Math.round(caseData.acceptanceRate)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {caseData.gpaRange && (
          <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
            <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>GPA</Text>
            <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.gpaRange}</Text>
          </View>
        )}
        {caseData.satRange && (
          <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
            <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>SAT</Text>
            <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.satRange}</Text>
          </View>
        )}
        {caseData.actRange && (
          <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
            <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>ACT</Text>
            <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.actRange}</Text>
          </View>
        )}
        {caseData.toeflRange && (
          <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
            <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>TOEFL</Text>
            <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.toeflRange}</Text>
          </View>
        )}
        {caseData.apCount != null && caseData.apCount > 0 && (
          <View style={[styles.gridItem, { backgroundColor: c.muted }]}>
            <Text style={[styles.gridLabel, { color: c.foregroundMuted }]}>AP</Text>
            <Text style={[styles.gridValue, { color: c.foreground }]}>{caseData.apCount}</Text>
          </View>
        )}
      </View>

      {/* Activity / Award summary */}
      <View style={styles.summarySection}>
        {caseData.activityCount != null && caseData.activityCount > 0 && (
          <View style={styles.summaryRow}>
            <Ionicons name="people-outline" size={16} color={c.foregroundMuted} />
            <Text style={[styles.summaryText, { color: c.foregroundSecondary }]}>
              {t('swipe.activities', { count: caseData.activityCount })}
            </Text>
          </View>
        )}
        {caseData.activityHighlights && caseData.activityHighlights.length > 0 && (
          <View style={styles.chipsRow}>
            {caseData.activityHighlights.slice(0, 3).map((hl, i) => (
              <View
                key={i}
                style={[styles.chip, { backgroundColor: withOpacity(c.primary, 0.07) }]}
              >
                <Text style={[styles.chipText, { color: c.primary }]} numberOfLines={1}>
                  {hl}
                </Text>
              </View>
            ))}
          </View>
        )}
        {caseData.awardCount != null && caseData.awardCount > 0 && (
          <View style={styles.summaryRow}>
            <Ionicons name="trophy-outline" size={16} color={c.warning} />
            <Text style={[styles.summaryText, { color: c.foregroundSecondary }]}>
              {t('swipe.awards', { count: caseData.awardCount })}
              {caseData.highestAwardLevel ? ` (${caseData.highestAwardLevel})` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Tags */}
      {caseData.tags && caseData.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {caseData.tags.slice(0, 4).map((tag, i) => (
            <View key={i} style={[styles.tagChip, { backgroundColor: c.muted }]}>
              <Text style={[styles.tagText, { color: c.foregroundMuted }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Swipe direction overlays */}
      {isTop && admitOverlayStyle && rejectOverlayStyle && waitlistOverlayStyle && (
        <>
          {/* ADMIT overlay (right) */}
          <Animated.View
            style={[
              styles.directionOverlay,
              { backgroundColor: withOpacity(c.success, 0.082) },
              admitOverlayStyle,
            ]}
            pointerEvents="none"
          >
            <View style={[styles.overlayBadge, { borderColor: c.success }]}>
              <Text style={[styles.overlayText, { color: c.success }]}>{t('swipe.admit')}</Text>
            </View>
          </Animated.View>

          {/* REJECT overlay (left) */}
          <Animated.View
            style={[
              styles.directionOverlay,
              { backgroundColor: withOpacity(c.error, 0.082) },
              rejectOverlayStyle,
            ]}
            pointerEvents="none"
          >
            <View style={[styles.overlayBadge, { borderColor: c.error }]}>
              <Text style={[styles.overlayText, { color: c.error }]}>{t('swipe.reject')}</Text>
            </View>
          </Animated.View>

          {/* WAITLIST overlay (down) */}
          <Animated.View
            style={[
              styles.directionOverlay,
              { backgroundColor: withOpacity(c.warning, 0.082) },
              waitlistOverlayStyle,
            ]}
            pointerEvents="none"
          >
            <View style={[styles.overlayBadge, { borderColor: c.warning }]}>
              <Text style={[styles.overlayText, { color: c.warning }]}>{t('swipe.waitlist')}</Text>
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.lg,
    maxHeight: CARD_HEIGHT,
  },
  cardHeader: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    flexShrink: 1,
  },
  rankBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  rankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  metaText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gridItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 70,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gridValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
  summarySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: fontSize.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingLeft: spacing.xl + spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    maxWidth: 140,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
  directionOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
  },
  overlayBadge: {
    borderWidth: 3,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    transform: [{ rotate: '-15deg' }],
  },
  overlayText: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
