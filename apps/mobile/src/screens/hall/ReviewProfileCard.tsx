/**
 * ReviewProfileCard — single step of the Tinder-style peer review deck.
 *
 * Each card shows ONE review dimension (academic / test / activity / award)
 * of a desensitized public profile. The reviewer swipes:
 *   right = strong · left = weak · up = unsure
 *
 * Pure presentational — all gesture/animation lives in ReviewSwipeTab.
 * Mirrors `apps/mobile/src/screens/swipe/CaseCard.tsx` styling conventions.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { ReviewProfileCard as ReviewProfileCardData, ReviewStep, Colors } from './types';

const STEP_ICON: Record<ReviewStep, keyof typeof Ionicons.glyphMap> = {
  academic: 'school-outline',
  test: 'document-text-outline',
  activity: 'people-outline',
  award: 'trophy-outline',
};

interface DimensionRowProps {
  c: Colors;
  label: string;
  value: string;
}

function DimensionRow({ c, label, value }: DimensionRowProps) {
  return (
    <View style={S.dimRow}>
      <Text style={[S.dimLabel, { color: c.foregroundMuted }]}>{label}</Text>
      <Text style={[S.dimValue, { color: c.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

interface ReviewProfileCardProps {
  profile: ReviewProfileCardData;
  step: ReviewStep;
  stepIndex: number;
  totalSteps: number;
  isTop: boolean;
  strongOverlayStyle?: AnimatedStyle<ViewStyle>;
  weakOverlayStyle?: AnimatedStyle<ViewStyle>;
  unsureOverlayStyle?: AnimatedStyle<ViewStyle>;
}

export default function ReviewProfileCard({
  profile,
  step,
  stepIndex,
  totalSteps,
  isTop,
  strongOverlayStyle,
  weakOverlayStyle,
  unsureOverlayStyle,
}: ReviewProfileCardProps) {
  const { t } = useTranslation();
  const c = useColors();
  const dash = '—';

  const stepBody = (): React.ReactNode => {
    switch (step) {
      case 'academic':
        return (
          <>
            <DimensionRow c={c} label="GPA" value={profile.gpaRange || dash} />
            <DimensionRow
              c={c}
              label={t('hall.review.steps.test')}
              value={profile.curriculumType || dash}
            />
            <DimensionRow
              c={c}
              label={t('hall.review.targetMajor')}
              value={profile.targetMajor || t('hall.review.unknownMajor')}
            />
          </>
        );
      case 'test':
        return (
          <>
            <DimensionRow c={c} label="SAT" value={profile.satRange || dash} />
            <DimensionRow c={c} label="ACT" value={profile.actRange || dash} />
            <DimensionRow c={c} label="TOEFL" value={profile.toeflRange || dash} />
          </>
        );
      case 'activity':
        return (
          <>
            <DimensionRow
              c={c}
              label={t('hall.review.steps.activity')}
              value={String(profile.activityCount)}
            />
            <DimensionRow
              c={c}
              label={t('hall.card.scores')}
              value={(profile.activityCategories || []).join(' · ') || dash}
            />
          </>
        );
      case 'award':
        return (
          <>
            <DimensionRow
              c={c}
              label={t('hall.review.steps.award')}
              value={String(profile.awardCount)}
            />
            <DimensionRow c={c} label="Tier" value={profile.topAwardTier || dash} />
          </>
        );
    }
  };

  return (
    <View style={[S.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Header — profile identity */}
      <View style={[S.header, { borderBottomColor: c.border }]}>
        <Avatar source={profile.avatarUrl} name={profile.nickname} size="default" />
        <View style={S.headerText}>
          <Text style={[S.nickname, { color: c.foreground }]} numberOfLines={1}>
            {profile.nickname}
          </Text>
          <Text style={[S.meta, { color: c.foregroundMuted }]} numberOfLines={1}>
            {[profile.grade, profile.region].filter(Boolean).join(' · ') || dash}
          </Text>
        </View>
        <Text style={[S.stepCounter, { color: c.foregroundMuted }]}>
          {stepIndex + 1}/{totalSteps}
        </Text>
      </View>

      {/* Step body — the dimension under review */}
      <View style={S.body}>
        <View style={[S.stepBadge, { backgroundColor: c.primary + '15' }]}>
          <Ionicons name={STEP_ICON[step]} size={16} color={c.primary} />
          <Text style={[S.stepTitle, { color: c.primary }]}>{t(`hall.review.steps.${step}`)}</Text>
        </View>
        <Text style={[S.stepDesc, { color: c.foregroundMuted }]}>
          {t(`hall.review.stepDesc.${step}`)}
        </Text>
        <View style={S.dimList}>{stepBody()}</View>
        <Text style={[S.swipeHint, { color: c.foregroundMuted }]}>
          {t('hall.review.swipeHint')}
        </Text>
      </View>

      {/* Directional swipe overlays — only on the top card */}
      {isTop && (
        <>
          <Animated.View
            style={[S.overlay, S.overlayRight, { borderColor: c.success }, strongOverlayStyle]}
          >
            <Text style={[S.overlayText, { color: c.success }]}>{t('hall.review.swipeRight')}</Text>
          </Animated.View>
          <Animated.View
            style={[S.overlay, S.overlayLeft, { borderColor: c.error }, weakOverlayStyle]}
          >
            <Text style={[S.overlayText, { color: c.error }]}>{t('hall.review.swipeLeft')}</Text>
          </Animated.View>
          <Animated.View
            style={[S.overlay, S.overlayUp, { borderColor: c.warning }, unsureOverlayStyle]}
          >
            <Text style={[S.overlayText, { color: c.warning }]}>{t('hall.review.swipeUp')}</Text>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  nickname: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  meta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  stepCounter: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  stepTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  stepDesc: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  dimList: {
    gap: spacing.sm,
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dimLabel: {
    fontSize: fontSize.sm,
    flexShrink: 0,
  },
  dimValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  swipeHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  overlay: {
    position: 'absolute',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 3,
    borderRadius: borderRadius.md,
  },
  overlayRight: {
    top: spacing.xl,
    left: spacing.xl,
    transform: [{ rotate: '-18deg' }],
  },
  overlayLeft: {
    top: spacing.xl,
    right: spacing.xl,
    transform: [{ rotate: '18deg' }],
  },
  overlayUp: {
    top: spacing.xl,
    alignSelf: 'center',
  },
  overlayText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
});
