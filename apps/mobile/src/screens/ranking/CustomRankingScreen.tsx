/**
 * 自定义排名页面
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  Input,
  Slider,
  Avatar,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';

interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

interface RankedSchool {
  id: string;
  name: string;
  nameZh?: string;
  logoUrl?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
  tuition?: number;
  avgSalary?: number;
  score: number;
  rank: number;
}

export default function CustomRankingScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [weights, setWeights] = useState<RankingWeights>({
    usNewsRank: 30,
    acceptanceRate: 20,
    tuition: 25,
    avgSalary: 25,
  });

  const [rankingName, setRankingName] = useState('');
  const [showResults, setShowResults] = useState(false);

  // 计算排名
  const {
    data: ranking,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['customRanking', weights],
    queryFn: () => apiClient.post<RankedSchool[]>('/rankings/calculate', weights),
    enabled: false,
  });

  // 保存排名
  const saveMutation = useMutation({
    mutationFn: (data: { name: string; isPublic: boolean } & RankingWeights) =>
      apiClient.post('/rankings', data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('ranking.toast.saved') });
      setRankingName('');
    },
    onError: () => {
      toast.show({ type: 'error', message: t('ranking.toast.saveFailed') });
    },
  });

  const handleCalculate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refetch();
    setShowResults(true);
  };

  const handleSave = () => {
    if (!rankingName.trim()) {
      toast.show({ type: 'error', message: t('ranking.toast.enterName') });
      return;
    }
    saveMutation.mutate({
      name: rankingName,
      isPublic: false,
      ...weights,
    });
  };

  const updateWeight = (key: keyof RankingWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return { icon: 'trophy', color: '#FFD700' };
    if (rank === 2) return { icon: 'medal', color: '#C0C0C0' };
    if (rank === 3) return { icon: 'medal', color: '#CD7F32' };
    return null;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View style={styles.headerIcon}>
            <Ionicons name="options-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t('ranking.title')}
          </Text>
          <Text style={[styles.headerDesc, { color: colors.foregroundMuted }]}>
            {t('ranking.subtitle')}
          </Text>
        </View>
      </Animated.View>

      {/* Weights Configuration */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)}>
        <AnimatedCard style={styles.weightsCard}>
          <CardContent>
            <View style={styles.weightHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('ranking.weights')}
              </Text>
              <Badge variant={totalWeight === 100 ? 'success' : 'warning'}>
                {t('ranking.totalWeight', { total: totalWeight })}
              </Badge>
            </View>

            {/* US News Rank */}
            <WeightSlider
              label={t('ranking.usnewsRank')}
              value={weights.usNewsRank}
              onChange={(v) => updateWeight('usNewsRank', v)}
              hint={t('ranking.usnewsHint')}
              colors={colors}
            />

            {/* Acceptance Rate */}
            <WeightSlider
              label={t('ranking.acceptanceRate')}
              value={weights.acceptanceRate}
              onChange={(v) => updateWeight('acceptanceRate', v)}
              hint={t('ranking.acceptanceHint')}
              colors={colors}
            />

            {/* Tuition */}
            <WeightSlider
              label={t('ranking.tuition')}
              value={weights.tuition}
              onChange={(v) => updateWeight('tuition', v)}
              hint={t('ranking.tuitionHint')}
              colors={colors}
            />

            {/* Avg Salary */}
            <WeightSlider
              label={t('ranking.avgSalary')}
              value={weights.avgSalary}
              onChange={(v) => updateWeight('avgSalary', v)}
              hint={t('ranking.salaryHint')}
              colors={colors}
            />

            <AnimatedButton
              onPress={handleCalculate}
              loading={isLoading}
              style={styles.calculateButton}
              leftIcon={<Ionicons name="play" size={18} color="#fff" />}
            >
              {t('ranking.preview')}
            </AnimatedButton>
          </CardContent>
        </AnimatedCard>
      </Animated.View>

      {/* Save Ranking */}
      {showResults && (ranking?.length ?? 0) > 0 && (
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <AnimatedCard style={styles.saveCard}>
            <CardContent>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('ranking.saveRanking')}
              </Text>
              <Input
                placeholder={t('ranking.myRankings')}
                value={rankingName}
                onChangeText={setRankingName}
                style={styles.input}
              />
              <AnimatedButton
                variant="outline"
                onPress={handleSave}
                loading={saveMutation.isPending}
                disabled={!ranking?.length}
                leftIcon={<Ionicons name="bookmark-outline" size={18} color={colors.primary} />}
              >
                {t('ranking.saveRanking')}
              </AnimatedButton>
            </CardContent>
          </AnimatedCard>
        </Animated.View>
      )}

      {/* Results */}
      {showResults && (
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <View style={styles.resultsSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t('ranking.preview')}
            </Text>

            {isLoading ? (
              <Loading />
            ) : ranking?.length ? (
              ranking.slice(0, 50).map((school, index) => {
                const rankIcon = getRankIcon(school.rank);
                return (
                  <Animated.View
                    key={school.id}
                    entering={FadeInUp.delay(350 + index * 50).springify()}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/school/${school.id}`)}
                      activeOpacity={0.7}
                    >
                      <AnimatedCard style={styles.schoolCard}>
                        <CardContent style={styles.schoolContent}>
                          {/* Rank */}
                          <View style={styles.rankContainer}>
                            {rankIcon ? (
                              <Ionicons
                                name={rankIcon.icon as any}
                                size={24}
                                color={rankIcon.color}
                              />
                            ) : (
                              <Text style={[styles.rankNumber, { color: colors.foregroundMuted }]}>
                                {school.rank}
                              </Text>
                            )}
                          </View>

                          {/* School Info */}
                          <View style={styles.schoolInfo}>
                            <Avatar source={school.logoUrl} name={school.name} size="sm" />
                            <View style={styles.schoolText}>
                              <Text
                                style={[styles.schoolName, { color: colors.foreground }]}
                                numberOfLines={1}
                              >
                                {school.name}
                              </Text>
                              {school.nameZh && (
                                <Text
                                  style={[styles.schoolNameZh, { color: colors.foregroundMuted }]}
                                  numberOfLines={1}
                                >
                                  {school.nameZh}
                                </Text>
                              )}
                            </View>
                          </View>

                          {/* Score */}
                          <View style={styles.scoreContainer}>
                            <Text style={[styles.score, { color: colors.primary }]}>
                              {school.score.toFixed(1)}
                            </Text>
                            <Text style={[styles.scoreLabel, { color: colors.foregroundMuted }]}>
                              {t('ranking.score')}
                            </Text>
                          </View>

                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.foregroundMuted}
                          />
                        </CardContent>
                      </AnimatedCard>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            ) : (
              <EmptyState
                icon="bar-chart-outline"
                title={t('ranking.emptyTitle', { defaultValue: 'Click Preview to see results' })}
                description={t('ranking.emptyDesc', {
                  defaultValue: 'Adjust weight parameters and click preview',
                })}
              />
            )}
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// Weight Slider Component
function WeightSlider({
  label,
  value,
  onChange,
  hint,
  colors,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  colors: any;
}) {
  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: colors.primary }]}>{value}%</Text>
      </View>
      <Slider value={value} onValueChange={onChange} minimumValue={0} maximumValue={100} step={5} />
      {hint && <Text style={[styles.sliderHint, { color: colors.foregroundMuted }]}>{hint}</Text>}
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
    alignItems: 'center',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  weightsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  sliderContainer: {
    marginBottom: spacing.lg,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sliderLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  sliderValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  sliderHint: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  calculateButton: {
    marginTop: spacing.sm,
  },
  saveCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
  },
  resultsSection: {
    padding: spacing.lg,
  },
  schoolCard: {
    marginBottom: spacing.sm,
  },
  schoolContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  schoolInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  schoolText: {
    flex: 1,
  },
  schoolName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  schoolNameZh: {
    fontSize: fontSize.xs,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: spacing.sm,
  },
  score: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  scoreLabel: {
    fontSize: fontSize.xs,
    marginLeft: 2,
  },
});
