/**
 * ResultOverlay — shown after a swipe prediction: correct/incorrect + the
 * real outcome.
 *
 * 2026-05 Hall Plan C (C3): de-gamified. The points / streak reward pills
 * and the badge-upgrade banner were removed.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useColors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/utils/theme';

import { SwipeResultDto, CARD_WIDTH } from './types';

interface ResultOverlayProps {
  result: SwipeResultDto;
}

export default function ResultOverlay({ result }: ResultOverlayProps) {
  const { t } = useTranslation();
  const c = useColors();

  const isCorrect = result.isCorrect;
  const fgColor = isCorrect ? c.success : c.error;
  const icon = isCorrect ? 'checkmark-circle' : 'close-circle';
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

        <Text style={[styles.resultHint, { color: c.foregroundMuted }]}>
          {t('swipe.nextCardHint')}
        </Text>
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
  resultHint: {
    fontSize: fontSize.sm,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
