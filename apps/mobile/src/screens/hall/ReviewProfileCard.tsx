/**
 * ReviewProfileCard — desensitized public profile summary for peer feedback.
 *
 * Plan C / C2: numeric scoring was removed. This card is now purely a read-only
 * summary of the applicant across all four dimensions (academic / test /
 * activity / award) — the reviewer reads it, then writes qualitative feedback
 * in `ReviewFeedbackTab`. No swipe overlays, no step counter.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';
import type { ReviewProfileCard as ReviewProfileCardData, ReviewStep, Colors } from './types';
import { REVIEW_STEPS } from './types';

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
}

export default function ReviewProfileCard({ profile }: ReviewProfileCardProps) {
  const { t } = useTranslation();
  const c = useColors();
  const dash = '—';

  const sectionBody = (step: ReviewStep): React.ReactNode => {
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
      </View>

      {/* All four dimensions, read-only */}
      <View style={S.body}>
        {REVIEW_STEPS.map((step) => (
          <View key={step} style={S.section}>
            <View style={[S.stepBadge, { backgroundColor: withOpacity(c.primary, 0.1) }]}>
              <Ionicons name={STEP_ICON[step]} size={16} color={c.primary} />
              <Text style={[S.stepTitle, { color: c.primary }]}>
                {t(`hall.review.steps.${step}`)}
              </Text>
            </View>
            <View style={S.dimList}>{sectionBody(step)}</View>
          </View>
        ))}
      </View>
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
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
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
});
