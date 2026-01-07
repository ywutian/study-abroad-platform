/**
 * 录取预测页面
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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
} from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import type { School } from '@/types';

interface PredictionResult {
  schoolId: string;
  schoolName: string;
  admissionRate: number;
  confidence: number;
  factors: {
    gpa: number;
    testScore: number;
    activities: number;
    essays: number;
  };
  recommendation: 'reach' | 'match' | 'safety';
}

export default function PredictionScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStore();
  
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  // 获取用户档案完整度
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/profile'),
    enabled: isAuthenticated,
  });

  // 获取已保存的预测
  const { data: predictions, isLoading: predictionsLoading, refetch } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => apiClient.get<PredictionResult[]>('/predictions'),
    enabled: isAuthenticated,
  });

  // 运行预测
  const predictMutation = useMutation({
    mutationFn: (schoolId: string) => 
      apiClient.post<PredictionResult>('/predictions', { schoolId }),
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
      case 'reach': return colors.error;
      case 'match': return colors.warning;
      case 'safety': return colors.success;
      default: return colors.foregroundMuted;
    }
  };

  const getRecommendationLabel = (rec: string) => {
    switch (rec) {
      case 'reach': return '冲刺';
      case 'match': return '匹配';
      case 'safety': return '保底';
      default: return rec;
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title="请先登录"
          description="登录后即可使用录取预测功能"
          action={{
            label: '去登录',
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
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
              <Text style={styles.headerTitle}>录取预测</Text>
              <Text style={styles.headerSubtitle}>
                基于 AI 算法，预测你的录取概率
              </Text>
            </View>
          </View>

          {/* Profile Completeness */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>档案完整度</Text>
              <Text style={styles.progressValue}>
                {profile?.completeness || 0}%
              </Text>
            </View>
            <Progress
              value={profile?.completeness || 0}
              max={100}
              style={styles.progressBar}
              color="#fff"
              trackColor="rgba(255,255,255,0.3)"
            />
            {(profile?.completeness || 0) < 80 && (
              <Text style={styles.progressHint}>
                完善档案可提高预测准确度
              </Text>
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
            value={predictions?.length || 0}
            style={[styles.statValue, { color: colors.foreground }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            已预测学校
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="trending-up-outline" size={24} color={colors.success} />
          <AnimatedCounter
            value={predictions?.filter(p => p.recommendation === 'safety').length || 0}
            style={[styles.statValue, { color: colors.foreground }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            保底学校
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons name="rocket-outline" size={24} color={colors.error} />
          <AnimatedCounter
            value={predictions?.filter(p => p.recommendation === 'reach').length || 0}
            style={[styles.statValue, { color: colors.foreground }]}
          />
          <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
            冲刺学校
          </Text>
        </View>
      </Animated.View>

      {/* Predictions List */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          预测结果
        </Text>

        {predictionsLoading ? (
          <Loading />
        ) : predictions?.length ? (
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
                        variant={prediction.recommendation === 'safety' ? 'success' : 
                                prediction.recommendation === 'match' ? 'warning' : 'error'}
                      >
                        {getRecommendationLabel(prediction.recommendation)}
                      </Badge>
                    </View>
                    <View style={styles.rateContainer}>
                      <AnimatedCounter
                        value={prediction.admissionRate}
                        suffix="%"
                        style={[styles.rate, { color: getRecommendationColor(prediction.recommendation) }]}
                      />
                      <Text style={[styles.rateLabel, { color: colors.foregroundMuted }]}>
                        录取概率
                      </Text>
                    </View>
                  </View>

                  {/* Factor Breakdown */}
                  <View style={styles.factors}>
                    <FactorBar
                      label="GPA"
                      value={prediction.factors.gpa}
                      color={colors.primary}
                    />
                    <FactorBar
                      label="标化"
                      value={prediction.factors.testScore}
                      color={colors.success}
                    />
                    <FactorBar
                      label="活动"
                      value={prediction.factors.activities}
                      color={colors.warning}
                    />
                    <FactorBar
                      label="文书"
                      value={prediction.factors.essays}
                      color={colors.info}
                    />
                  </View>

                  <Text style={[styles.confidence, { color: colors.foregroundMuted }]}>
                    置信度: {prediction.confidence}%
                  </Text>
                </CardContent>
              </AnimatedCard>
            </Animated.View>
          ))
        ) : (
          <EmptyState
            icon="analytics-outline"
            title="暂无预测结果"
            description="添加学校开始预测"
            action={{
              label: '添加学校',
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
          添加学校预测
        </AnimatedButton>
      </View>
    </ScrollView>
  );
}

// Factor Bar Component
function FactorBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useColors();
  
  return (
    <View style={styles.factorRow}>
      <Text style={[styles.factorLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      <View style={[styles.factorTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.factorFill,
            { width: `${value}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.factorValue, { color: colors.foreground }]}>{value}</Text>
    </View>
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
    width: 32,
    fontSize: fontSize.xs,
  },
  factorTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  factorFill: {
    height: '100%',
    borderRadius: 3,
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
});


