/**
 * ResultOverlay — Shown after a swipe prediction, indicating correct/incorrect
 * with points, streak, and badge upgrade info.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useColors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/utils/theme';

import { SwipeResultDto, BADGE_COLORS, normalizeBadge, CARD_WIDTH } from './types';

interface ResultOverlayProps {
  result: SwipeResultDto;
}

export default function ResultOverlay({ result }: ResultOverlayProps) {
  const { t } = useTranslation();
  const c = useColors();

  const isCorrect = result.isCorrect;
  const bgColor = isCorrect ? c.success + '20' : c.error + '20';
  const fgColor = isCorrect ? c.success : c.error;
  const icon = isCorrect ? 'checkmark-circle' : 'close-circle';
  const currentBadge = normalizeBadge(result.currentBadge);
  const predictedLabel = t(`swipe.${result.prediction}`);
  const localizedActualResult = t(`cases.result.${result.actualResult.toLowerCase()}`, {
    defaultValue: result.actualResult,
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={styles.resultOverlay}
      pointerEvents="none"
    >
      <View
        style={[
          styles.resultPanel,
          {
            backgroundColor: c.card,
            borderColor: isCorrect ? c.success + '30' : c.error + '24',
            shadowColor: c.shadow,
          },
        ]}
      >
        <View
          style={[
            styles.resultIconWrap,
            { backgroundColor: isCorrect ? c.success + '15' : c.error + '12' },
          ]}
        >
          <Ionicons name={icon} size={32} color={fgColor} />
        </View>

        <Text style={[styles.resultTitle, { color: fgColor }]}>
          {isCorrect ? t('swipe.correct') : t('swipe.incorrect')}
        </Text>

        <Text style={[styles.resultSubtitle, { color: c.foregroundSecondary }]}>
          {isCorrect
            ? t('swipe.yourPrediction', { result: predictedLabel })
            : t('swipe.actualResult', { result: localizedActualResult })}
        </Text>

        <View style={styles.resultMetaGrid}>
          <View style={[styles.resultMetaCard, { backgroundColor: c.muted }]}>
            <Text style={[styles.resultMetaLabel, { color: c.foregroundMuted }]}>
              {t('swipe.yourPredictionLabel')}
            </Text>
            <Text style={[styles.resultMetaValue, { color: c.foreground }]}>{predictedLabel}</Text>
          </View>

          <View style={[styles.resultMetaCard, { backgroundColor: c.muted }]}>
            <Text style={[styles.resultMetaLabel, { color: c.foregroundMuted }]}>
              {t('swipe.actualResultLabel')}
            </Text>
            <Text style={[styles.resultMetaValue, { color: c.foreground }]}>
              {localizedActualResult}
            </Text>
          </View>
        </View>

        {isCorrect ? (
          <View style={styles.rewardRow}>
            <View style={[styles.rewardPill, { backgroundColor: c.success + '12' }]}>
              <Ionicons name="sparkles-outline" size={14} color={c.success} />
              <Text style={[styles.rewardText, { color: c.success }]}>
                {t('swipe.points', { points: result.pointsEarned })}
              </Text>
            </View>

            <View style={[styles.rewardPill, { backgroundColor: c.warning + '12' }]}>
              <Ionicons name="flame" size={14} color={c.warning} />
              <Text style={[styles.rewardText, { color: c.warning }]}>
                {t('swipe.streakValue', { count: result.currentStreak })}
              </Text>
            </View>
          </View>
        ) : null}

        {result.badgeUpgraded ? (
          <View
            style={[styles.badgeUpgrade, { backgroundColor: BADGE_COLORS[currentBadge] + '16' }]}
          >
            <Ionicons name="arrow-up-circle" size={16} color={BADGE_COLORS[currentBadge]} />
            <Text style={[styles.badgeUpgradeText, { color: BADGE_COLORS[currentBadge] }]}>
              {t('swipe.badgeUpgrade', {
                badge: t(`swipe.badges.${currentBadge}`),
              })}
            </Text>
          </View>
        ) : (
          <Text style={[styles.resultHint, { color: c.foregroundMuted }]}>
            {t('swipe.nextCardHint')}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  resultOverlay: {
    position: 'absolute',
    width: CARD_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: spacing.lg,
  },
  resultPanel: {
    width: '100%',
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.xl,
    alignItems: 'center',
    ...shadows.xl,
  },
  resultIconWrap: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },
  resultSubtitle: {
    fontSize: fontSize.base,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  resultMetaGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  resultMetaCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  resultMetaLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultMetaValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rewardText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  badgeUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  badgeUpgradeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  resultHint: {
    fontSize: fontSize.sm,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
