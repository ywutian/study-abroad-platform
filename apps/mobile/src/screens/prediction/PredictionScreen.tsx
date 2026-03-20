/**
 * 录取预测页面
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
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
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';

interface PredictionResultItem {
  schoolId: string;
  schoolName: string;
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  tier: 'reach' | 'match' | 'safety';
  factors: Array<{ name: string; impact: string; detail: string }>;
  suggestions: string[];
  schoolMeta?: { acceptanceRate?: number };
}

interface DashboardResponse {
  totalSchools: number;
  avgProbability: number;
  predictions: Array<{
    schoolId: string;
    school: { name: string; nameZh?: string };
    probability: number;
    tier: 'reach' | 'match' | 'safety';
    confidence: 'low' | 'medium' | 'high';
  }>;
}

function mapDashboardToPredictions(
  dashboard: DashboardResponse | undefined
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
  }));
}

type AdmissionResult = 'admitted' | 'rejected' | 'waitlisted' | 'deferred';

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
  const [reportResult, setReportResult] = useState<AdmissionResult>('admitted');

  const reportMutation = useMutation({
    mutationFn: (data: { schoolId: string; result: AdmissionResult }) =>
      apiClient.post('/predictions/report-result', data),
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
    setReportResult('admitted');
    setReportModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // 获取用户档案完整度
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<{ completeness?: number }>('/profile'),
    enabled: isAuthenticated,
  });

  // 获取预测仪表盘数据
  const {
    data: dashboardData,
    isLoading: predictionsLoading,
    refetch,
  } = useQuery({
    queryKey: ['predictions', 'dashboard'],
    queryFn: () => apiClient.get<DashboardResponse>('/predictions/dashboard'),
    enabled: isAuthenticated,
  });

  const predictions = mapDashboardToPredictions(dashboardData);

  // 运行预测
  const predictMutation = useMutation({
    mutationFn: (schoolIds: string[]) => apiClient.post('/predictions', { schoolIds }),
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
              <Text style={styles.progressValue}>{profile?.completeness || 0}%</Text>
            </View>
            <Progress
              value={profile?.completeness || 0}
              max={100}
              style={styles.progressBar}
              color="#fff"
              trackColor="rgba(255,255,255,0.3)"
            />
            {(profile?.completeness || 0) < 80 && (
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

      {/* Predictions List */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {t('prediction.results')}
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
                              : 'error'
                        }
                      >
                        {getRecommendationLabel(prediction.tier)}
                      </Badge>
                    </View>
                    <View style={styles.rateContainer}>
                      <AnimatedCounter
                        value={Math.round(prediction.probability * 100)}
                        suffix="%"
                        style={[styles.rate, { color: getRecommendationColor(prediction.tier) }]}
                      />
                      <Text style={[styles.rateLabel, { color: colors.foregroundMuted }]}>
                        {t('prediction.probability')}
                      </Text>
                    </View>
                  </View>

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
                      {t('prediction.confidence', { value: prediction.confidence })}
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
          {(['admitted', 'rejected', 'waitlisted', 'deferred'] as AdmissionResult[]).map(
            (result) => {
              const isSelected = reportResult === result;
              const resultColors: Record<AdmissionResult, string> = {
                admitted: colors.success,
                rejected: colors.error,
                waitlisted: colors.warning,
                deferred: colors.info,
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
                    {t(`prediction.results.${result}`)}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
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
