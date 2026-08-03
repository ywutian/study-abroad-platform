/**
 * 录取预测页面
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
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
import {
  useColors,
  withOpacity,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
} from '@/utils/theme';
import {
  AI_REQUEST_TIMEOUT_MS,
  API_ROUTES,
  type AIAnalysisResult,
  type PredictionDashboardData,
  MAX_SCHOOLS_PER_BATCH,
  detectInternationalStatus,
  formatPercentValue,
  predictionRoutes,
  profileRoutes,
} from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import { CaseComparisonPanel } from '@/components/prediction/CaseComparisonPanel';
import { mapDashboardToPredictions } from './prediction-mapper';
export { mapDashboardToPredictions } from './prediction-mapper';

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
  /**
   * Whether the profile is eligible to run an admission prediction
   * (GPA + basic info + ≥1 target school). Returned by
   * `/profiles/me/completeness` — see the shared prediction-eligibility
   * predicate. Optional for backward compatibility with cached responses.
   */
  canRunPrediction?: boolean;
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
  const [reportRound, setReportRound] = useState('RD');
  const [reportIsFinal, setReportIsFinal] = useState(true);
  const [reportNotes, setReportNotes] = useState('');

  const reportMutation = useMutation({
    mutationFn: (data: {
      schoolId: string;
      result: AdmissionResult;
      round?: string;
      isFinal?: boolean;
      notes?: string;
    }) =>
      apiClient.patch(predictionRoutes.result(data.schoolId), {
        result: data.result,
        round: data.round,
        isFinal: data.isFinal,
        notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.predictions.all });
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
    setReportRound('RD');
    setReportIsFinal(true);
    setReportNotes('');
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
    queryKey: qk.predictions.dashboard,
    queryFn: () => apiClient.get<PredictionDashboardData>(`${API_ROUTES.PREDICTIONS}/dashboard`),
    enabled: isAuthenticated,
  });

  const applicationAnalysis = queryClient.getQueryData<AIAnalysisResult>(qk.profile.aiAnalysis());

  const intlContext = detectInternationalStatus(profile ?? {});
  const predictions = mapDashboardToPredictions(dashboardData, intlContext.isInternational);

  // Target school list — predictions can only run on schools the user has added
  // to their list (the backend enforces schoolId ∈ SchoolListItem).
  const { data: schoolListData } = useQuery({
    queryKey: qk.schoolList.all,
    queryFn: () => apiClient.get<{ schoolId: string }[]>(API_ROUTES.SCHOOL_LISTS),
    enabled: isAuthenticated,
  });
  const schoolListIds = useMemo(
    () => (Array.isArray(schoolListData) ? schoolListData : []).map((item) => item.schoolId),
    [schoolListData]
  );

  // 运行预测
  const predictMutation = useMutation({
    mutationFn: (schoolIds: string[]) =>
      apiClient.post(
        API_ROUTES.PREDICTIONS,
        { schoolIds },
        { timeout: AI_REQUEST_TIMEOUT_MS, retries: 0 }
      ),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('errors.unknown'));
    },
  });

  // Mirror the web gate: when the profile is known-ineligible (no GPA / no target
  // school), block the run instead of firing a request the backend will 412 on.
  // Only when canRunPrediction is explicitly false — undefined (loading / old
  // cache) falls through to the backend 412 backstop, exactly like web.
  const profileBlocksPrediction = profileCompleteness?.canRunPrediction === false;

  // "Add prediction": run predictions across the target list, or send the user to
  // build that list first (find-college) when it's still empty. The backend caps a
  // single request at MAX_SCHOOLS_PER_BATCH schools (shared SSOT, @ArrayMaxSize), so
  // predict up to that many and tell the user when their list is even longer —
  // otherwise the whole batch 400s with a raw validator string and nothing runs.
  const handleAddPrediction = useCallback(() => {
    if (predictMutation.isPending) return;
    if (profileBlocksPrediction) {
      toast.info(t('prediction.predictionBlockedHint'));
      return;
    }
    if (schoolListIds.length === 0) {
      router.push('/find-college' as Href);
      return;
    }
    if (schoolListIds.length > MAX_SCHOOLS_PER_BATCH) {
      toast.info(t('prediction.maxSchoolsNotice', { count: MAX_SCHOOLS_PER_BATCH }));
    }
    predictMutation.mutate(schoolListIds.slice(0, MAX_SCHOOLS_PER_BATCH));
  }, [predictMutation, profileBlocksPrediction, schoolListIds, toast, t]);

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
        return t('prediction.tierUnavailable');
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
            onPress: () => router.push('/(auth)/login' as Href),
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
          colors={[colors.primary, withOpacity(colors.primary, 0.866)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.headerContent}>
            <View style={[styles.headerIcon, { backgroundColor: colors.onGradientOverlay }]}>
              <Ionicons name="analytics" size={32} color={colors.onGradient} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.onGradient }]}>
                {t('prediction.title')}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.onGradientMuted }]}>
                {t('prediction.subtitle')}
              </Text>
            </View>
          </View>

          {/* Profile Completeness */}
          <View style={[styles.progressSection, { backgroundColor: colors.onGradientOverlay }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.onGradientMuted }]}>
                {t('prediction.profileCompleteness')}
              </Text>
              <Text
                style={[
                  styles.progressValue,
                  { color: colors.onGradient, fontFamily: fontFamily.mono },
                ]}
              >
                {profileCompleteness?.score || 0}%
              </Text>
            </View>
            <Progress
              value={profileCompleteness?.score || 0}
              max={100}
              style={styles.progressBar}
              color={colors.onGradient}
              trackColor={colors.onGradientOverlay}
            />
            {profileCompleteness?.canRunPrediction === false ? (
              <Text style={[styles.progressHint, { color: colors.onGradientMuted }]}>
                {t('prediction.predictionBlockedHint')}
              </Text>
            ) : (profileCompleteness?.score || 0) < 80 ? (
              <Text style={[styles.progressHint, { color: colors.onGradientMuted }]}>
                {t('prediction.completeProfileHint')}
              </Text>
            ) : null}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Stats */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400).springify()}
        style={styles.statsContainer}
      >
        <View
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="school-outline" size={24} color={colors.primary} />
          <AnimatedCounter
            value={predictions.length}
            style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.mono }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            {t('prediction.stats.predicted')}
          </Text>
        </View>
        <View
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="trending-up-outline" size={24} color={colors.success} />
          <AnimatedCounter
            value={predictions.filter((p) => p.tier === 'safety').length}
            style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.mono }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            {t('prediction.stats.safety')}
          </Text>
        </View>
        <View
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="rocket-outline" size={24} color={colors.error} />
          <AnimatedCounter
            value={predictions.filter((p) => p.tier === 'reach').length}
            style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.mono }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            {t('prediction.stats.reach')}
          </Text>
        </View>
      </Animated.View>

      {/* Only explain the probability/confidence/tier semantics once there are
          real results to explain — don't greet an empty first-run with a wall of
          jargon before the student has seen a single prediction. */}
      {predictions.length > 0 && (
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
      )}

      <TouchableOpacity
        onPress={() => router.push('/profile/analysis' as Href)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('applicationAnalysis.title')}
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
                      <Text
                        style={[
                          styles.tierVerdict,
                          { color: getRecommendationColor(prediction.tier) },
                        ]}
                      >
                        {prediction.probability == null
                          ? t('prediction.tierUnavailable')
                          : getRecommendationLabel(prediction.tier)}
                      </Text>
                      <Text style={[styles.rateLabel, { color: colors.foregroundMuted }]}>
                        {prediction.probability == null
                          ? t('prediction.insufficientDataReason')
                          : t('prediction.tierVerdictLabel')}
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
                          <View style={styles.factorCopy}>
                            <Text
                              style={[styles.factorLabel, { color: colors.foreground }]}
                              numberOfLines={1}
                            >
                              {factor.name}
                            </Text>
                            {!!factor.detail && (
                              <Text
                                style={[styles.factorDetail, { color: colors.foregroundMuted }]}
                                numberOfLines={2}
                              >
                                {factor.detail}
                              </Text>
                            )}
                          </View>
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

                  {prediction.publicExplanation ? (
                    <View
                      style={[
                        styles.explanationBox,
                        { backgroundColor: withOpacity(colors.info, 0.08) },
                      ]}
                    >
                      <Text style={[styles.explanationTitle, { color: colors.foreground }]}>
                        {prediction.publicExplanation.headline}
                      </Text>
                      {prediction.publicExplanation.reasons.map((reason) => (
                        <Text
                          key={reason}
                          style={[styles.explanationText, { color: colors.foregroundMuted }]}
                        >
                          • {reason}
                        </Text>
                      ))}
                      {!!prediction.publicExplanation.nextAction && (
                        <Text style={[styles.explanationText, { color: colors.primary }]}>
                          → {prediction.publicExplanation.nextAction}
                        </Text>
                      )}
                      <Text style={[styles.explanationText, { color: colors.foregroundMuted }]}>
                        {prediction.publicExplanation.dataSupportLabel}
                      </Text>
                      {prediction.publicExplanation.caveats.map((caveat) => (
                        <Text
                          key={caveat}
                          style={[styles.explanationText, { color: colors.warning }]}
                        >
                          ⚠ {caveat}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {prediction.suggestions.length > 0 && (
                    <View style={styles.suggestions}>
                      {prediction.suggestions.map((suggestion) => (
                        <Text
                          key={suggestion}
                          style={[styles.explanationText, { color: colors.foreground }]}
                        >
                          • {suggestion}
                        </Text>
                      ))}
                    </View>
                  )}

                  {!prediction.publicExplanation &&
                    prediction.factors.length === 0 &&
                    prediction.suggestions.length === 0 && (
                      <Text style={[styles.explanationText, { color: colors.foregroundMuted }]}>
                        {t('prediction.detailsUnavailable')}
                      </Text>
                    )}

                  {/* Similar real cases — the panel renders its own header and
                      hides the whole section when there isn't a sufficient sample. */}
                  <CaseComparisonPanel
                    schoolId={prediction.schoolId}
                    title={t('prediction.similarCasesTitle')}
                  />

                  <View style={styles.cardFooter}>
                    <Text style={[styles.confidence, { color: colors.foregroundMuted }]}>
                      {t('prediction.confidence', {
                        value: t(`prediction.${prediction.confidence}`),
                      })}
                    </Text>
                    {prediction.probability != null && prediction.tier !== 'unavailable' ? (
                      <TouchableOpacity
                        onPress={() => openReportModal(prediction.schoolId)}
                        accessibilityRole="button"
                        accessibilityLabel={t('prediction.reportResult')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                    ) : null}
                  </View>
                </CardContent>
              </AnimatedCard>
            </Animated.View>
          ))
        ) : (
          <EmptyState
            icon="analytics-outline"
            title={t('prediction.empty.title')}
            // Distinguish "no schools saved" (send them to add some) from "schools
            // saved but not yet scored" (run the prediction right here) — otherwise
            // the user who already saved schools gets bounced to find-college where
            // their schools already sit, with no idea what to do next.
            description={
              schoolListIds.length > 0
                ? t('prediction.empty.hasSchools', { count: schoolListIds.length })
                : t('prediction.empty.description')
            }
            action={{
              label:
                schoolListIds.length > 0
                  ? t('prediction.empty.runNow')
                  : t('prediction.empty.addSchool'),
              onPress:
                schoolListIds.length > 0
                  ? handleAddPrediction
                  : () => router.push('/find-college' as Href),
            }}
          />
        )}
      </View>

      {/* Add Prediction Button */}
      <View style={styles.addButtonContainer}>
        <AnimatedButton
          onPress={handleAddPrediction}
          loading={predictMutation.isPending}
          disabled={profileBlocksPrediction}
          style={styles.addButton}
          leftIcon={
            <Ionicons name="add-circle-outline" size={20} color={colors.primaryForeground} />
          }
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
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t(`prediction.results.${result.toLowerCase()}`)}
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
          <Text style={[styles.reportLabel, { color: colors.foreground }]}>
            {t('prediction.round')}
          </Text>
          <View style={styles.roundOptions}>
            {['RD', 'EA', 'ED', 'ED2', 'REA', 'SCEA', 'ROLLING'].map((round) => {
              const isSelected = reportRound === round;
              return (
                <TouchableOpacity
                  key={round}
                  onPress={() => setReportRound(round)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={round}
                  style={[
                    styles.roundOption,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? withOpacity(colors.primary, 0.1)
                        : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roundOptionText,
                      { color: isSelected ? colors.primary : colors.foreground },
                    ]}
                  >
                    {round}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.finalRow}>
            <Text style={[styles.resultOptionText, { color: colors.foreground }]}>
              {t('prediction.finalResult')}
            </Text>
            <Switch
              value={reportIsFinal}
              onValueChange={setReportIsFinal}
              accessibilityLabel={t('prediction.finalResult')}
            />
          </View>
          <TextInput
            value={reportNotes}
            onChangeText={setReportNotes}
            placeholder={t('prediction.notesPlaceholder')}
            placeholderTextColor={colors.foregroundMuted}
            multiline
            maxLength={500}
            style={[
              styles.notesInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          />
          <AnimatedButton
            onPress={() => {
              if (reportSchoolId) {
                reportMutation.mutate({
                  schoolId: reportSchoolId,
                  result: reportResult,
                  round: reportRound,
                  isFinal: reportIsFinal,
                  notes: reportNotes.trim() || undefined,
                });
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
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
  },
  progressSection: {
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
  },
  progressValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  progressBar: {
    height: 6,
  },
  progressHint: {
    fontSize: fontSize.xs,
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
    borderWidth: 1,
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
  tierVerdict: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    textAlign: 'right',
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
  explanationBox: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  explanationTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  suggestions: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  factorCopy: { flex: 1 },
  factorDetail: { fontSize: fontSize.xs, marginTop: 2 },
  factorLabel: {
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
  roundOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roundOption: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roundOptionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  notesInput: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    textAlignVertical: 'top',
  },
  reportSubmitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
