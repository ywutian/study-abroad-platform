import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  AIAnalysisResult,
  AnalysisContextFlag,
  AnalysisState,
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisFeedbackCategory,
  SchoolPolicyContext,
  SubmitApplicationAnalysisFeedbackInput,
  TargetSchoolInsight,
} from '@study-abroad/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Loading,
} from '@/components/ui';
import { aiService } from '@/lib/api/services/ai';
import { useAuthStore } from '@/stores';
import { borderRadius, fontSize, fontWeight, spacing, useColors, withOpacity } from '@/utils/theme';

function getFreshnessVariant(status: AIAnalysisResult['status']) {
  switch (status) {
    case 'degraded':
      return 'error' as const;
    case 'cached':
      return 'secondary' as const;
    default:
      return 'success' as const;
  }
}

function getStateCopy(
  t: (key: string, options?: Record<string, unknown>) => string,
  state: AnalysisState
) {
  return {
    label: t(`applicationAnalysis.states.${state}.label`),
    description: t(`applicationAnalysis.states.${state}.description`),
  };
}

function getPolicyBadgeVariant(policy: SchoolPolicyContext['testingPolicy']) {
  switch (policy) {
    case 'BLIND':
      return 'warning' as const;
    case 'REQUIRED':
      return 'error' as const;
    case 'OPTIONAL':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

export default function ProfileAnalysisScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { isAuthenticated } = useAuthStore();

  const {
    data: analysis,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['profile-ai-analysis'],
    queryFn: () => aiService.profileAnalysis(),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title={t('prediction.empty.loginRequired')}
          description={t('prediction.empty.loginRequiredDesc')}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="analytics-outline"
          title={t('applicationAnalysis.empty.title')}
          description={t('applicationAnalysis.empty.description')}
        />
      </View>
    );
  }

  const state = analysis.meta?.state ?? 'ready';
  const focusSchools = analysis.targetSchoolInsights ?? [];
  const stateCopy = getStateCopy(t, state);
  const dataQuality = analysis.meta?.dataQuality ?? 'insufficient';
  const applicantType = analysis.profileContext?.applicantType ?? 'unknown';
  const testStrategy = analysis.profileContext?.testStrategy ?? 'unknown';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
    >
      <Card style={styles.summaryCard}>
        <CardHeader>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTitleBlock}>
              <CardTitle>{t('applicationAnalysis.title')}</CardTitle>
              <Text style={[styles.summarySubtitle, { color: colors.foregroundMuted }]}>
                {t('applicationAnalysis.subtitle')}
              </Text>
            </View>
            <Badge variant={getFreshnessVariant(analysis.status)}>
              {t(`applicationAnalysis.freshness.${analysis.status ?? 'fresh'}`)}
            </Badge>
          </View>
        </CardHeader>
        <CardContent>
          <View style={styles.summaryBadges}>
            <Badge variant="outline">{stateCopy.label}</Badge>
            <Badge variant="secondary">{t(`applicationAnalysis.dataQuality.${dataQuality}`)}</Badge>
            <Badge variant="secondary">
              {analysis.meta?.analysisVersion ?? 'application-analysis-v1'}
            </Badge>
          </View>
          <Text style={[styles.summaryVerdict, { color: colors.foreground }]}>
            {analysis.portfolioAnalysis?.verdict || analysis.summary}
          </Text>
          <Text style={[styles.summaryBody, { color: colors.foregroundMuted }]}>
            {analysis.summary}
          </Text>

          <View
            style={[
              styles.metricRow,
              {
                backgroundColor: withOpacity(colors.primary, 0.05),
                borderColor: colors.border,
              },
            ]}
          >
            <MetricBlock
              label={t('applicationAnalysis.overallScore')}
              value={String(analysis.overallScore)}
            />
            <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
            <MetricBlock
              label={t('applicationAnalysis.focusSchools')}
              value={String(focusSchools.length)}
            />
          </View>
        </CardContent>
      </Card>

      <Section title={t('applicationAnalysis.profileContext')}>
        <View style={styles.infoGrid}>
          <InfoCard
            label={t('applicationAnalysis.applicantType.title')}
            value={t(`applicationAnalysis.applicantType.${applicantType}`)}
          />
          <InfoCard
            label={t('applicationAnalysis.testStrategy.title')}
            value={t(`applicationAnalysis.testStrategy.${testStrategy}`)}
          />
        </View>
        {analysis.profileContext?.contextFlags?.length ? (
          <View style={styles.badgeWrap}>
            {analysis.profileContext.contextFlags.map((flag) => (
              <Badge key={flag} variant="secondary">
                {t(`applicationAnalysis.contextFlags.${flag as AnalysisContextFlag}`)}
              </Badge>
            ))}
          </View>
        ) : null}
        {analysis.profileContext?.highSchoolContext ? (
          <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
            {analysis.profileContext.highSchoolContext}
          </Text>
        ) : null}
      </Section>

      <Section title={t('applicationAnalysis.schoolListDiagnosis')}>
        <Card>
          <CardContent>
            <View style={styles.badgeWrap}>
              <Badge variant="outline">
                {t(
                  `applicationAnalysis.portfolioBalance.${analysis.portfolioAnalysis?.balance ?? 'insufficient'}`
                )}
              </Badge>
              <Badge variant="secondary">{stateCopy.label}</Badge>
            </View>
            <Text style={[styles.sectionBody, { color: colors.foregroundMuted }]}>
              {stateCopy.description}
            </Text>
            <BulletList items={analysis.portfolioAnalysis?.reasons ?? []} />
            {(analysis.portfolioAnalysis?.riskBoundaries?.length ?? 0) > 0 ? (
              <ListBlock
                title={t('applicationAnalysis.riskBoundaries')}
                items={analysis.portfolioAnalysis?.riskBoundaries ?? []}
                compact
              />
            ) : null}
          </CardContent>
        </Card>
      </Section>

      <Section title={t('applicationAnalysis.focusSchools')}>
        {focusSchools.length > 0 ? (
          focusSchools.map((school) => (
            <FocusSchoolCard key={school.schoolId} analysis={analysis} school={school} />
          ))
        ) : (
          <Card>
            <CardContent>
              <Text style={[styles.sectionBody, { color: colors.foreground }]}>
                {stateCopy.label}
              </Text>
              <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
                {stateCopy.description}
              </Text>
            </CardContent>
          </Card>
        )}
      </Section>

      {analysis.fairnessDisclosure ? (
        <Section title={t('applicationAnalysis.fairness.title')}>
          <Card>
            <CardContent>
              <View style={styles.badgeWrap}>
                <Badge variant="outline">
                  {t(`applicationAnalysis.fairness.status.${analysis.fairnessDisclosure.status}`)}
                </Badge>
                {(analysis.meta?.experimentalVersions ?? []).map((item) => (
                  <Badge key={`${item.capability}-${item.version}`} variant="secondary">
                    {`${item.capability} · ${item.version}`}
                  </Badge>
                ))}
              </View>
              <View style={styles.columnStack}>
                <ListBlock
                  title={t('applicationAnalysis.fairness.notes')}
                  items={analysis.fairnessDisclosure.notes}
                  compact
                />
                <ListBlock
                  title={t('applicationAnalysis.fairness.appliesTo')}
                  items={analysis.fairnessDisclosure.appliesTo}
                  compact
                />
              </View>
              {analysis.meta?.exposureId ? (
                <FeedbackBlock exposureId={analysis.meta.exposureId} capability="FAIRNESS" />
              ) : null}
            </CardContent>
          </Card>
        </Section>
      ) : null}

      <Section title={t('applicationAnalysis.actionPlan.title')}>
        <View style={styles.columnStack}>
          <ListBlock
            title={t('applicationAnalysis.actionPlan.now')}
            items={analysis.actionPlan?.now ?? []}
          />
          <ListBlock
            title={t('applicationAnalysis.actionPlan.next90Days')}
            items={analysis.actionPlan?.next90Days ?? []}
          />
          <ListBlock
            title={t('applicationAnalysis.actionPlan.beforeSubmission')}
            items={analysis.actionPlan?.beforeSubmission ?? []}
          />
        </View>
      </Section>

      <Section title={t('applicationAnalysis.recommendations.title')}>
        <View style={styles.columnStack}>
          <ListBlock
            title={t('applicationAnalysis.recommendations.majors')}
            items={analysis.recommendedPrograms?.majors ?? analysis.suggestions.majors}
          />
          <ListBlock
            title={t('applicationAnalysis.recommendations.competitions')}
            items={analysis.recommendedPrograms?.competitions ?? analysis.suggestions.competitions}
          />
          <ListBlock
            title={t('applicationAnalysis.recommendations.activities')}
            items={analysis.recommendedPrograms?.activities ?? analysis.suggestions.activities}
          />
          <ListBlock
            title={t('applicationAnalysis.recommendations.summerPrograms')}
            items={
              analysis.recommendedPrograms?.summerPrograms ?? analysis.suggestions.summerPrograms
            }
          />
          <ListBlock
            title={t('applicationAnalysis.recommendations.timeline')}
            items={analysis.recommendedPrograms?.timeline ?? analysis.suggestions.timeline}
          />
        </View>
      </Section>
    </ScrollView>
  );
}

