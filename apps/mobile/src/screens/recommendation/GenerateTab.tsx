import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AnimatedButton, AnimatedCard, CardContent, Progress } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { fontFamily, useColors, withOpacity } from '@/utils/theme';
import { recommendationRoutes } from '@study-abroad/shared';

import { styles } from './GenerateTab.styles';
import { SchoolCard } from './SchoolCard';
import {
  BUDGET_OPTIONS,
  GenerateRecommendationDto,
  getTierConfig,
  MAJOR_OPTIONS,
  recommendationKeys,
  RecommendationPreflight,
  RecommendationResult,
  REGION_OPTIONS,
} from './types';

interface GenerateTabProps {
  onViewHistoryResult?: (item: RecommendationResult) => void;
  externalResult: RecommendationResult | null;
  onExternalResultConsumed: () => void;
}

export function GenerateTab({ externalResult, onExternalResultConsumed }: GenerateTabProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const tierConfig = getTierConfig(colors);
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
    queryFn: () => apiClient.get(recommendationRoutes.preflight()),
    staleTime: 60_000,
  });

  // ─── Mutation ──────────────────────────────────────────

  const generateMutation = useMutation<RecommendationResult, Error, GenerateRecommendationDto>({
    mutationFn: (dto) => apiClient.post<RecommendationResult>(recommendationRoutes.generate(), dto),
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
      toast.success(t('recommendation.generateSuccess'));
    } catch (error: unknown) {
      setGenerationState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error instanceof Error ? error.message : t('recommendation.generateFailed'));
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

    const { profileComplete, missingFields, profileSummary } = preflight;

    return (
      <Animated.View entering={FadeInDown.duration(400).springify()}>
        <View
          style={[
            styles.profileBanner,
            {
              backgroundColor: profileComplete
                ? withOpacity(colors.success, 0.08)
                : withOpacity(colors.warning, 0.08),
              borderColor: profileComplete
                ? withOpacity(colors.success, 0.25)
                : withOpacity(colors.warning, 0.25),
            },
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
                ? t('recommendation.profileComplete')
                : t('recommendation.profileIncomplete')}
            </Text>
          </View>

          {profileSummary && (
            <View style={styles.profileSummaryRow}>
              {profileSummary.gpa != null && (
                <View
                  style={[
                    styles.summaryChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.summaryChipLabel, { color: colors.foregroundMuted }]}>
                    GPA
                  </Text>
                  <Text
                    style={[
                      styles.summaryChipValue,
                      { color: colors.foreground, fontFamily: fontFamily.mono },
                    ]}
                  >
                    {profileSummary.gpa != null ? profileSummary.gpa.toFixed(2) : '—'}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.summaryChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.summaryChipLabel, { color: colors.foregroundMuted }]}>
                  {t('recommendation.tests')}
                </Text>
                <Text
                  style={[
                    styles.summaryChipValue,
                    { color: colors.foreground, fontFamily: fontFamily.mono },
                  ]}
                >
                  {profileSummary.testCount}
                </Text>
              </View>
              <View
                style={[
                  styles.summaryChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.summaryChipLabel, { color: colors.foregroundMuted }]}>
                  {t('recommendation.activities')}
                </Text>
                <Text
                  style={[
                    styles.summaryChipValue,
                    { color: colors.foreground, fontFamily: fontFamily.mono },
                  ]}
                >
                  {profileSummary.activityCount}
                </Text>
              </View>
            </View>
          )}

          {!profileComplete && missingFields.length > 0 && (
            <View style={styles.missingFieldsRow}>
              <Text style={[styles.missingFieldsLabel, { color: colors.warning }]}>
                {t('recommendation.missingFields')}
              </Text>
              <Text style={[styles.missingFieldsText, { color: colors.foregroundMuted }]}>
                {missingFields.join(', ')}
              </Text>
            </View>
          )}
        </View>
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
                  style={styles.checkIcon}
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
        t('recommendation.preferredRegions'),
        REGION_OPTIONS,
        selectedRegions,
        (v) => toggleChip(v, selectedRegions, setSelectedRegions)
      )}

      {/* Majors */}
      {renderChipSelector(t('recommendation.preferredMajors'), MAJOR_OPTIONS, selectedMajors, (v) =>
        toggleChip(v, selectedMajors, setSelectedMajors)
      )}

      {/* Budget */}
      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: colors.foreground }]}>
          {t('recommendation.budget')}
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
            {t('recommendation.schoolCount')}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: withOpacity(colors.primary, 0.08) }]}>
            <Text
              style={[
                styles.countBadgeText,
                { color: colors.primary, fontFamily: fontFamily.mono },
              ]}
            >
              {schoolCount}
            </Text>
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
                    {
                      color: isSelected ? colors.primaryForeground : colors.foreground,
                      fontFamily: fontFamily.mono,
                    },
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
          {t('recommendation.generate')}
        </AnimatedButton>
        {preflight && !preflight.canGenerate && (
          <Text style={[styles.cannotGenerateText, { color: colors.error }]}>
            {!preflight.profileComplete
              ? t('recommendation.completeProfileFirst')
              : t('recommendation.cannotGenerate')}
          </Text>
        )}
      </View>
    </Animated.View>
  );

  // ─── Render: Loading State ─────────────────────────────

  const renderLoadingState = () => (
    <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.loadingContainer}>
      <View
        style={[
          styles.loadingCard,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <Ionicons name="sparkles" size={40} color={colors.primary} style={styles.loadingIcon} />
        <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
          {t('recommendation.generating')}
        </Text>
        <Text style={[styles.loadingSubtitle, { color: colors.foregroundMuted }]}>
          {loadingProgress < 30
            ? t('recommendation.loadingStep1')
            : loadingProgress < 60
              ? t('recommendation.loadingStep2')
              : loadingProgress < 85
                ? t('recommendation.loadingStep3')
                : t('recommendation.loadingStep4')}
        </Text>
        <View style={styles.loadingProgressContainer}>
          <Progress
            value={loadingProgress}
            max={100}
            height={6}
            color={colors.primary}
            trackColor={colors.muted}
          />
          <Text
            style={[styles.loadingPercent, { color: colors.primary, fontFamily: fontFamily.mono }]}
          >
            {Math.round(loadingProgress)}%
          </Text>
        </View>
      </View>
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
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <View style={styles.summaryHeader}>
              <Ionicons name="sparkles" size={24} color={colors.onGradient} />
              <Text style={[styles.summaryTitle, { color: colors.onGradient }]}>
                {t('recommendation.resultSummary')}
              </Text>
            </View>
            <Text style={[styles.summaryText, { color: colors.onGradientMuted }]}>
              {result.summary}
            </Text>
            <Text style={[styles.summaryHint, { color: colors.onGradientMuted }]}>
              {t('recommendation.strategyDisclaimer')}
            </Text>

            {/* Tier Counts */}
            <View style={styles.tierCountsRow}>
              <View style={[styles.tierCount, { backgroundColor: colors.onGradientOverlay }]}>
                <View style={[styles.tierDot, { backgroundColor: tierConfig.reach.color }]} />
                <Text style={[styles.tierCountLabel, { color: colors.onGradientMuted }]}>
                  {t('recommendation.tierReach')}
                </Text>
                <Text
                  style={[
                    styles.tierCountValue,
                    { color: colors.onGradient, fontFamily: fontFamily.mono },
                  ]}
                >
                  {reachCount}
                </Text>
              </View>
              <View style={[styles.tierCount, { backgroundColor: colors.onGradientOverlay }]}>
                <View style={[styles.tierDot, { backgroundColor: tierConfig.match.color }]} />
                <Text style={[styles.tierCountLabel, { color: colors.onGradientMuted }]}>
                  {t('recommendation.tierMatch')}
                </Text>
                <Text
                  style={[
                    styles.tierCountValue,
                    { color: colors.onGradient, fontFamily: fontFamily.mono },
                  ]}
                >
                  {matchCount}
                </Text>
              </View>
              <View style={[styles.tierCount, { backgroundColor: colors.onGradientOverlay }]}>
                <View style={[styles.tierDot, { backgroundColor: tierConfig.safety.color }]} />
                <Text style={[styles.tierCountLabel, { color: colors.onGradientMuted }]}>
                  {t('recommendation.tierSafety')}
                </Text>
                <Text
                  style={[
                    styles.tierCountValue,
                    { color: colors.onGradient, fontFamily: fontFamily.mono },
                  ]}
                >
                  {safetyCount}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* School Cards */}
        <View style={styles.schoolListSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t('recommendation.recommendedSchools')} ({result.recommendations.length})
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
              {t('recommendation.analysis')}
            </Text>

            {/* Strengths */}
            {result.analysis.strengths.length > 0 && (
              <AnimatedCard style={styles.analysisCard}>
                <CardContent>
                  <View style={styles.analysisHeaderRow}>
                    <Ionicons name="trending-up" size={18} color={colors.success} />
                    <Text style={[styles.analysisLabel, { color: colors.success }]}>
                      {t('recommendation.strengths')}
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
                      {t('recommendation.weaknesses')}
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
                      {t('recommendation.improvementTips')}
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
            {t('recommendation.generateAgain')}
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
