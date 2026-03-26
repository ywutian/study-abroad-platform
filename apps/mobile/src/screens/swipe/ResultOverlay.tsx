/**
 * ResultOverlay — Shown after a swipe prediction, indicating correct/incorrect
 * with points, streak, and badge upgrade info.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

import { SwipeResultDto, BADGE_COLORS } from './types';

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

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={[styles.resultOverlay, { backgroundColor: bgColor }]}
    >
      <Ionicons name={icon} size={56} color={fgColor} />
      <Text style={[styles.resultTitle, { color: fgColor }]}>
        {isCorrect ? t('swipe.correct') : t('swipe.incorrect')}
      </Text>

      {isCorrect ? (
        <View style={styles.resultDetails}>
          <Text style={[styles.resultPoints, { color: fgColor }]}>
            +{result.pointsEarned} {t('swipe.points')}
          </Text>
          <View style={styles.resultStreakRow}>
            <Ionicons name="flame" size={20} color={c.warning} />
            <Text style={[styles.resultStreak, { color: c.warning }]}>{result.currentStreak}</Text>
          </View>
          {result.badgeUpgraded && (
            <View
              style={[
                styles.badgeUpgrade,
                { backgroundColor: BADGE_COLORS[result.currentBadge] + '20' },
              ]}
            >
              <Ionicons
                name="arrow-up-circle"
                size={18}
                color={BADGE_COLORS[result.currentBadge]}
              />
              <Text style={[styles.badgeUpgradeText, { color: BADGE_COLORS[result.currentBadge] }]}>
                {t('swipe.badgeUpgraded', {
                  badge: t(`swipe.badges.${result.currentBadge.toLowerCase()}`),
                })}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.resultDetails}>
          <Text style={[styles.resultActual, { color: c.foregroundSecondary }]}>
            {t('swipe.actualResult')}: {result.actualResult}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  resultTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing.md,
  },
  resultDetails: {
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  resultPoints: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  resultStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resultStreak: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  resultActual: {
    fontSize: fontSize.base,
  },
  badgeUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  badgeUpgradeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
