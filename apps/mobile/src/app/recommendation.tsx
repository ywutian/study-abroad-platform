/**
 * AI Recommendation Page
 *
 * AI-powered school recommendation with:
 * - Preflight check (profile completeness, points balance)
 * - Preference form (regions, majors, budget, school count)
 * - Animated generation progress
 * - Results display with tier badges, probability bars, and analysis
 * - History tab with expandable past recommendations
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Stack } from 'expo-router';
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
  Progress,
  AnimatedCounter,
  Segment,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================
// Types
// ============================================================

interface RecommendedSchool {
  schoolId?: string;
  schoolName: string;
  tier: 'reach' | 'match' | 'safety';
  estimatedProbability: number;
  fitScore: number;
  reasons: string[];
  concerns?: string[];
  schoolMeta?: {
    usNewsRank?: number;
    acceptanceRate?: number;
    location?: string;
    tuition?: number;
  };
}

interface RecommendationResult {
  id: string;
  recommendations: RecommendedSchool[];
  analysis: {
    strengths: string[];
    weaknesses: string[];
    improvementTips: string[];
  };
  summary: string;
  tokenUsed: number;
  createdAt: string;
}

interface RecommendationPreflight {
  canGenerate: boolean;
  points: number;
  profileComplete: boolean;
  missingFields: string[];
  profileSummary?: {
    gpa?: number;
    testCount: number;
    activityCount: number;
  };
}

interface GenerateRecommendationDto {
  preferredRegions?: string[];
  preferredMajors?: string[];
  budget?: string;
  schoolCount?: number;
  additionalPreferences?: string;
}

// ============================================================
// Constants
// ============================================================

const POINT_COST = 25;

const REGION_OPTIONS = [
  'California',
  'New York',
  'Massachusetts',
  'Pennsylvania',
  'Illinois',
  'Texas',
  'Virginia',
  'Georgia',
  'Michigan',
  'North Carolina',
  'Washington',
  'Connecticut',
  'New Jersey',
  'Ohio',
  'Florida',
];

const MAJOR_OPTIONS = [
  'Computer Science',
  'Engineering',
  'Business',
  'Economics',
  'Mathematics',
  'Biology',
  'Physics',
  'Chemistry',
  'Psychology',
  'Political Science',
  'Communications',
  'Data Science',
  'Finance',
  'Pre-Med',
  'Architecture',
];

const BUDGET_OPTIONS = [
  { key: 'low', label: '< $30k/yr' },
  { key: 'medium', label: '$30k-50k/yr' },
  { key: 'high', label: '$50k-70k/yr' },
  { key: 'unlimited', label: 'No Limit' },
];

const TIER_CONFIG = {
  reach: { color: '#ef4444', icon: 'rocket-outline' as const, labelKey: 'tierReach' },
  match: { color: '#f59e0b', icon: 'checkmark-circle-outline' as const, labelKey: 'tierMatch' },
  safety: { color: '#10b981', icon: 'shield-checkmark-outline' as const, labelKey: 'tierSafety' },
} as const;

// ============================================================
// Query Key Factory
// ============================================================

const recommendationKeys = {
  all: ['recommendation'] as const,
  preflight: () => [...recommendationKeys.all, 'preflight'] as const,
  history: () => [...recommendationKeys.all, 'history'] as const,
};

// ============================================================
// Main Component
// ============================================================

export default function RecommendationPage() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Tabs
  const [activeTab, setActiveTab] = useState('generate');

  // Generation state machine: idle -> loading -> done
  const [generationState, setGenerationState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [result, setResult] = useState<RecommendationResult | null>(null);

  // Form state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [budget, setBudget] = useState<string>('medium');
  const [schoolCount, setSchoolCount] = useState(8);

  // History expansion
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Animated loading progress
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Queries ───────────────────────────────────────────

  const {
    data: preflight,
    isLoading: preflightLoading,
    refetch: refetchPreflight,
  } = useQuery<RecommendationPreflight>({
    queryKey: recommendationKeys.preflight(),
    queryFn: () => apiClient.get('/recommendation/preflight'),
    staleTime: 60_000,
  });

  const {
    data: history,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery<RecommendationResult[]>({
    queryKey: recommendationKeys.history(),
    queryFn: () => apiClient.get('/recommendation/history'),
    enabled: activeTab === 'history',
    staleTime: 5 * 60_000,
  });

  // ─── Mutation ──────────────────────────────────────────

  const generateMutation = useMutation<RecommendationResult, Error, GenerateRecommendationDto>({
    mutationFn: (dto) => apiClient.post<RecommendationResult>('/recommendation', dto),
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
          // Slow down as we approach 90%
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
    } catch (error: any) {
      setGenerationState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error.message || t('recommendation.generateFailed', 'Generation failed'));
    }
  }, [preflight, schoolCount, budget, selectedRegions, selectedMajors, generateMutation, t, toast]);

  const handleReset = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setResult(null);
    setGenerationState('idle');
  }, []);

  const handleViewHistoryResult = useCallback((item: RecommendationResult) => {
    setResult(item);
    setGenerationState('done');
    setActiveTab('generate');
  }, []);

  const toggleHistoryExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedHistoryId((prev) => (prev === id ? null : id));
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

  // ─── Refresh ───────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchPreflight(),
      activeTab === 'history' ? refetchHistory() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [refetchPreflight, refetchHistory, activeTab]);

  // ─── Helper: Tier Label ────────────────────────────────

  const getTierLabel = (tier: 'reach' | 'match' | 'safety') => {
    const labels: Record<string, string> = {
      reach: t('recommendation.tierReach', 'Reach'),
      match: t('recommendation.tierMatch', 'Match'),
      safety: t('recommendation.tierSafety', 'Safety'),
    };
    return labels[tier] || tier;
  };

  const getTierBadgeVariant = (tier: 'reach' | 'match' | 'safety') => {
    const map: Record<string, 'error' | 'warning' | 'success'> = {
      reach: 'error',
      match: 'warning',
      safety: 'success',
    };
    return map[tier] || ('secondary' as any);
  };

  // ─── Format Helpers ────────────────────────────────────

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 1000).toFixed(0)}k`;
  };

  // ============================================================
  // Render: Profile Status Banner
  // ============================================================

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

  // ============================================================
  // Render: Chip Selector
  // ============================================================

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

  // ============================================================
  // Render: Preference Form
  // ============================================================

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

  // ============================================================
  // Render: Loading State
  // ============================================================

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

  // ============================================================
  // Render: School Card
  // ============================================================

  const renderSchoolCard = (school: RecommendedSchool, index: number) => {
    const tierConfig = TIER_CONFIG[school.tier];

    return (
      <Animated.View
        key={`${school.schoolName}-${index}`}
        entering={FadeInUp.delay(200 + index * 80).springify()}
      >
        <AnimatedCard
          style={[styles.schoolCard, { borderLeftColor: tierConfig.color, borderLeftWidth: 3 }]}
        >
          <CardContent>
            {/* Header */}
            <View style={styles.schoolCardHeader}>
              <View style={styles.schoolCardInfo}>
                <Text style={[styles.schoolName, { color: colors.foreground }]} numberOfLines={2}>
                  {school.schoolName}
                </Text>
                <View style={styles.schoolMetaRow}>
                  <Badge variant={getTierBadgeVariant(school.tier)}>
                    {getTierLabel(school.tier)}
                  </Badge>
                  {school.schoolMeta?.usNewsRank && (
                    <Text style={[styles.rankText, { color: colors.foregroundMuted }]}>
                      #{school.schoolMeta.usNewsRank} US News
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.fitScoreContainer}>
                <AnimatedCounter
                  value={school.fitScore}
                  style={[styles.fitScoreValue, { color: tierConfig.color }]}
                />
                <Text style={[styles.fitScoreLabel, { color: colors.foregroundMuted }]}>
                  {t('recommendation.fitScore', 'Fit')}
                </Text>
              </View>
            </View>

            {/* Probability Bar */}
            <View style={styles.probabilitySection}>
              <View style={styles.probabilityHeader}>
                <Text style={[styles.probabilityLabel, { color: colors.foregroundMuted }]}>
                  {t('recommendation.probability', 'Admission Probability')}
                </Text>
                <Text style={[styles.probabilityValue, { color: tierConfig.color }]}>
                  {Math.round(school.estimatedProbability)}%
                </Text>
              </View>
              <Progress
                value={school.estimatedProbability}
                max={100}
                height={6}
                color={tierConfig.color}
                trackColor={colors.muted}
              />
            </View>

            {/* School Meta */}
            {school.schoolMeta && (
              <View style={styles.schoolMetaDetails}>
                {school.schoolMeta.location && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color={colors.foregroundMuted} />
                    <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
                      {school.schoolMeta.location}
                    </Text>
                  </View>
                )}
                {school.schoolMeta.acceptanceRate != null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={14} color={colors.foregroundMuted} />
                    <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
                      {school.schoolMeta.acceptanceRate}%{' '}
                      {t('recommendation.acceptRate', 'accept rate')}
                    </Text>
                  </View>
                )}
                {school.schoolMeta.tuition != null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="cash-outline" size={14} color={colors.foregroundMuted} />
                    <Text style={[styles.metaText, { color: colors.foregroundMuted }]}>
                      {formatCurrency(school.schoolMeta.tuition)}/yr
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Reasons */}
            {school.reasons.length > 0 && (
              <View style={styles.reasonsSection}>
                {school.reasons.map((reason, i) => (
                  <View key={i} style={styles.reasonRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.reasonText, { color: colors.foregroundSecondary }]}>
                      {reason}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Concerns */}
            {school.concerns && school.concerns.length > 0 && (
              <View style={styles.concernsSection}>
                {school.concerns.map((concern, i) => (
                  <View key={i} style={styles.reasonRow}>
                    <Ionicons name="alert-circle" size={16} color={colors.warning} />
                    <Text style={[styles.reasonText, { color: colors.foregroundSecondary }]}>
                      {concern}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  // ============================================================
  // Render: Results
  // ============================================================

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
              <Ionicons name="sparkles" size={24} color="#fff" />
              <Text style={styles.summaryTitle}>
                {t('recommendation.resultSummary', 'AI Recommendation Summary')}
              </Text>
            </View>
            <Text style={styles.summaryText}>{result.summary}</Text>

            {/* Tier Counts */}
            <View style={styles.tierCountsRow}>
              <View style={[styles.tierCount, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.tierDot, { backgroundColor: TIER_CONFIG.reach.color }]} />
                <Text style={styles.tierCountLabel}>{t('recommendation.tierReach', 'Reach')}</Text>
                <Text style={styles.tierCountValue}>{reachCount}</Text>
              </View>
              <View style={[styles.tierCount, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.tierDot, { backgroundColor: TIER_CONFIG.match.color }]} />
                <Text style={styles.tierCountLabel}>{t('recommendation.tierMatch', 'Match')}</Text>
                <Text style={styles.tierCountValue}>{matchCount}</Text>
              </View>
              <View style={[styles.tierCount, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
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
          {result.recommendations.map((school, index) => renderSchoolCard(school, index))}
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

  // ============================================================
  // Render: History Tab
  // ============================================================

  const renderHistory = () => {
    if (historyLoading) {
      return <Loading text={t('recommendation.loadingHistory', 'Loading history...')} />;
    }

    if (!history || history.length === 0) {
      return (
        <EmptyState
          icon="time-outline"
          title={t('recommendation.noHistory', 'No recommendations yet')}
          description={t(
            'recommendation.noHistoryDesc',
            'Generate your first AI recommendation to get started.'
          )}
          action={{
            label: t('recommendation.goGenerate', 'Generate Now'),
            onPress: () => setActiveTab('generate'),
          }}
        />
      );
    }

    return (
      <Animated.View entering={FadeInUp.duration(400).springify()}>
        {history.map((item, index) => {
          const isExpanded = expandedHistoryId === item.id;
          const reachCount = item.recommendations.filter((r) => r.tier === 'reach').length;
          const matchCount = item.recommendations.filter((r) => r.tier === 'match').length;
          const safetyCount = item.recommendations.filter((r) => r.tier === 'safety').length;

          return (
            <Animated.View key={item.id} entering={FadeInUp.delay(index * 80).springify()}>
              <AnimatedCard style={styles.historyCard} onPress={() => toggleHistoryExpand(item.id)}>
                <CardContent>
                  <View style={styles.historyCardHeader}>
                    <View style={styles.historyCardInfo}>
                      <Text style={[styles.historyDate, { color: colors.foreground }]}>
                        {formatDate(item.createdAt)}
                      </Text>
                      <Text style={[styles.historySchoolCount, { color: colors.foregroundMuted }]}>
                        {item.recommendations.length} {t('recommendation.schools', 'schools')}
                      </Text>
                    </View>
                    <View style={styles.historyTierRow}>
                      {reachCount > 0 && (
                        <View
                          style={[
                            styles.historyTierDot,
                            { backgroundColor: TIER_CONFIG.reach.color },
                          ]}
                        >
                          <Text style={styles.historyTierDotText}>{reachCount}</Text>
                        </View>
                      )}
                      {matchCount > 0 && (
                        <View
                          style={[
                            styles.historyTierDot,
                            { backgroundColor: TIER_CONFIG.match.color },
                          ]}
                        >
                          <Text style={styles.historyTierDotText}>{matchCount}</Text>
                        </View>
                      )}
                      {safetyCount > 0 && (
                        <View
                          style={[
                            styles.historyTierDot,
                            { backgroundColor: TIER_CONFIG.safety.color },
                          ]}
                        >
                          <Text style={styles.historyTierDotText}>{safetyCount}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.foregroundMuted}
                    />
                  </View>

                  {isExpanded && (
                    <View style={styles.historyExpandedContent}>
                      <Text
                        style={[styles.historySummary, { color: colors.foregroundSecondary }]}
                        numberOfLines={3}
                      >
                        {item.summary}
                      </Text>

                      <View style={styles.historySchoolList}>
                        {item.recommendations.slice(0, 5).map((school, sIndex) => (
                          <View key={sIndex} style={styles.historySchoolRow}>
                            <View
                              style={[
                                styles.historySchoolDot,
                                { backgroundColor: TIER_CONFIG[school.tier].color },
                              ]}
                            />
                            <Text
                              style={[styles.historySchoolName, { color: colors.foreground }]}
                              numberOfLines={1}
                            >
                              {school.schoolName}
                            </Text>
                            <Text
                              style={[styles.historySchoolScore, { color: colors.foregroundMuted }]}
                            >
                              {school.fitScore}
                            </Text>
                          </View>
                        ))}
                        {item.recommendations.length > 5 && (
                          <Text style={[styles.historyMoreText, { color: colors.foregroundMuted }]}>
                            +{item.recommendations.length - 5}{' '}
                            {t('recommendation.moreSchools', 'more')}
                          </Text>
                        )}
                      </View>

                      <AnimatedButton
                        onPress={() => handleViewHistoryResult(item)}
                        variant="outline"
                        size="sm"
                        style={styles.historyViewButton}
                      >
                        {t('recommendation.viewFull', 'View Full Results')}
                      </AnimatedButton>
                    </View>
                  )}
                </CardContent>
              </AnimatedCard>
            </Animated.View>
          );
        })}
      </Animated.View>
    );
  };

  // ============================================================
  // Render: Main
  // ============================================================

  return (
    <>
      <Stack.Screen
        options={{
          title: t('recommendation.title', 'AI Recommendation'),
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500).springify()}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'cc']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroIcon}>
                <Ionicons name="school" size={28} color="#fff" />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>
                  {t('recommendation.heroTitle', 'Smart School Selection')}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {t(
                    'recommendation.heroSubtitle',
                    'AI-powered recommendations tailored to your profile'
                  )}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <Segment
            segments={[
              { key: 'generate', label: t('recommendation.tabGenerate', 'Generate') },
              { key: 'history', label: t('recommendation.tabHistory', 'History') },
            ]}
            value={activeTab}
            onChange={(key) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(key);
            }}
          />
        </View>

        {/* Tab Content */}
        {activeTab === 'generate' && (
          <View style={styles.tabContent}>
            {/* Profile Banner */}
            {generationState === 'idle' && renderProfileBanner()}

            {/* Content based on state */}
            {generationState === 'idle' && renderForm()}
            {generationState === 'loading' && renderLoadingState()}
            {generationState === 'done' && renderResults()}
          </View>
        )}

        {activeTab === 'history' && <View style={styles.tabContent}>{renderHistory()}</View>}
      </ScrollView>
    </>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Hero
  hero: {
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: fontSize.sm * 1.4,
  },

  // Tabs
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

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
    color: '#ffffff',
  },
  summaryText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.9)',
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
    color: 'rgba(255,255,255,0.9)',
  },
  tierCountValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
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

  // School Card
  schoolCard: {
    marginBottom: spacing.md,
  },
  schoolCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  schoolCardInfo: {
    flex: 1,
    marginRight: spacing.md,
    gap: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.base * 1.3,
  },
  schoolMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankText: {
    fontSize: fontSize.xs,
  },
  fitScoreContainer: {
    alignItems: 'center',
  },
  fitScoreValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  fitScoreLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Probability
  probabilitySection: {
    marginBottom: spacing.md,
  },
  probabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  probabilityLabel: {
    fontSize: fontSize.xs,
  },
  probabilityValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  // School Meta Details
  schoolMetaDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
  },

  // Reasons & Concerns
  reasonsSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  concernsSection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reasonText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
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

  // History
  historyCard: {
    marginBottom: spacing.md,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyCardInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  historySchoolCount: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  historyTierRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginRight: spacing.md,
  },
  historyTierDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTierDotText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  historyExpandedContent: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: spacing.lg,
  },
  historySummary: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing.md,
  },
  historySchoolList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  historySchoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historySchoolDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historySchoolName: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  historySchoolScore: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  historyMoreText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginLeft: spacing.lg,
  },
  historyViewButton: {
    alignSelf: 'flex-start',
  },
});
