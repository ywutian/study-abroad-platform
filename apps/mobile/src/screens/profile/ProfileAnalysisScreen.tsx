import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  AIAnalysisResult,
  AnalysisContextFlag,
  AnalysisState,
  ApplicationAnalysisSchoolResult,
} from '@study-abroad/shared';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Loading,
} from '@/components/ui';
import { aiService } from '@/lib/api/services/ai';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import {
  borderRadius,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  useColors,
  withOpacity,
} from '@/utils/theme';

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
    queryKey: qk.profile.aiAnalysis(),
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
  const stateCopy = getStateCopy(t, state);
  const dataQuality = analysis.meta?.dataQuality ?? 'insufficient';
  const applicantType = analysis.profileSummary.applicantType ?? 'unknown';
  const testStrategy = analysis.profileSummary.testStrategy ?? 'unknown';
  // Mirror web: surface meta.predictionContext (schools whose backing
  // prediction is stale/missing) with a tap-through to re-run on /prediction.
  const predictionContext = analysis.meta?.predictionContext;
  const stalePredictionCount =
    (predictionContext?.staleSchoolIds?.length ?? 0) +
    (predictionContext?.missingSchoolIds?.length ?? 0);

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
            <Badge variant="secondary">{analysis.meta?.analysisVersion}</Badge>
          </View>
          <Text style={[styles.summaryVerdict, { color: colors.foreground }]}>
            {analysis.portfolioSummary.verdict}
          </Text>
          {analysis.meta?.degradedReason ? (
            <Text style={[styles.summaryBody, { color: colors.foregroundMuted }]}>
              {analysis.meta.degradedReason}
            </Text>
          ) : null}
          {stalePredictionCount > 0 ? (
            <TouchableOpacity
              style={[
                styles.staleHint,
                {
                  backgroundColor: withOpacity(colors.warning, 0.12),
                  borderColor: withOpacity(colors.warning, 0.3),
                },
              ]}
              onPress={() => router.push('/prediction' as Href)}
              accessibilityRole="button"
            >
              <Ionicons name="refresh-outline" size={14} color={colors.warning} />
              <Text style={[styles.staleHintText, { color: colors.warning }]}>
                {t('applicationAnalysis.predictionContext.staleHint', {
                  count: stalePredictionCount,
                })}
              </Text>
            </TouchableOpacity>
          ) : null}

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
              label={t('applicationAnalysis.focusSchools')}
              value={String(analysis.schools.length)}
            />
            <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
            <MetricBlock label="Trace" value={analysis.meta.traceId.slice(0, 8)} />
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
        {analysis.profileSummary.intendedMajors.length ? (
          <View style={styles.badgeWrap}>
            {analysis.profileSummary.intendedMajors.map((major) => (
              <Badge key={major} variant="outline">
                {major}
              </Badge>
            ))}
          </View>
        ) : null}
        {analysis.profileSummary.contextFlags.length ? (
          <View style={styles.badgeWrap}>
            {analysis.profileSummary.contextFlags.map((flag) => (
              <Badge key={flag} variant="secondary">
                {t(`applicationAnalysis.contextFlags.${flag as AnalysisContextFlag}`)}
              </Badge>
            ))}
          </View>
        ) : null}
        {analysis.profileSummary.constraints.length ? (
          <ListBlock
            title={t('applicationAnalysis.riskBoundaries')}
            items={analysis.profileSummary.constraints}
            compact
          />
        ) : null}
        {analysis.profileSummary.highSchoolContext ? (
          <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
            {analysis.profileSummary.highSchoolContext}
          </Text>
        ) : null}
      </Section>

      <Section title={t('applicationAnalysis.schoolListDiagnosis')}>
        <Card>
          <CardContent>
            <View style={styles.badgeWrap}>
              <Badge variant="outline">
                {t(`applicationAnalysis.portfolioBalance.${analysis.portfolioSummary.balance}`)}
              </Badge>
              <Badge variant="secondary">{stateCopy.label}</Badge>
            </View>
            <Text style={[styles.sectionBody, { color: colors.foregroundMuted }]}>
              {stateCopy.description}
            </Text>
            <BulletList items={analysis.portfolioSummary.keyReasons} />
            {analysis.portfolioSummary.riskBoundaries.length ? (
              <ListBlock
                title={t('applicationAnalysis.riskBoundaries')}
                items={analysis.portfolioSummary.riskBoundaries}
                compact
              />
            ) : null}
          </CardContent>
        </Card>
      </Section>

      <Section title={t('applicationAnalysis.focusSchools')}>
        {analysis.schools.length ? (
          analysis.schools.map((school) => (
            <FocusSchoolCard key={school.schoolId} school={school} />
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

      <Section title={t('applicationAnalysis.actionPlan.title')}>
        <View style={styles.columnStack}>
          <ListBlock
            title={t('applicationAnalysis.actionPlan.now')}
            items={analysis.actionPlan.now}
          />
          <ListBlock
            title={t('applicationAnalysis.actionPlan.next90Days')}
            items={analysis.actionPlan.next90Days}
          />
          <ListBlock
            title={t('applicationAnalysis.actionPlan.beforeSubmission')}
            items={analysis.actionPlan.beforeSubmission}
          />
        </View>
      </Section>

      {analysis.unknowns.length ? (
        <Section title={t('applicationAnalysis.unknowns')}>
          <ListBlock title={t('applicationAnalysis.unknowns')} items={analysis.unknowns} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

function FocusSchoolCard({ school }: { school: ApplicationAnalysisSchoolResult }) {
  const { t } = useTranslation();
  const colors = useColors();
  const probabilityLabel =
    school.prediction?.probability != null
      ? `${Math.round(school.prediction.probability * 100)}%`
      : t('applicationAnalysis.schoolCards.probabilityUnavailable');

  return (
    <Card>
      <CardContent>
        <View style={styles.schoolHeader}>
          <View style={styles.schoolTitleBlock}>
            <Text style={[styles.schoolTitle, { color: colors.foreground }]}>
              {school.schoolName}
            </Text>
            <View style={styles.badgeWrap}>
              <Badge variant="outline">{t(`applicationAnalysis.schoolTier.${school.tier}`)}</Badge>
              {school.round ? <Badge variant="secondary">{school.round}</Badge> : null}
            </View>
          </View>
          <Badge variant="secondary">{school.policyCard.roundContext}</Badge>
        </View>

        <Text style={[styles.sectionBody, { color: colors.foregroundMuted }]}>
          {school.assessment.summary}
        </Text>
        <View style={styles.badgeWrap}>
          <Badge variant="secondary">
            {t(`applicationAnalysis.policy.testing.${school.policyCard.testingPolicy}`)}
          </Badge>
          <Badge variant="secondary">
            {t(`applicationAnalysis.policy.intlAid.${school.policyCard.intlAidPolicy}`)}
          </Badge>
        </View>
        <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.schoolCards.probability')}:{' '}
          <Text style={[styles.helperNumeric, { color: colors.foreground }]}>
            {probabilityLabel}
          </Text>
          {school.prediction?.confidence
            ? `  •  ${t('applicationAnalysis.schoolCards.confidence')}: ${t(
                `applicationAnalysis.confidence.${school.prediction.confidence}`
              )}`
            : ''}
          {school.prediction?.updatedAt
            ? `  •  ${t('applicationAnalysis.schoolCards.updated')}: ${formatDate(
                school.prediction.updatedAt
              )}`
            : ''}
        </Text>

        <View style={styles.columnStack}>
          <ListBlock
            title={t('applicationAnalysis.schoolCards.whyHard')}
            items={school.assessment.whyThisIsHard}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.strengths')}
            items={school.assessment.compensatingStrengths}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.gaps')}
            items={school.assessment.topGaps}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.nextActions')}
            items={school.assessment.nextActions}
            compact
          />
          {school.assessment.historicalSignals.length > 0 && (
            <ListBlock
              title={t('applicationAnalysis.schoolCards.historical')}
              items={school.assessment.historicalSignals}
              compact
            />
          )}
          <ListBlock
            title={t('applicationAnalysis.schoolCards.hardStops')}
            items={school.assessment.hardStopRisks}
            compact
          />
          {school.recourse ? (
            <ListBlock
              title={t('applicationAnalysis.schoolCards.recourse')}
              items={[
                school.recourse.goal,
                ...school.recourse.recommendedChanges.map(
                  (item) => `${item.action}: ${item.rationale}`
                ),
                ...school.recourse.constraints,
                school.recourse.whyNotGuaranteed,
              ]}
              compact
            />
          ) : null}
          {school.uncertainty ? (
            <ListBlock
              title={t('applicationAnalysis.schoolCards.uncertainty')}
              items={[
                `${t('applicationAnalysis.schoolCards.uncertaintyRange')}: ${
                  school.uncertainty.probabilityLow != null
                    ? `${Math.round(school.uncertainty.probabilityLow * 100)}%`
                    : '—'
                } - ${
                  school.uncertainty.probabilityHigh != null
                    ? `${Math.round(school.uncertainty.probabilityHigh * 100)}%`
                    : '—'
                }`,
                ...school.uncertainty.reasons,
              ]}
              compact
            />
          ) : null}
        </View>
      </CardContent>
    </Card>
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

function ListBlock({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.listCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.listTitle, { color: colors.foreground }]}>{title}</Text>
      {items.length ? (
        items.map((item, index) => (
          <View
            key={`${item}-${index}`}
            style={[styles.listItem, compact && styles.listItemCompact]}
          >
            <Text style={[styles.listBullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.listText, { color: colors.foregroundMuted }]}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.emptyList')}
        </Text>
      )}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  const colors = useColors();
  return (
    <View style={styles.columnStack}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listItem}>
          <Text style={[styles.listBullet, { color: colors.primary }]}>•</Text>
          <Text style={[styles.listText, { color: colors.foregroundMuted }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  summaryCard: { gap: spacing.sm },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryTitleBlock: { flex: 1, gap: spacing.xs },
  summarySubtitle: { fontSize: fontSize.sm },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  summaryVerdict: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  summaryBody: { fontSize: fontSize.sm, lineHeight: 20 },
  staleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  staleHintText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  metricRow: {
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: { flex: 1, gap: spacing.xs },
  metricLabel: { fontSize: fontSize.xs, textTransform: 'uppercase' },
  metricValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  metricDivider: { width: 1, alignSelf: 'stretch', marginHorizontal: spacing.md },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
  },
  infoGrid: { flexDirection: 'row', gap: spacing.sm },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  infoLabel: { fontSize: fontSize.xs, textTransform: 'uppercase' },
  infoValue: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  helperText: { fontSize: fontSize.sm, lineHeight: 20 },
  helperNumeric: { fontFamily: fontFamily.mono, fontWeight: fontWeight.medium },
  sectionBody: { fontSize: fontSize.sm, lineHeight: 20 },
  schoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  schoolTitleBlock: { flex: 1, gap: spacing.xs },
  schoolTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  columnStack: { gap: spacing.sm },
  listCard: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm },
  listTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  listItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  listItemCompact: { gap: spacing.xs },
  listBullet: { fontSize: fontSize.base, lineHeight: 20 },
  listText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
});
