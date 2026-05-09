/**
 * 录取预测页面
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  AnimatedCounter,
  Progress,
  Modal,
  Segment,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, withOpacity, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import {
  API_ROUTES,
  detectInternationalStatus,
  formatPercentValue,
  predictionRoutes,
  profileRoutes,
  resolveContextualBaseline,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { aiService } from '@/lib/api/services/ai';
import { useAuthStore } from '@/stores';

interface PredictionResultItem {
  schoolId: string;
  schoolName: string;
  probability: number | null;
  confidence: 'low' | 'medium' | 'high';
  tier: 'reach' | 'match' | 'safety' | 'unavailable';
  factors: Array<{ name: string; impact: string; detail: string }>;
  suggestions: string[];
  schoolMeta?: {
    acceptanceRate?: number | null;
    intlAcceptanceRate?: number | null;
    needBlindInternational?: boolean;
  };
  roundContext?: string | null;
  contextualBaseline?: ReturnType<typeof resolveContextualBaseline>;
  confidenceReason?: string;
  sourceSummary?: Array<{ label: string; detail?: string }>;
  uncertaintyReasons?: string[];
  updatedAt?: string;
}

interface DashboardResponse {
  totalSchools: number;
  avgProbability: number;
  predictions: Array<{
    schoolId: string;
    school: {
      name: string;
      nameZh?: string;
      acceptanceRate?: number | null;
      intlAcceptanceRate?: number | null;
      needBlindInternational?: boolean;
    } | null;
    probability: number | null;
    tier: 'reach' | 'match' | 'safety' | 'unavailable';
    confidence: 'low' | 'medium' | 'high';
    roundContext?: string | null;
    confidenceReason?: string;
    sourceSummary?: Array<{ label: string; detail?: string }>;
    uncertaintyReasons?: string[];
    updatedAt?: string;
  }>;
}

export function mapDashboardToPredictions(
  dashboard: DashboardResponse | undefined,
  isInternational: boolean
): PredictionResultItem[] {
  if (!dashboard?.predictions) return [];
  return dashboard.predictions.map((p) => ({
    schoolId: p.schoolId,
    schoolName: p.school?.name || p.schoolId,
    probability: p.probability,
    confidence: p.confidence || 'medium',
    tier: p.tier,
    factors: [],
    suggestions: [],
    schoolMeta: p.school
      ? {
          acceptanceRate: p.school.acceptanceRate,
          intlAcceptanceRate: p.school.intlAcceptanceRate,
          needBlindInternational: p.school.needBlindInternational || undefined,
        }
      : undefined,
    roundContext: p.roundContext,
    contextualBaseline:
      p.probability == null
        ? null
        : resolveContextualBaseline({
            schoolMeta: p.school,
            isInternational,
            roundContext: p.roundContext,
            probability: p.probability,
          }),
    confidenceReason: p.confidenceReason,
    sourceSummary: p.sourceSummary,
    uncertaintyReasons: p.uncertaintyReasons,
    updatedAt: p.updatedAt,
  }));
}

type AdmissionResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | 'WITHDRAWN';

interface PredictionProfileSummary {
  nationality?: string | null;
  countryOfResidence?: string | null;
  citizenship?: string | null;
  educationSystem?: string | null;
  currentSchoolType?: string | null;
}

interface PredictionProfileCompleteness {
  score: number;
}

function getTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function PredictionScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Report result state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportSchoolId, setReportSchoolId] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<AdmissionResult>('ADMITTED');

  const reportMutation = useMutation({
    mutationFn: (data: { schoolId: string; result: AdmissionResult }) =>
      apiClient.patch(predictionRoutes.result(data.schoolId), {
        result: data.result,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      setReportModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('prediction.resultReported') });
    },
    onError: () => {
      toast.show({ type: 'error', message: t('prediction.reportFailed') });
    },
  });

  const openReportModal = (schoolId: string) => {
    setReportSchoolId(schoolId);
    setReportResult('ADMITTED');
    setReportModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // 获取用户档案完整度
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<PredictionProfileSummary>(profileRoutes.me()),
    enabled: isAuthenticated,
  });

  const { data: profileCompleteness } = useQuery({
    queryKey: ['profile', 'completeness'],
    queryFn: () =>
      apiClient.get<PredictionProfileCompleteness>(`${profileRoutes.me()}/completeness`),
    enabled: isAuthenticated,
  });

  // 获取预测仪表盘数据
  const {
    data: dashboardData,
    isLoading: predictionsLoading,
    refetch,
  } = useQuery({
    queryKey: ['predictions', 'dashboard'],
    queryFn: () => apiClient.get<DashboardResponse>(`${API_ROUTES.PREDICTIONS}/dashboard`),
    enabled: isAuthenticated,
  });

  const { data: applicationAnalysis } = useQuery({
    queryKey: ['profile-ai-analysis'],
    queryFn: () => aiService.profileAnalysis(),
    enabled: isAuthenticated,
  });

  const intlContext = detectInternationalStatus(profile ?? {});
  const predictions = mapDashboardToPredictions(dashboardData, intlContext.isInternational);

  // 运行预测
  const predictMutation = useMutation({
    mutationFn: (schoolIds: string[]) => apiClient.post(API_ROUTES.PREDICTIONS, { schoolIds }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'reach':
        return colors.error;
      case 'match':
        return colors.warning;
      case 'safety':
        return colors.success;
      default:
        return colors.foregroundMuted;
    }
  };

  const getRecommendationLabel = (rec: string) => {
    switch (rec) {
      case 'reach':
        return t('prediction.recommendation.reach');
      case 'match':
        return t('prediction.recommendation.match');
      case 'safety':
        return t('prediction.recommendation.safety');
      case 'unavailable':
        return 'Unavailable';
      default:
        return rec;
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title={t('prediction.empty.loginRequired')}
          description={t('prediction.empty.loginRequiredDesc')}
          action={{
            label: t('prediction.empty.goLogin'),
            onPress: () => {},
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Card */}
      <Animated.View entering={FadeInDown.duration(400).springify()}>
        <LinearGradient
          colors={[colors.primary, colors.primary + 'dd']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="analytics" size={32} color="#fff" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{t('prediction.title')}</Text>
              <Text style={styles.headerSubtitle}>{t('prediction.subtitle')}</Text>
            </View>
          </View>

          {/* Profile Completeness */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{t('prediction.profileCompleteness')}</Text>
              <Text style={styles.progressValue}>{profileCompleteness?.score || 0}%</Text>
            </View>
            <Progress
              value={profileCompleteness?.score || 0}
              max={100}
              style={styles.progressBar}
              color="#fff"
              trackColor="rgba(255,255,255,0.3)"
            />
            {(profileCompleteness?.score || 0) < 80 && (
              <Text style={styles.progressHint}>{t('prediction.completeProfileHint')}</Text>
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Stats */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400).springify()}
        style={styles.statsContainer}
      >
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="school-outline" size={24} color={colors.primary} />
          <AnimatedCounter
            value={predictions.length}
            style={[styles.statValue, { color: colors.foreground }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            {t('prediction.stats.predicted')}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="trending-up-outline" size={24} color={colors.success} />
          <AnimatedCounter
            value={predictions.filter((p) => p.tier === 'safety').length}
            style={[styles.statValue, { color: colors.foreground }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            {t('prediction.stats.safety')}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="rocket-outline" size={24} color={colors.error} />
          <AnimatedCounter
            value={predictions.filter((p) => p.tier === 'reach').length}
            style={[styles.statValue, { color: colors.foreground }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            {t('prediction.stats.reach')}
          </Text>
        </View>
      </Animated.View>

      <View
        style={[
          styles.explanationCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.explanationText, { color: colors.foregroundMuted }]}>
          {t('prediction.probabilityVsRateDisclaimer')}
        </Text>
        <Text style={[styles.explanationText, { color: colors.foregroundMuted }]}>
          {t('prediction.confidenceDisclaimer')}
        </Text>
        <Text style={[styles.explanationText, { color: colors.foregroundMuted }]}>
          {t('prediction.tierDisclaimer')}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => router.push('/profile/analysis' as Href)}
        activeOpacity={0.85}
        style={[
          styles.analysisCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.analysisCardHeader}>
          <View style={styles.analysisCardTitleBlock}>
            <Text style={[styles.analysisCardTitle, { color: colors.foreground }]}>
              {t('applicationAnalysis.title')}
            </Text>
            <Text style={[styles.analysisCardSubtitle, { color: colors.foregroundMuted }]}>
              {t('prediction.analysisCard.subtitle')}
            </Text>
          </View>
          <Badge
            variant={
              applicationAnalysis?.status === 'degraded'
                ? 'error'
                : applicationAnalysis?.status === 'cached'
                  ? 'secondary'
                  : 'success'
            }
          >
            {applicationAnalysis
              ? t(`applicationAnalysis.freshness.${applicationAnalysis.status ?? 'fresh'}`)
              : t('prediction.analysisCard.open')}
          </Badge>
        </View>

        {applicationAnalysis ? (
          <>
            <View style={styles.analysisCardBadges}>
              <Badge variant="outline">
                {t(
                  `applicationAnalysis.states.${applicationAnalysis.meta?.state ?? 'ready'}.label`
                )}
              </Badge>
              <Badge variant="secondary">
                {t(
                  `applicationAnalysis.dataQuality.${applicationAnalysis.meta?.dataQuality ?? 'insufficient'}`
                )}
              </Badge>
            </View>
            <Text style={[styles.analysisCardVerdict, { color: colors.foreground }]}>
              {applicationAnalysis.portfolioSummary.verdict}
            </Text>
            {applicationAnalysis.meta?.degradedReason ? (
              <Text style={[styles.analysisCardBody, { color: colors.foregroundMuted }]}>
                {applicationAnalysis.meta.degradedReason}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[styles.analysisCardBody, { color: colors.foregroundMuted }]}>
            {t('prediction.analysisCard.description')}
          </Text>
        )}

        <View style={styles.analysisCardFooter}>
          <Text style={[styles.analysisCardLink, { color: colors.primary }]}>
            {t('prediction.analysisCard.open')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Predictions List */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {t('prediction.resultsTitle')}
        </Text>

        {predictionsLoading ? (
          <Loading />
        ) : predictions.length ? (
          predictions.map((prediction, index) => (
            <Animated.View
              key={prediction.schoolId}
              entering={FadeInUp.delay(300 + index * 100).springify()}
            >
              <AnimatedCard style={styles.predictionCard}>
                <CardContent>
                  <View style={styles.predictionHeader}>
                    <View style={styles.predictionInfo}>
                      <Text style={[styles.schoolName, { color: colors.foreground }]}>
                        {prediction.schoolName}
                      </Text>
                      <Badge
                        variant={
                          prediction.tier === 'safety'
                            ? 'success'
                            : prediction.tier === 'match'
                              ? 'warning'
                              : prediction.tier === 'reach'
                                ? 'error'
                                : 'secondary'
                        }
                      >
                        {getRecommendationLabel(prediction.tier)}
                      </Badge>
                    </View>
                    <View style={styles.rateContainer}>
                      {prediction.probability == null ? (
                        <Text
                          style={[styles.rate, { color: getRecommendationColor(prediction.tier) }]}
                        >
                          --
                        </Text>
                      ) : (
                        <AnimatedCounter
                          value={Math.round(prediction.probability * 100)}
                          suffix="%"
                          style={[styles.rate, { color: getRecommendationColor(prediction.tier) }]}
                        />
                      )}
                      <Text style={[styles.rateLabel, { color: colors.foregroundMuted }]}>
                        {prediction.probability == null
                          ? 'Not enough data'
                          : t('prediction.probability')}
                      </Text>
                      {prediction.contextualBaseline && (
                        <>
                          <Text style={[styles.benchmarkLabel, { color: colors.foregroundMuted }]}>
                            {t(
                              prediction.contextualBaseline.roundAdjusted
                                ? 'prediction.contextualBaselineWithRound'
                                : 'prediction.contextualBaseline',
                              {
                                round: prediction.contextualBaseline.roundContext,
                                value: formatPercentValue(prediction.contextualBaseline.rate),
                              }
                            )}
                          </Text>
                          <Text
                            style={[
                              styles.benchmarkDelta,
                              {
                                color:
                                  prediction.contextualBaseline.deltaPoints > 2
                                    ? colors.success
                                    : prediction.contextualBaseline.deltaPoints < -2
                                      ? colors.error
                                      : colors.foregroundMuted,
                              },
                            ]}
                          >
                            {prediction.contextualBaseline.deltaPoints > 2
                              ? t('prediction.deltaAbove', {
                                  points: formatPercentValue(
                                    prediction.contextualBaseline.deltaPoints
                                  ),
                                })
                              : prediction.contextualBaseline.deltaPoints < -2
                                ? t('prediction.deltaBelow', {
                                    points: formatPercentValue(
                                      Math.abs(prediction.contextualBaseline.deltaPoints)
                                    ),
                                  })
                                : t('prediction.deltaNear')}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {prediction.contextualBaseline && (
                    <View style={styles.benchmarkBadges}>
                      <Badge variant="secondary">
                        {prediction.contextualBaseline.baseType === 'international'
                          ? t('prediction.baselineInternational')
                          : t('prediction.baselineOverall')}
                      </Badge>
                      {prediction.contextualBaseline.roundAdjusted && (
                        <Badge variant="secondary">
                          {t('prediction.roundAdjusted', {
                            round: prediction.contextualBaseline.roundContext,
                          })}
                        </Badge>
                      )}
                      {prediction.schoolMeta?.needBlindInternational && (
                        <Badge variant="success">{t('prediction.needBlind')}</Badge>
                      )}
                    </View>
                  )}

                  {(prediction.confidenceReason ||
                    prediction.sourceSummary?.length ||
                    prediction.uncertaintyReasons?.length ||
                    prediction.updatedAt) && (
                    <View
                      style={[
                        styles.insightPanel,
                        {
                          backgroundColor: withOpacity(colors.primary, 0.05),
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {prediction.confidenceReason && (
                        <>
                          <Text style={[styles.insightTitle, { color: colors.foreground }]}>
                            {t('prediction.whyThisEstimate')}
                          </Text>
                          <Text style={[styles.insightBody, { color: colors.foregroundMuted }]}>
                            {prediction.confidenceReason}
                          </Text>
                        </>
                      )}

                      {prediction.sourceSummary?.length ? (
                        <View style={styles.signalBadges}>
                          {prediction.sourceSummary.slice(0, 3).map((item, i) => (
                            <Badge key={`${prediction.schoolId}-signal-${i}`} variant="outline">
                              {item.label}
                            </Badge>
                          ))}
                        </View>
                      ) : null}

                      {prediction.uncertaintyReasons?.length ? (
                        <Text style={[styles.uncertaintyText, { color: colors.foregroundMuted }]}>
                          {t('prediction.uncertaintyHint', {
                            reason: prediction.uncertaintyReasons[0],
                          })}
                        </Text>
                      ) : null}

                      {prediction.updatedAt ? (
                        <Text style={[styles.updatedText, { color: colors.foregroundMuted }]}>
                          {t('prediction.lastUpdated', {
                            value: getTimeAgo(prediction.updatedAt),
                          })}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Factor Summary */}
                  {prediction.factors.length > 0 && (
                    <View style={styles.factors}>
                      {prediction.factors.slice(0, 4).map((factor, i) => (
                        <View key={i} style={styles.factorRow}>
                          <Text
                            style={[styles.factorLabel, { color: colors.foregroundMuted }]}
                            numberOfLines={1}
                          >
                            {factor.name}
                          </Text>
                          <Text
                            style={[
                              styles.factorValue,
                              {
                                color:
                                  factor.impact === 'positive'
                                    ? colors.success
                                    : factor.impact === 'negative'
                                      ? colors.error
                                      : colors.foregroundMuted,
                              },
                            ]}
                          >
                            {factor.impact === 'positive'
                              ? '↑'
                              : factor.impact === 'negative'
                                ? '↓'
                                : '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={[styles.confidence, { color: colors.foregroundMuted }]}>
                      {t('prediction.confidence', {
                        value: t(`prediction.${prediction.confidence}`),
                      })}
                    </Text>
                    <TouchableOpacity
                      onPress={() => openReportModal(prediction.schoolId)}
                      style={[
                        styles.reportButton,
                        { backgroundColor: withOpacity(colors.primary, 0.1) },
                      ]}
                    >
                      <Ionicons name="flag-outline" size={14} color={colors.primary} />
                      <Text style={[styles.reportButtonText, { color: colors.primary }]}>
                        {t('prediction.reportResult')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </CardContent>
              </AnimatedCard>
            </Animated.View>
          ))
        ) : (
          <EmptyState
            icon="analytics-outline"
            title={t('prediction.empty.title')}
            description={t('prediction.empty.description')}
            action={{
              label: t('prediction.empty.addSchool'),
              onPress: () => {},
            }}
          />
        )}
      </View>

      {/* Add Prediction Button */}
      <View style={styles.addButtonContainer}>
        <AnimatedButton
          onPress={() => {}}
          style={styles.addButton}
          leftIcon={<Ionicons name="add-circle-outline" size={20} color="#fff" />}
        >
          {t('prediction.addPrediction')}
        </AnimatedButton>
      </View>

      {/* Report Result Modal */}
      <Modal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        title={t('prediction.reportActualResult')}
      >
        <View style={styles.reportContent}>
          <Text style={[styles.reportLabel, { color: colors.foreground }]}>
            {t('prediction.selectResult')}
          </Text>
          {(
            ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED', 'WITHDRAWN'] as AdmissionResult[]
          ).map((result) => {
            const isSelected = reportResult === result;
            const resultColors: Record<AdmissionResult, string> = {
              ADMITTED: colors.success,
              REJECTED: colors.error,
              WAITLISTED: colors.warning,
              DEFERRED: colors.info,
              WITHDRAWN: colors.foregroundMuted,
            };
            return (
              <TouchableOpacity
                key={result}
                onPress={() => setReportResult(result)}
                style={[
                  styles.resultOption,
                  { borderColor: isSelected ? resultColors[result] : colors.border },
                  isSelected && { backgroundColor: withOpacity(resultColors[result], 0.1) },
                ]}
              >
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={isSelected ? resultColors[result] : colors.foregroundMuted}
                />
                <Text
                  style={[
                    styles.resultOptionText,
                    { color: isSelected ? resultColors[result] : colors.foreground },
                  ]}
                >
                  {t(`prediction.results.${result.toLowerCase()}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
          <AnimatedButton
            onPress={() => {
              if (reportSchoolId) {
                reportMutation.mutate({ schoolId: reportSchoolId, result: reportResult });
              }
            }}
            loading={reportMutation.isPending}
            style={styles.reportSubmitButton}
          >
            {t('prediction.submitResult')}
          </AnimatedButton>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#fff',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  progressSection: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  progressValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  progressBar: {
    height: 6,
  },
  progressHint: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  explanationCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  analysisCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  analysisCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  analysisCardTitleBlock: {
    flex: 1,
  },
  analysisCardTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  analysisCardSubtitle: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  analysisCardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  analysisCardVerdict: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  analysisCardBody: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
  },
  analysisCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  analysisCardLink: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  explanationText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  predictionCard: {
    marginBottom: spacing.md,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  predictionInfo: {
    flex: 1,
    gap: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  rateContainer: {
    alignItems: 'flex-end',
  },
  rate: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  rateLabel: {
    fontSize: fontSize.xs,
  },
  benchmarkLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  benchmarkDelta: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
    textAlign: 'right',
  },
  benchmarkBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  insightPanel: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  insightTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  insightBody: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  signalBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  uncertaintyText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  updatedText: {
    fontSize: fontSize.xs,
  },
  factors: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  factorLabel: {
    flex: 1,
    fontSize: fontSize.xs,
  },
  factorValue: {
    width: 24,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  confidence: {
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  addButtonContainer: {
    padding: spacing.lg,
  },
  addButton: {
    width: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  reportButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  reportContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  reportLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  resultOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
  },
  resultOptionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  reportSubmitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