function FocusSchoolCard({
  analysis,
  school,
}: {
  analysis: AIAnalysisResult;
  school: TargetSchoolInsight;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const probability =
    school.predictionSnapshot?.probability != null
      ? `${Math.round(school.predictionSnapshot.probability * 100)}%`
      : t('applicationAnalysis.schoolCards.probabilityUnavailable');

  return (
    <Card style={styles.schoolCard}>
      <CardContent>
        <View style={styles.schoolHeader}>
          <View style={styles.schoolTitleBlock}>
            <Text style={[styles.schoolName, { color: colors.foreground }]}>
              {school.schoolName}
            </Text>
            <View style={styles.badgeWrap}>
              <Badge variant="outline">{t(`applicationAnalysis.schoolTier.${school.tier}`)}</Badge>
              {school.round ? <Badge variant="secondary">{school.round}</Badge> : null}
              {school.policyContext ? (
                <>
                  <Badge variant={getPolicyBadgeVariant(school.policyContext.testingPolicy)}>
                    {t(`applicationAnalysis.policy.testing.${school.policyContext.testingPolicy}`)}
                  </Badge>
                  <Badge variant="secondary">
                    {t(`applicationAnalysis.policy.intlAid.${school.policyContext.intlAidPolicy}`)}
                  </Badge>
                </>
              ) : null}
            </View>
          </View>
          <Text style={[styles.schoolRate, { color: colors.primary }]}>{probability}</Text>
        </View>

        <View style={styles.metaRow}>
          {school.predictionSnapshot?.confidence ? (
            <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
              {t('applicationAnalysis.schoolCards.confidence')}:{' '}
              {t(`applicationAnalysis.confidence.${school.predictionSnapshot.confidence}`)}
            </Text>
          ) : null}
          {school.predictionSnapshot?.updatedAt ? (
            <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
              {t('applicationAnalysis.schoolCards.updated')}:{' '}
              {formatDate(school.predictionSnapshot.updatedAt)}
            </Text>
          ) : null}
        </View>

        {school.predictionSnapshot?.confidenceReason ? (
          <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
            {school.predictionSnapshot.confidenceReason}
          </Text>
        ) : null}

        <View style={styles.columnStack}>
          <ListBlock
            title={t('applicationAnalysis.schoolCards.whyHard')}
            items={school.whyThisIsHard}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.strengths')}
            items={school.compensatingStrengths}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.gaps')}
            items={school.topGaps}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.nextActions')}
            items={school.nextActions}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.historical')}
            items={school.historicalSignals}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.hardStops')}
            items={school.hardStopRisks ?? []}
            compact
          />
          {school.recourseGuidance ? (
            <View style={styles.columnStack}>
              <ListBlock
                title={t('applicationAnalysis.schoolCards.recourse')}
                items={[
                  school.recourseGuidance.goal,
                  ...school.recourseGuidance.recommendedChanges.map(
                    (item) => `${item.action}: ${item.rationale}`
                  ),
                  ...school.recourseGuidance.constraints,
                  school.recourseGuidance.whyNotGuaranteed,
                ]}
                compact
              />
              {analysis.meta?.exposureId ? (
                <FeedbackBlock
                  exposureId={analysis.meta.exposureId}
                  capability="RECOURSE"
                  schoolId={school.schoolId}
                />
              ) : null}
            </View>
          ) : null}
          {school.strategyUncertainty ? (
            <View style={styles.columnStack}>
              <ListBlock
                title={t('applicationAnalysis.schoolCards.uncertainty')}
                items={[
                  `${t('applicationAnalysis.schoolCards.uncertaintyRange')}: ${
                    school.strategyUncertainty.probabilityLow != null
                      ? `${Math.round(school.strategyUncertainty.probabilityLow * 100)}%`
                      : '—'
                  } - ${
                    school.strategyUncertainty.probabilityHigh != null
                      ? `${Math.round(school.strategyUncertainty.probabilityHigh * 100)}%`
                      : '—'
                  }`,
                  ...school.strategyUncertainty.reasons,
                ]}
                compact
              />
              {analysis.meta?.exposureId ? (
                <FeedbackBlock
                  exposureId={analysis.meta.exposureId}
                  capability="UNCERTAINTY"
                  schoolId={school.schoolId}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </CardContent>
    </Card>
  );
}

const FEEDBACK_CATEGORY_KEYS: Record<
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisFeedbackCategory[]
> = {
  RECOURSE: ['UNSAFE_RECOURSE', 'POLICY_MISMATCH', 'LOW_ACTIONABILITY'],
  UNCERTAINTY: ['MISLEADING_UNCERTAINTY', 'POLICY_MISMATCH', 'LOW_ACTIONABILITY'],
  FAIRNESS: ['FAIRNESS_CONCERN', 'POLICY_MISMATCH', 'LOW_ACTIONABILITY'],
};

function FeedbackBlock({
  exposureId,
  capability,
  schoolId,
}: {
  exposureId: string;
  capability: ApplicationAnalysisExperimentCapability;
  schoolId?: string;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [submitted, setSubmitted] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const mutation = useMutation({
    mutationFn: (payload: SubmitApplicationAnalysisFeedbackInput) =>
      aiService.profileAnalysisFeedback(payload),
    onSuccess: () => {
      setSubmitted(true);
      setShowReasons(false);
    },
  });

  if (submitted) {
    return (
      <View
        style={[
          styles.feedbackBox,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.feedback.submitted')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.feedbackBox,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <Text style={[styles.listTitle, { color: colors.foreground }]}>
        {t('applicationAnalysis.feedback.title')}
      </Text>
      <View style={styles.feedbackButtonRow}>
        <Button
          size="sm"
          variant="outline"
          onPress={() =>
            mutation.mutate({
              exposureId,
              capability,
              schoolId,
              sentiment: 'HELPFUL',
            })
          }
        >
          {t('applicationAnalysis.feedback.helpful')}
        </Button>
        <Button size="sm" variant="outline" onPress={() => setShowReasons((value) => !value)}>
          {t('applicationAnalysis.feedback.notHelpful')}
        </Button>
      </View>
      {showReasons ? (
        <View style={styles.feedbackReasonWrap}>
          <Text style={[styles.infoLabel, { color: colors.foregroundMuted }]}>
            {t('applicationAnalysis.feedback.chooseReason')}
          </Text>
          <View style={styles.badgeWrap}>
            {FEEDBACK_CATEGORY_KEYS[capability].map((category) => (
              <Button
                key={category}
                size="sm"
                variant="secondary"
                onPress={() =>
                  mutation.mutate({
                    exposureId,
                    capability,
                    schoolId,
                    sentiment: 'NOT_HELPFUL',
                    category,
                  })
                }
              >
                {t(`applicationAnalysis.feedback.categories.${category}`)}
              </Button>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>{title}</Text>
      <View style={styles.columnStack}>{children}</View>
    </View>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.infoCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.metricBlock}>
      <Text style={[styles.metricLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  const colors = useColors();
  if (!items.length) return null;

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listRow}>
          <Text style={[styles.bullet, { color: colors.foregroundMuted }]}>•</Text>
          <Text style={[styles.listText, { color: colors.foreground }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ListBlock({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View
      style={[
        styles.listBlock,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.listTitle, { color: colors.foreground }]}>{title}</Text>
      {items.length ? (
        <View style={[styles.list, compact && styles.listCompact]}>
          {items.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.listRow}>
              <Text style={[styles.bullet, { color: colors.foregroundMuted }]}>•</Text>
              <Text style={[styles.listText, { color: colors.foreground }]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.emptyList')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingVertical: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryTitleBlock: {
    flex: 1,
  },
  summarySubtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  summaryVerdict: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  summaryBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  metricRow: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
  },
  metricLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  columnStack: {
    gap: spacing.md,
  },
  infoGrid: {
    gap: spacing.md,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  helperText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  sectionBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  schoolCard: {
    marginBottom: spacing.md,
  },
  schoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  schoolTitleBlock: {
    flex: 1,
    gap: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  schoolRate: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metaText: {
    fontSize: fontSize.xs,
  },
  listBlock: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  feedbackBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  feedbackButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  feedbackReasonWrap: {
    gap: spacing.sm,
  },
  listTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  listCompact: {
    gap: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  listText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
