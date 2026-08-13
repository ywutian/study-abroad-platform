import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Loading,
} from '@/components/ui';
import { aiService } from '@/lib/api/services/ai';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import { useColors, withOpacity } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import type { AIAnalysisResult, AnalysisContextFlag, AnalysisState } from '@study-abroad/shared';
import { normalizeApplicationAnalysis } from '@study-abroad/shared';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  BulletList,
  FocusSchoolCard,
  InfoCard,
  ListBlock,
  MetricBlock,
  Section,
} from './ProfileAnalysisCards';
import { styles } from './ProfileAnalysisScreen.styles';

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
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: qk.profile.aiAnalysis(),
    queryFn: () => aiService.profileAnalysis(),
    enabled: isAuthenticated,
    // Application analysis is an expensive server-side fan-out. Avoid stacking
    // React Query retries on top of the transport timeout; the error UI exposes
    // an explicit user-controlled retry instead.
    retry: false,
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
        <Text style={[styles.loadingDescription, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.loading.description')}
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          description={t('applicationAnalysis.error.description')}
          onRetry={() => void refetch()}
        />
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
  const normalized = normalizeApplicationAnalysis(analysis);

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
            <Badge variant={getFreshnessVariant(normalized.freshnessSummary.status)}>
              {t(`applicationAnalysis.freshness.${normalized.freshnessSummary.status}`)}
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
            {normalized.overallVerdict}
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
              value={String(normalized.schoolCards.length)}
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
            <BulletList items={normalized.topReasons} />
            {normalized.topRisks.length ? (
              <ListBlock
                title={t('applicationAnalysis.riskBoundaries')}
                items={normalized.topRisks}
                compact
              />
            ) : null}
          </CardContent>
        </Card>
      </Section>

      <Section title={t('applicationAnalysis.focusSchools')}>
        {normalized.schoolCards.length ? (
          normalized.schoolCards.map((school) => (
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
            items={normalized.nextActions}
          />
        </View>
      </Section>

      <Section title={t('applicationAnalysis.evidenceSummary')}>
        <Card>
          <CardContent>
            {normalized.evidenceSummary.length ? (
              normalized.evidenceSummary.map((item) => (
                <View
                  key={`${item.type}-${item.label}-${item.schoolId ?? ''}`}
                  style={styles.evidenceItem}
                >
                  <Text style={[styles.evidenceLabel, { color: colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
                    {item.detail}
                  </Text>
                  {!!item.sourceName && (
                    <Text style={[styles.sourceText, { color: colors.primary }]}>
                      {item.sourceName}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
                {stateCopy.description}
              </Text>
            )}
          </CardContent>
        </Card>
      </Section>

      <Section title={t('applicationAnalysis.confidenceSummary')}>
        <View style={styles.infoGrid}>
          <InfoCard
            label={t('applicationAnalysis.confidenceSummary')}
            value={`${normalized.confidenceSummary.level}: ${normalized.confidenceSummary.summary}`}
          />
          <InfoCard
            label={t('applicationAnalysis.freshnessSummary')}
            value={
              [
                normalized.freshnessSummary.summary,
                formatDate(normalized.freshnessSummary.generatedAt),
              ]
                .filter(Boolean)
                .join(' · ') || stateCopy.description
            }
          />
        </View>
        <BulletList items={normalized.confidenceSummary.signals} />
      </Section>

      {analysis.unknowns.length ? (
        <Section title={t('applicationAnalysis.unknowns')}>
          <ListBlock title={t('applicationAnalysis.unknowns')} items={analysis.unknowns} />
        </Section>
      ) : null}
    </ScrollView>
  );
}
