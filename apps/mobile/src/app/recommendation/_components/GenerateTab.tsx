import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { AnimatedButton, AnimatedCard, CardContent, Progress } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import {
  useColors,
  colors as themeColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@/utils/theme';

import { SchoolCard } from './SchoolCard';
import {
  RecommendationResult,
  RecommendationPreflight,
  GenerateRecommendationDto,
  POINT_COST,
  REGION_OPTIONS,
  MAJOR_OPTIONS,
  BUDGET_OPTIONS,
  TIER_CONFIG,
  recommendationKeys,
  ColorsType,
} from './types';

interface GenerateTabProps {
  onViewHistoryResult?: (item: RecommendationResult) => void;
  externalResult: RecommendationResult | null;
  onExternalResultConsumed: () => void;
}

export function GenerateTab({ externalResult, onExternalResultConsumed }: GenerateTabProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Generation state machine: idle -> loading -> done
  const [generationState, setGenerationState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [result, setResult] = useState<RecommendationResult | null>(null);

  // Form state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [budget, setBudget] = useState<string>('medium');
  const [schoolCount, setSchoolCount] = useState(8);

  // Animated loading progress
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle external result (from history tab "View Full Results")
  useEffect(() => {
    if (externalResult) {
      setResult(externalResult);
      setGenerationState('done');
      onExternalResultConsumed();
    }
  }, [externalResult, onExternalResultConsumed]);

  // ─── Queries ───────────────────────────────────────────

  const { data: preflight, isLoading: preflightLoading } = useQuery<RecommendationPreflight>({
    queryKey: recommendationKeys.preflight(),
    queryFn: () => apiClient.get('/recommendations/preflight'),
    staleTime: 60_000,
  });

  // ─── Mutation ──────────────────────────────────────────

  const generateMutation = useMutation<RecommendationResult, Error, GenerateRecommendationDto>({
    mutationFn: (dto) => apiClient.post<RecommendationResult>('/recommendations', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.history() });
      queryClient.invalidateQueries({ queryKey: recommendationKeys.preflight() });
    },
  });

  // ─── Loading Animation ─────────────────────────────────

  useEffect(() => {
    if (generationState === 'loading') {
      setLoadingProgress(0);
      loadingIntervalRef.current = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev;
          const increment = prev < 50 ? 3 : prev < 75 ? 2 : 0.5;
          return Math.min(prev + increment, 90);
        });
      }, 200);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      if (generationState === 'done') {
        setLoadingProgress(100);
      }
    }

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [generationState]);

  // ─── Handlers ──────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!preflight?.canGenerate) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerationState('loading');

    try {
      const dto: GenerateRecommendationDto = {
        schoolCount,
        budget: budget || undefined,
        preferredRegions: selectedRegions.length > 0 ? selectedRegions : undefined,
        preferredMajors: selectedMajors.length > 0 ? selectedMajors : undefined,
      };

      const data = await generateMutation.mutateAsync(dto);
      setResult(data);
      setGenerationState('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('recommendation.generateSuccess', 'Recommendations generated!'));
    } catch (error: unknown) {
      setGenerationState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(
        error instanceof Error
          ? error.message
          : t('recommendation.generateFailed', 'Generation failed')
      );
    }
  }, [preflight, schoolCount, budget, selectedRegions, selectedMajors, generateMutation, t, toast]);

  const handleReset = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setResult(null);
    setGenerationState('idle');
  }, []);

  const toggleChip = useCallback(
    (value: string, selected: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (selected.includes(value)) {
        setter(selected.filter((v) => v !== value));
      } else {
        setter([...selected, value]);
      }
    },
    []
  );

  // ─── Render: Profile Status Banner ─────────────────────

  const renderProfileBanner = () => {
    if (preflightLoading) return null;
    if (!preflight) return null;

    const { profileComplete, missingFields, points, profileSummary } = preflight;

    return (
      <Animated.View entering={FadeInDown.duration(400).springify()}>
        <LinearGradient
          colors={
            profileComplete
              ? [colors.success + '20', colors.success + '08']
              : [colors.warning + '20', colors.warning + '08']
          }
          style={[
            styles.profileBanner,
            { borderColor: profileComplete ? colors.success + '40' : colors.warning + '40' },
          ]}
        >
          <View style={styles.profileBannerHeader}>
            <Ionicons
              name={profileComplete ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={profileComplete ? colors.success : colors.warning}
            />
            <Text style={[styles.profileBannerTitle, { color: colors.foreground }]}>
              {profileComplete
                ? t('recommendation.profileComplete', 'Profile Complete')
                : t('recommendation.profileIncomplete', 'Profile Incomplete')}
            </Text>
            <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="diamond-outline" size={14} color={colors.primary} />
              <Text style={[styles.pointsText, { color: colors.primary }]}>{points}</Text>
            </View>
          </View>

          {profileSummary && (
            <View style={styles.profileSummaryRow}>
              {profileSummary.gpa != null && (
                <View style={[styles.summaryChip, { backgroundColor: colors.card }]}>
                  <Text style={[styles.summaryChipLabel, { color: colors.foregroundMuted }]}>
                    GPA
                  </Text>
                  <Text style={[styles.summaryChipValue, { color: colors.foreground }]}>
                    {profileSummary.gpa.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryChip, { backgroundColor: colors.card }]}>
                <Text style={[styles.summaryChipLabel, { color: colors.foregroundMuted }]}>
                  {t('recommendation.tests', 'Tests')}
                </Text>
                <Text style={[styles.summaryChipValue, { color: colors.foreground }]}>
                  {profileSummary.testCount}
                </Text>
              </View>
              <View style={[styles.summaryChip, { backgroundColor: colors.card }]}>
                <Text style={[styles.summaryChipLabel, { color: colors.foregroundMuted }]}>
                  {t('recommendation.activities', 'Activities')}
                </Text>
                <Text style={[styles.summaryChipValue, { color: colors.foreground }]}>
                  {profileSummary.activityCount}
                </Text>
              </View>
            </View>
          )}

          {!profileComplete && missingFields.length > 0 && (
            <View style={styles.missingFieldsRow}>
              <Text style={[styles.missingFieldsLabel, { color: colors.warning }]}>
                {t('recommendation.missingFields', 'Missing:')}
              </Text>
              <Text style={[styles.missingFieldsText, { color: colors.foregroundMuted }]}>
                {missingFields.join(', ')}
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  // ─── Render: Chip Selector ─────────────────────────────

  const renderChipSelector = (
    label: string,
    options: string[],
    selected: string[],
    onToggle: (value: string) => void
  ) => (
    <View style={styles.formSection}>
      <Text style={[styles.formLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.chipGrid}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onToggle(option)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={option}
              activeOpacity={0.7}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.muted,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {option}
              </Text>
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={colors.primaryForeground}
                  style={{ marginLeft: 4 }}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─── Render: Preference Form ───────────────────────────

  const renderForm = () => (
    <Animated.View entering={FadeInUp.delay(100).duration(400).springify()}>
      {/* Regions */}
      {renderChipSelector(
        t('recommendation.preferredRegions', 'Preferred Regions'),
        REGION_OPTIONS,
        selectedRegions,
        (v) => toggleChip(v, selectedRegions, setSelectedRegions)
      )}

      {/* Majors */}
      {renderChipSelector(
        t('recommendation.preferredMajors', 'Preferred Majors'),
        MAJOR_OPTIONS,
        selectedMajors,
        (v) => toggleChip(v, selectedMajors, setSelectedMajors)
      )}

      {/* Budget */}
      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: colors.foreground }]}>
          {t('recommendation.budget', 'Annual Budget')}
        </Text>
        <View style={styles.budgetRow}>
          {BUDGET_OPTIONS.map((opt) => {
            const isSelected = budget === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBudget(opt.key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={opt.label}
                activeOpacity={0.7}
                style={[
                  styles.budgetOption,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.budgetText,
                    { color: isSelected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* School Count */}
      <View style={styles.formSection}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {t('recommendation.schoolCount', 'Number of Schools')}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.countBadgeText, { color: colors.primary }]}>{schoolCount}</Text>
          </View>
        </View>
        <View style={styles.schoolCountRow}>
          {[5, 8, 10, 15].map((count) => {
            const isSelected = schoolCount === count;
            return (
              <TouchableOpacity
                key={count}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSchoolCount(count);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${count}`}
                activeOpacity={0.7}
                style={[
                  styles.countOption,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countOptionText,
                    { color: isSelected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Generate Button */}
      <View style={styles.generateButtonContainer}>
        <AnimatedButton
          onPress={handleGenerate}
          disabled={!preflight?.canGenerate || generateMutation.isPending}
          loading={generateMutation.isPending}
          size="lg"
          hapticFeedback="medium"
          style={styles.generateButton}
          leftIcon={<Ionicons name="sparkles" size={20} color={colors.primaryForeground} />}
        >
          {t('recommendation.generate', 'Generate Recommendations')}
        </AnimatedButton>
        <Text style={[styles.pointCostText, { color: colors.foregroundMuted }]}>
          <Ionicons name="diamond-outline" size={12} color={colors.foregroundMuted} />{' '}
          {t('recommendation.pointCost', '{{cost}} points', { cost: POINT_COST })}
        </Text>

        {preflight && !preflight.canGenerate && (
          <Text style={[styles.cannotGenerateText, { color: colors.error }]}>
            {!preflight.profileComplete
              ? t('recommendation.completeProfileFirst', 'Complete your profile first')
              : preflight.points < POINT_COST
                ? t('recommendation.insufficientPoints', 'Insufficient points')
                : t('recommendation.cannotGenerate', 'Cannot generate at this time')}
          </Text>
        )}
      </View>
    </Animated.View>
  );

  // ─── Render: Loading State ─────────────────────────────

  const renderLoadingState = () => (
    <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.loadingContainer}>
      <LinearGradient
        colors={[colors.primary + '10', colors.primary + '05']}
        style={[styles.loadingCard, { borderColor: colors.border }]}
      >
        <Ionicons name="sparkles" size={40} color={colors.primary} style={styles.loadingIcon} />
        <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
          {t('recommendation.generating', 'AI is analyzing your profile...')}
        </Text>
        <Text style={[styles.loadingSubtitle, { color: colors.foregroundMuted }]}>
          {loadingProgress < 30
            ? t('recommendation.loadingStep1', 'Reviewing your academic profile...')
            : loadingProgress < 60
              ? t('recommendation.loadingStep2', 'Matching with university databases...')
              : loadingProgress < 85
                ? t('recommendation.loadingStep3', 'Calculating fit scores...')
                : t('recommendation.loadingStep4', 'Finalizing recommendations...')}
        </Text>
        <View style={styles.loadingProgressContainer}>
          <Progress
            value={loadingProgress}
            max={100}
            height={6}
            color={colors.primary}
            trackColor={colors.muted}
          />
          <Text style={[styles.loadingPercent, { color: colors.primary }]}>
            {Math.round(loadingProgress)}%
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  // ─── Render: Results ───────────────────────────────────

  const renderResults = () => {
    if (!result) return null;

    const reachCount = result.recommendations.filter((r) => r.tier === 'reach').length;
    const matchCount = result.recommendations.filter((r) => r.tier === 'match').length;
    const safetyCount = result.recommendations.filter((r) => r.tier === 'safety').length;

    return (
      <>
        {/* Summary Card */}
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'dd']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryHeader}>
              <Ionicons name="sparkles" size={24} color={colors.onGradient} />
              <Text style={styles.summaryTitle}>
                {t('recommendation.resultSummary', 'AI Recommendation Summary')}
              </Text>
            </View>
            <Text style={styles.summaryText}>{result.summary}</Text>

            {/* Tier Counts */}
            <View style={styles.tierCountsRow}>
              <View style={[styles.tierCount, { backgroundColor: colors.onGradientOverlay }]}>
                <View style={[styles.tierDot, { backgroundColor: TIER_CONFIG.reach.color }]} />
                <Text style={styles.tierCountLabel}>{t('recommendation.tierReach', 'Reach')}</Text>
                <Text style={styles.tierCountValue}>{reachCount}</Text>
              </View>
              <View style={[styles.tierCount, { backgroundColor: colors.onGradientOverlay }]}>
                <View style={[styles.tierDot, { backgroundColor: TIER_CONFIG.match.color }]} />
                <Text style={styles.tierCountLabel}>{t('recommendation.tierMatch', 'Match')}</Text>
                <Text style={styles.tierCountValue}>{matchCount}</Text>
              </View>
              <View style={[styles.tierCount, { backgroundColor: colors.onGradientOverlay }]}>
                <View style={[styles.tierDot, { backgroundColor: TIER_CONFIG.safety.color }]} />
                <Text style={styles.tierCountLabel}>
                  {t('recommendation.tierSafety', 'Safety')}
                </Text>
                <Text style={styles.tierCountValue}>{safetyCount}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* School Cards */}
        <View style={styles.schoolListSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t('recommendation.recommendedSchools', 'Recommended Schools')} (
            {result.recommendations.length})
          </Text>
          {result.recommendations.map((school, index) => (
            <SchoolCard key={`${school.schoolName}-${index}`} school={school} colors={colors} />
          ))}
        </View>

        {/* Analysis */}
        {result.analysis && (
          <Animated.View
            entering={FadeInUp.delay(500).duration(400).springify()}
            style={styles.analysisSection}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t('recommendation.analysis', 'Profile Analysis')}
            </Text>

            {/* Strengths */}
            {result.analysis.strengths.length > 0 && (
              <AnimatedCard style={styles.analysisCard}>
                <CardContent>
                  <View style={styles.analysisHeaderRow}>
                    <Ionicons name="trending-up" size={18} color={colors.success} />
                    <Text style={[styles.analysisLabel, { color: colors.success }]}>
                      {t('recommendation.strengths', 'Strengths')}
                    </Text>
                  </View>
                  {result.analysis.strengths.map((item, i) => (
                    <View key={i} style={styles.analysisItem}>
                      <Text style={[styles.analysisBullet, { color: colors.success }]}>+</Text>
                      <Text style={[styles.analysisItemText, { color: colors.foreground }]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </CardContent>
              </AnimatedCard>
            )}

            {/* Weaknesses */}
            {result.analysis.weaknesses.length > 0 && (
              <AnimatedCard style={styles.analysisCard}>
                <CardContent>
                  <View style={styles.analysisHeaderRow}>
                    <Ionicons name="trending-down" size={18} color={colors.error} />
                    <Text style={[styles.analysisLabel, { color: colors.error }]}>
                      {t('recommendation.weaknesses', 'Areas to Improve')}
                    </Text>
                  </View>
                  {result.analysis.weaknesses.map((item, i) => (
                    <View key={i} style={styles.analysisItem}>
                      <Text style={[styles.analysisBullet, { color: colors.error }]}>-</Text>
                      <Text style={[styles.analysisItemText, { color: colors.foreground }]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </CardContent>
              </AnimatedCard>
            )}

            {/* Improvement Tips */}
            {result.analysis.improvementTips.length > 0 && (
              <AnimatedCard style={styles.analysisCard}>
                <CardContent>
                  <View style={styles.analysisHeaderRow}>
                    <Ionicons name="bulb-outline" size={18} color={colors.info} />
                    <Text style={[styles.analysisLabel, { color: colors.info }]}>
                      {t('recommendation.improvementTips', 'Tips')}
                    </Text>
                  </View>
                  {result.analysis.improvementTips.map((item, i) => (
                    <View key={i} style={styles.analysisItem}>
                      <Ionicons name="arrow-forward" size={14} color={colors.info} />
                      <Text style={[styles.analysisItemText, { color: colors.foreground }]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </CardContent>
              </AnimatedCard>
            )}
          </Animated.View>
        )}

        {/* Reset Button */}
        <View style={styles.resetContainer}>
          <AnimatedButton
            onPress={handleReset}
            variant="outline"
            size="lg"
            style={styles.resetButton}
            leftIcon={<Ionicons name="refresh-outline" size={20} color={colors.foreground} />}
          >
            {t('recommendation.generateAgain', 'Generate Again')}
          </AnimatedButton>
        </View>
      </>
    );
  };

  // ─── Main Render ───────────────────────────────────────

  return (
    <>
      {/* Profile Banner */}
      {generationState === 'idle' && renderProfileBanner()}

      {/* Content based on state */}
      {generationState === 'idle' && renderForm()}
      {generationState === 'loading' && renderLoadingState()}
      {generationState === 'done' && renderResults()}
    </>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  // Profile Banner
  profileBanner: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  profileBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileBannerTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  pointsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  profileSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  summaryChipLabel: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  summaryChipValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  missingFieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  missingFieldsLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  missingFieldsText: {
    fontSize: fontSize.sm,
    flex: 1,
  },

  // Form
  formSection: {
    marginBottom: spacing.xl,
  },
  formLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.sm,
  },

  // Budget
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  budgetText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // School Count
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  countBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  countBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  schoolCountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  countOptionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },

  // Generate Button
  generateButtonContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  generateButton: {
    width: '100%',
  },
  pointCostText: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  cannotGenerateText: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    fontWeight: fontWeight.medium,
  },

  // Loading
  loadingContainer: {
    marginTop: spacing.lg,
  },
  loadingCard: {
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
  },
  loadingIcon: {
    marginBottom: spacing.lg,
  },
  loadingTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  loadingSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: fontSize.sm * 1.5,
  },
  loadingProgressContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  loadingPercent: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },

  // Summary Card
  summaryCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: themeColors.light.onGradient,
  },
  summaryText: {
    fontSize: fontSize.sm,
    color: themeColors.light.onGradientMuted,
    lineHeight: fontSize.sm * 1.6,
    marginBottom: spacing.lg,
  },
  tierCountsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tierCount: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierCountLabel: {
    fontSize: fontSize.xs,
    color: themeColors.light.onGradientMuted,
  },
  tierCountValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: themeColors.light.onGradient,
  },

  // School List Section
  schoolListSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },

  // Analysis
  analysisSection: {
    marginBottom: spacing.lg,
  },
  analysisCard: {
    marginBottom: spacing.sm,
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  analysisLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  analysisBullet: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    width: 16,
    textAlign: 'center',
  },
  analysisItemText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },

  // Reset
  resetContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  resetButton: {
    width: '100%',
  },
});
