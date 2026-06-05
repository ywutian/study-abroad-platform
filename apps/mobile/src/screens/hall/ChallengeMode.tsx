/**
 * ChallengeMode — batch challenge sub-mode of the Path tab (Stage 4 M4).
 *
 * The reviewer sees ONE applicant's profile and predicts the admission
 * result for each of the schools that applicant applied to (3-10 schools),
 * then submits all guesses at once via `POST /halls/swipe/challenge` and
 * sees a per-school correct/wrong breakdown.
 *
 * Mobile-equivalent of the web `ChallengeTab` — no game-y framing, mirrors
 * the project's "学长之路" intuition-building intent.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton, Badge, EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { hallRoutes } from '@study-abroad/shared';
import type { ChallengeAttemptResult } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useColors, spacing, fontSize, fontWeight, borderRadius, fontFamily } from '@/utils/theme';

type ChallengeResultOption = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
const RESULT_OPTIONS: ChallengeResultOption[] = ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'];

interface ChallengeSchool {
  caseId: string;
  schoolId?: string;
  schoolName?: string;
  schoolNameZh?: string;
  usNewsRank?: number;
  major?: string;
  round?: string;
}

interface ChallengeCase {
  applicantProfile: {
    grade?: string | null;
    schoolType?: string | null;
    gpa?: string | null;
    sat?: string | null;
    toefl?: string | null;
    nationality?: string;
    targetMajor?: string;
  };
  schools: ChallengeSchool[];
}

const RESULT_VARIANT: Record<ChallengeResultOption, 'success' | 'error' | 'warning' | 'secondary'> =
  {
    ADMITTED: 'success',
    REJECTED: 'error',
    WAITLISTED: 'warning',
    DEFERRED: 'secondary',
  };

export function ChallengeMode() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isZh = i18n.language === 'zh';

  const [guesses, setGuesses] = useState<Record<string, ChallengeResultOption>>({});
  const [result, setResult] = useState<ChallengeAttemptResult | null>(null);

  const {
    data: challenge,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ChallengeCase | null>({
    queryKey: qk.hall.challenge(),
    queryFn: () => apiClient.get<ChallengeCase | null>(hallRoutes.challengeSubmit()),
    staleTime: 0,
  });

  const submitMutation = useMutation<ChallengeAttemptResult, Error, Record<string, string>>({
    mutationFn: (g) =>
      apiClient.post<ChallengeAttemptResult>(hallRoutes.challengeSubmit(), { guesses: g }),
    onSuccess: (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(res);
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  const schools = useMemo(() => challenge?.schools ?? [], [challenge]);
  const allGuessed = useMemo(
    () => schools.length > 0 && schools.every((s) => guesses[s.caseId]),
    [schools, guesses]
  );

  const pickGuess = useCallback((caseId: string, option: ChallengeResultOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGuesses((prev) => ({ ...prev, [caseId]: option }));
  }, []);

  const submit = useCallback(() => {
    if (!allGuessed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    submitMutation.mutate(guesses);
  }, [allGuessed, guesses, submitMutation]);

  const startNew = useCallback(() => {
    setGuesses({});
    setResult(null);
    refetch();
  }, [refetch]);

  if (isLoading) return <Loading text={t('hall.challenge.loading')} />;

  if (!challenge || schools.length === 0) {
    return (
      <EmptyState
        icon="layers-outline"
        title={t('hall.challenge.empty')}
        description={t('hall.challenge.emptyDesc')}
        action={{ label: t('hall.challenge.newChallenge'), onPress: startNew }}
      />
    );
  }

  const profile = challenge.applicantProfile;
  const resultByCaseId = new Map(result?.results.map((r) => [r.caseId, r]));

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
    >
      {/* Applicant profile summary */}
      <View style={[S.profileCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[S.sectionTitle, { color: c.foreground }]}>
          {t('hall.challenge.applicantProfile')}
        </Text>
        <View style={S.profileGrid}>
          {profile.grade ? (
            <ProfileChip c={c} label={t('hall.challenge.grade')} value={profile.grade} />
          ) : null}
          {profile.gpa ? <ProfileChip c={c} label="GPA" value={profile.gpa} mono /> : null}
          {profile.sat ? <ProfileChip c={c} label="SAT" value={profile.sat} mono /> : null}
          {profile.toefl ? <ProfileChip c={c} label="TOEFL" value={profile.toefl} mono /> : null}
          {profile.targetMajor ? (
            <ProfileChip
              c={c}
              label={t('hall.challenge.targetMajor')}
              value={profile.targetMajor}
            />
          ) : null}
        </View>
      </View>

      {/* Predict per school */}
      <Text style={[S.sectionTitle, { color: c.foreground, marginTop: spacing.lg }]}>
        {t('hall.challenge.predictResults')} ·{' '}
        {t('hall.challenge.schoolsCount', { count: schools.length })}
      </Text>

      {schools.map((school, idx) => {
        const guess = guesses[school.caseId];
        const revealed = resultByCaseId.get(school.caseId);
        const label = isZh && school.schoolNameZh ? school.schoolNameZh : school.schoolName;
        return (
          <Animated.View
            key={school.caseId}
            entering={FadeInUp.delay(idx * 40).springify()}
            style={[S.schoolCard, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={S.schoolHeader}>
              <Text style={[S.schoolName, { color: c.foreground }]} numberOfLines={1}>
                {label || '—'}
              </Text>
              {school.usNewsRank ? <Badge variant="secondary">#{school.usNewsRank}</Badge> : null}
            </View>

            {revealed ? (
              <View style={S.revealRow}>
                <View style={S.revealCol}>
                  <Text style={[S.revealLabel, { color: c.foregroundMuted }]}>
                    {t('hall.challenge.yourGuess')}
                  </Text>
                  <Badge variant={RESULT_VARIANT[guess]}>
                    {t(`hall.challenge.results.${guess}`)}
                  </Badge>
                </View>
                <View style={S.revealCol}>
                  <Text style={[S.revealLabel, { color: c.foregroundMuted }]}>
                    {t('hall.challenge.actual')}
                  </Text>
                  <Badge
                    variant={
                      RESULT_VARIANT[revealed.actual as ChallengeResultOption] ?? 'secondary'
                    }
                  >
                    {t(`hall.challenge.results.${revealed.actual}`, {
                      defaultValue: revealed.actual,
                    })}
                  </Badge>
                </View>
                <Ionicons
                  name={revealed.isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={revealed.isCorrect ? c.success : c.error}
                />
              </View>
            ) : (
              <View style={S.optionsRow}>
                {RESULT_OPTIONS.map((option) => {
                  const active = guess === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => pickGuess(school.caseId, option)}
                      style={[S.optionPill, { backgroundColor: active ? c.primary : c.muted }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t(`hall.challenge.results.${option}`)}
                    >
                      <Text
                        style={[
                          S.optionText,
                          { color: active ? c.primaryForeground : c.foreground },
                        ]}
                      >
                        {t(`hall.challenge.results.${option}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>
        );
      })}

      {/* Result summary or submit — 2026-05 Hall Plan C (C3): de-gamified.
          Plain "how many you read correctly" debrief, no reward line. */}
      {result ? (
        <Animated.View
          entering={FadeInUp.springify()}
          style={[S.resultCard, { backgroundColor: c.card, borderColor: c.border }]}
        >
          <Text style={[S.resultAccuracy, { color: c.foreground }]}>
            {t('hall.challenge.summary', {
              correct: result.correct,
              total: result.total,
            })}
          </Text>
          <AnimatedButton onPress={startNew} style={{ marginTop: spacing.md }}>
            {t('hall.challenge.newChallenge')}
          </AnimatedButton>
        </Animated.View>
      ) : (
        <AnimatedButton
          onPress={submit}
          disabled={!allGuessed}
          loading={submitMutation.isPending || isFetching}
          style={{ marginTop: spacing.lg }}
        >
          {submitMutation.isPending ? t('hall.challenge.submitting') : t('hall.challenge.submit')}
        </AnimatedButton>
      )}
    </ScrollView>
  );
}

function ProfileChip({
  c,
  label,
  value,
  mono,
}: {
  c: ReturnType<typeof useColors>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={[S.chip, { backgroundColor: c.muted }]}>
      <Text style={[S.chipLabel, { color: c.foregroundMuted }]}>{label}</Text>
      <Text style={[S.chipValue, { color: c.foreground }, mono && { fontFamily: fontFamily.mono }]}>
        {value}
      </Text>
    </View>
  );
}

const S = StyleSheet.create({
  profileCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
  },
  chipLabel: {
    fontSize: fontSize.xs,
  },
  chipValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: 2,
  },
  schoolCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  schoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  schoolName: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  optionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  revealCol: {
    gap: spacing.xs,
  },
  revealLabel: {
    fontSize: fontSize.xs,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  resultAccuracy: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});
