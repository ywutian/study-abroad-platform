import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  SearchBar,
  Segment,
  SkeletonCard,
  AnimatedCounter,
  CircularProgress,
  AnimatedButton,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GallerySchool {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
}

interface GalleryEssay {
  id: string;
  year: number;
  result: string;
  essayType?: string;
  promptNumber?: number;
  prompt: string | null;
  preview: string | null;
  wordCount: number;
  school: GallerySchool | null;
  tags: string[];
  isVerified: boolean;
}

interface GalleryStats {
  total: number;
  admitted: number;
  top20: number;
  byType: Record<string, number>;
}

interface GalleryResponse {
  items: GalleryEssay[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: GalleryStats;
}

interface EssayDetail {
  id: string;
  year: number;
  round: string;
  result: string;
  prompt: string | null;
  content: string | null;
  wordCount: number;
  gpaRange: string | null;
  satRange: string | null;
  school: GallerySchool | null;
  tags: string[];
  isVerified: boolean;
  isAnonymous: boolean;
}

interface ParagraphAnalysis {
  paragraphIndex: number;
  paragraphText: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  highlights: string[];
  suggestions: string[];
}

interface AnalysisResult {
  essayId: string;
  paragraphs: ParagraphAnalysis[];
  overallScore: number;
  structure: {
    hasStrongOpening: boolean;
    hasClarity: boolean;
    hasGoodConclusion: boolean;
    feedback: string;
  };
  summary: string;
  tokenUsed: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESULT_COLORS: Record<string, string> = {
  ADMITTED: '#10b981',
  REJECTED: '#ef4444',
  WAITLISTED: '#f59e0b',
  DEFERRED: '#3b82f6',
};

const STATUS_COLORS: Record<string, string> = {
  excellent: '#10b981',
  good: '#3b82f6',
  needs_work: '#f59e0b',
};

const ESSAY_TYPES = ['ALL', 'COMMON_APP', 'UC', 'SUPPLEMENTAL', 'WHY_SCHOOL', 'OTHER'] as const;
const RESULTS = ['ALL', 'ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'] as const;
const YEARS = [0, 2026, 2025, 2024, 2023, 2022] as const;

const PAGE_SIZE = 10;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EssayGalleryPage() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedResult, setSelectedResult] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Detail sheet
  const [selectedEssayId, setSelectedEssayId] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailTab, setDetailTab] = useState<'original' | 'analysis'>('original');
  const [expandedParagraphs, setExpandedParagraphs] = useState<Set<number>>(new Set());

  // Debounced search
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(text);
      setPage(1);
    }, 400);
  }, []);

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (debouncedSearch) params.school = debouncedSearch;
    if (selectedYear > 0) params.year = selectedYear;
    if (selectedType !== 'ALL') params.type = selectedType;
    if (selectedResult !== 'ALL') params.result = selectedResult;
    return params;
  }, [debouncedSearch, selectedYear, selectedType, selectedResult, page]);

  // Gallery query
  const {
    data: gallery,
    isLoading,
    isFetching,
  } = useQuery<GalleryResponse>({
    queryKey: ['essay-gallery', queryParams],
    queryFn: () => apiClient.get<GalleryResponse>('/essay-ai/gallery', { params: queryParams }),
  });

  // Detail query
  const { data: essayDetail, isLoading: isDetailLoading } = useQuery<EssayDetail>({
    queryKey: ['essay-detail', selectedEssayId],
    queryFn: () => apiClient.get<EssayDetail>(`/essay-ai/gallery/${selectedEssayId}`),
    enabled: !!selectedEssayId,
  });

  // AI Analysis mutation
  const analysisMutation = useMutation<AnalysisResult, Error, void>({
    mutationFn: () =>
      apiClient.post<AnalysisResult>(`/essay-ai/gallery/${selectedEssayId}/analyze`, {
        schoolName: essayDetail?.school?.name,
      }),
    onError: (error) => {
      toast.show({ type: 'error', message: error.message });
    },
  });

  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    selectedYear > 0 ||
    selectedType !== 'ALL' ||
    selectedResult !== 'ALL';

  const clearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedYear(0);
    setSelectedType('ALL');
    setSelectedResult('ALL');
    setPage(1);
  }, []);

  const openDetail = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEssayId(id);
    setDetailTab('original');
    setExpandedParagraphs(new Set());
    analysisMutation.reset();
    setDetailVisible(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedEssayId(null);
  }, []);

  const toggleParagraph = useCallback((index: number) => {
    setExpandedParagraphs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Year filter labels
  // -------------------------------------------------------------------------
  const yearLabel = useCallback(
    (y: number) => (y === 0 ? t('essayGallery.allYears') : String(y)),
    [t]
  );

  // -------------------------------------------------------------------------
  // Essay type label
  // -------------------------------------------------------------------------
  const typeLabel = useCallback(
    (type: string) => {
      const map: Record<string, string> = {
        ALL: t('essayGallery.essayTypes.all'),
        COMMON_APP: t('essayGallery.essayTypes.commonApp'),
        UC: t('essayGallery.essayTypes.uc'),
        SUPPLEMENTAL: t('essayGallery.essayTypes.supplemental'),
        WHY_SCHOOL: t('essayGallery.essayTypes.whySchool'),
        OTHER: t('essayGallery.essayTypes.other'),
      };
      return map[type] || type;
    },
    [t]
  );

  // -------------------------------------------------------------------------
  // Result badge helper
  // -------------------------------------------------------------------------
  const resultBadgeVariant = (result: string) => {
    switch (result) {
      case 'ADMITTED':
        return 'success' as const;
      case 'REJECTED':
        return 'error' as const;
      case 'WAITLISTED':
        return 'warning' as const;
      default:
        return 'secondary' as const;
    }
  };

  const resultLabel = (result: string) => {
    const map: Record<string, string> = {
      ADMITTED: t('essayGallery.results.admitted'),
      REJECTED: t('essayGallery.results.rejected'),
      WAITLISTED: t('essayGallery.results.waitlisted'),
      DEFERRED: t('essayGallery.results.deferred'),
    };
    return map[result] || result;
  };

  // -------------------------------------------------------------------------
  // Status label helper for AI analysis
  // -------------------------------------------------------------------------
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      excellent: t('essayGallery.quality.excellent'),
      good: t('essayGallery.quality.good'),
      needs_work: t('essayGallery.quality.needsWork'),
    };
    return map[status] || status;
  };

  // -------------------------------------------------------------------------
  // Sub-components (inline)
  // -------------------------------------------------------------------------

  // Stats header
  const renderStatsHeader = () => {
    if (!gallery?.stats) return null;
    const { total, admitted, top20 } = gallery.stats;
    return (
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.statsRow, { borderBottomColor: c.border }]}
      >
        <View style={styles.statItem}>
          <AnimatedCounter value={total} style={[styles.statValue, { color: c.primary }]} />
          <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>
            {t('essayGallery.stats.total')}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <AnimatedCounter
            value={admitted}
            style={[styles.statValue, { color: RESULT_COLORS.ADMITTED }]}
          />
          <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>
            {t('essayGallery.stats.admitted')}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <AnimatedCounter value={top20} style={[styles.statValue, { color: c.info }]} />
          <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>
            {t('essayGallery.stats.top20')}
          </Text>
        </View>
      </Animated.View>
    );
  };

  // Filter pills - year
  const renderYearFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterScrollContent}
    >
      {YEARS.map((y) => {
        const active = selectedYear === y;
        return (
          <TouchableOpacity
            key={y}
            onPress={() => {
              setSelectedYear(y);
              setPage(1);
            }}
            style={[
              styles.filterPill,
              {
                backgroundColor: active ? c.primary : c.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: active ? c.primaryForeground : c.foreground },
              ]}
            >
              {yearLabel(y)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // Filter pills - essay type
  const renderTypeFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterScrollContent}
    >
      {ESSAY_TYPES.map((type) => {
        const active = selectedType === type;
        return (
          <TouchableOpacity
            key={type}
            onPress={() => {
              setSelectedType(type);
              setPage(1);
            }}
            style={[
              styles.filterPill,
              {
                backgroundColor: active ? c.primary : c.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: active ? c.primaryForeground : c.foreground },
              ]}
            >
              {typeLabel(type)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // Filter pills - result
  const renderResultFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterScrollContent}
    >
      {RESULTS.map((result) => {
        const active = selectedResult === result;
        const color = result !== 'ALL' ? RESULT_COLORS[result] : undefined;
        return (
          <TouchableOpacity
            key={result}
            onPress={() => {
              setSelectedResult(result);
              setPage(1);
            }}
            style={[
              styles.filterPill,
              {
                backgroundColor: active ? color || c.primary : c.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                {
                  color: active ? '#ffffff' : c.foreground,
                },
              ]}
            >
              {result === 'ALL' ? t('essayGallery.results.all') : resultLabel(result)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // Clear filters button
  const renderClearFilters = () => {
    if (!hasActiveFilters) return null;
    return (
      <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
        <Ionicons name="close-circle-outline" size={16} color={c.primary} />
        <Text style={[styles.clearFiltersText, { color: c.primary }]}>
          {t('essayGallery.clearFilters')}
        </Text>
      </TouchableOpacity>
    );
  };

  // Essay card
  const renderEssayCard = ({ item, index }: { item: GalleryEssay; index: number }) => {
    const resultColor = RESULT_COLORS[item.result] || c.foregroundMuted;

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
        <AnimatedCard onPress={() => openDetail(item.id)} style={styles.essayCard}>
          <View style={styles.essayCardInner}>
            {/* Left color indicator bar */}
            <View style={[styles.resultBar, { backgroundColor: resultColor }]} />

            <View style={styles.essayCardBody}>
              {/* Top row: school + rank */}
              <View style={styles.essayCardTopRow}>
                <View style={styles.schoolInfo}>
                  <Text style={[styles.schoolName, { color: c.foreground }]} numberOfLines={1}>
                    {item.school?.name || t('essayGallery.unknownSchool')}
                  </Text>
                  {item.school?.usNewsRank && (
                    <View style={[styles.rankBadge, { backgroundColor: c.info + '20' }]}>
                      <Text style={[styles.rankText, { color: c.info }]}>
                        #{item.school.usNewsRank}
                      </Text>
                    </View>
                  )}
                </View>
                {item.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={RESULT_COLORS.ADMITTED} />
                    <Text style={[styles.verifiedText, { color: RESULT_COLORS.ADMITTED }]}>
                      {t('essayGallery.verified')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Badges row */}
              <View style={styles.badgeRow}>
                {item.essayType && <Badge variant="secondary">{typeLabel(item.essayType)}</Badge>}
                <Badge variant={resultBadgeVariant(item.result)}>{resultLabel(item.result)}</Badge>
                <Text style={[styles.yearText, { color: c.foregroundMuted }]}>{item.year}</Text>
              </View>

              {/* Preview */}
              {item.preview && (
                <Text
                  style={[styles.previewText, { color: c.foregroundSecondary }]}
                  numberOfLines={3}
                >
                  {item.preview}
                </Text>
              )}

              {/* Footer: word count + tags */}
              <View style={styles.essayCardFooter}>
                <Text style={[styles.wordCount, { color: c.foregroundMuted }]}>
                  {t('essayGallery.wordCount', { count: item.wordCount })}
                </Text>
                {item.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {item.tags.slice(0, 3).map((tag) => (
                      <View key={tag} style={[styles.tagChip, { backgroundColor: c.muted }]}>
                        <Text style={[styles.tagText, { color: c.foregroundMuted }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        </AnimatedCard>
      </Animated.View>
    );
  };

  // Pagination
  const renderPagination = () => {
    if (!gallery || gallery.totalPages <= 1) return null;
    return (
      <View style={styles.pagination}>
        <AnimatedButton
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t('essayGallery.prevPage')}
        </AnimatedButton>
        <Text style={[styles.pageText, { color: c.foreground }]}>
          {page} / {gallery.totalPages}
        </Text>
        <AnimatedButton
          variant="outline"
          size="sm"
          disabled={page >= gallery.totalPages}
          onPress={() => setPage((p) => p + 1)}
        >
          {t('essayGallery.nextPage')}
        </AnimatedButton>
      </View>
    );
  };

  // Results count
  const renderResultsCount = () => {
    if (!gallery) return null;
    return (
      <View style={styles.resultsCountRow}>
        <Text style={[styles.resultsCount, { color: c.foregroundMuted }]}>
          {t('essayGallery.resultsCount', { count: gallery.total })}
        </Text>
        {isFetching && !isLoading && (
          <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: spacing.sm }} />
        )}
      </View>
    );
  };

  // Skeleton loading
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} style={styles.skeletonItem} />
      ))}
    </View>
  );

  // List header
  const listHeader = useMemo(
    () => (
      <View>
        {renderStatsHeader()}
        <View style={styles.filtersContainer}>
          <SearchBar
            value={search}
            onChangeText={handleSearchChange}
            placeholder={t('essayGallery.searchPlaceholder')}
            style={styles.searchBar}
          />
          {renderYearFilters()}
          {renderTypeFilters()}
          {renderResultFilters()}
          {renderClearFilters()}
        </View>
        {renderResultsCount()}
      </View>
    ),
    [
      search,
      selectedYear,
      selectedType,
      selectedResult,
      gallery,
      isFetching,
      isLoading,
      c,
      t,
      hasActiveFilters,
    ]
  );

  // -------------------------------------------------------------------------
  // Detail Bottom Sheet
  // -------------------------------------------------------------------------

  const renderDetailSheet = () => {
    if (!detailVisible) return null;

    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
        {/* Backdrop */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeDetail}
          style={[styles.backdrop, { backgroundColor: c.overlay }]}
        />
        {/* Sheet */}
        <Animated.View
          entering={FadeInUp.duration(300).springify()}
          style={[
            styles.detailSheet,
            {
              backgroundColor: c.card,
              height: SCREEN_HEIGHT * 0.9,
              paddingBottom: insets.bottom || spacing.lg,
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.sheetHandle}>
            <View style={[styles.handleBar, { backgroundColor: c.border }]} />
          </View>

          {isDetailLoading || !essayDetail ? (
            <View style={styles.detailLoadingContainer}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailContent}
            >
              {/* Detail Header */}
              <View style={styles.detailHeader}>
                <View style={styles.detailHeaderTop}>
                  <Text
                    style={[styles.detailSchoolName, { color: c.foreground }]}
                    numberOfLines={2}
                  >
                    {essayDetail.school?.name || t('essayGallery.unknownSchool')}
                  </Text>
                  <TouchableOpacity onPress={closeDetail}>
                    <Ionicons name="close" size={24} color={c.foregroundMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailBadgeRow}>
                  {essayDetail.school?.usNewsRank && (
                    <View style={[styles.rankBadge, { backgroundColor: c.info + '20' }]}>
                      <Text style={[styles.rankText, { color: c.info }]}>
                        #{essayDetail.school.usNewsRank}
                      </Text>
                    </View>
                  )}
                  <Badge variant={resultBadgeVariant(essayDetail.result)}>
                    {resultLabel(essayDetail.result)}
                  </Badge>
                  {essayDetail.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={RESULT_COLORS.ADMITTED} />
                      <Text style={[styles.verifiedText, { color: RESULT_COLORS.ADMITTED }]}>
                        {t('essayGallery.verified')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Applicant stats */}
              <View style={[styles.applicantStats, { backgroundColor: c.muted }]}>
                {essayDetail.gpaRange && (
                  <View style={styles.applicantStatItem}>
                    <Text style={[styles.applicantStatLabel, { color: c.foregroundMuted }]}>
                      GPA
                    </Text>
                    <Text style={[styles.applicantStatValue, { color: c.foreground }]}>
                      {essayDetail.gpaRange}
                    </Text>
                  </View>
                )}
                {essayDetail.satRange && (
                  <View style={styles.applicantStatItem}>
                    <Text style={[styles.applicantStatLabel, { color: c.foregroundMuted }]}>
                      SAT
                    </Text>
                    <Text style={[styles.applicantStatValue, { color: c.foreground }]}>
                      {essayDetail.satRange}
                    </Text>
                  </View>
                )}
                <View style={styles.applicantStatItem}>
                  <Text style={[styles.applicantStatLabel, { color: c.foregroundMuted }]}>
                    {t('essayGallery.words')}
                  </Text>
                  <Text style={[styles.applicantStatValue, { color: c.foreground }]}>
                    {essayDetail.wordCount}
                  </Text>
                </View>
                {essayDetail.round && (
                  <View style={styles.applicantStatItem}>
                    <Text style={[styles.applicantStatLabel, { color: c.foregroundMuted }]}>
                      {t('essayGallery.round')}
                    </Text>
                    <Text style={[styles.applicantStatValue, { color: c.foreground }]}>
                      {essayDetail.round}
                    </Text>
                  </View>
                )}
              </View>

              {/* Essay prompt */}
              {essayDetail.prompt && (
                <View style={[styles.promptSection, { borderColor: c.border }]}>
                  <Text style={[styles.promptLabel, { color: c.foregroundMuted }]}>
                    {t('essayGallery.detail.essayPrompt')}
                  </Text>
                  <Text style={[styles.promptText, { color: c.foreground }]}>
                    {essayDetail.prompt}
                  </Text>
                </View>
              )}

              {/* Tab Switch */}
              <Segment
                segments={[
                  { key: 'original', label: t('essayGallery.detail.tabs.original') },
                  { key: 'analysis', label: t('essayGallery.detail.tabs.aiReview') },
                ]}
                value={detailTab}
                onChange={(key) => setDetailTab(key as 'original' | 'analysis')}
                style={styles.detailTabs}
              />

              {/* Tab Content */}
              {detailTab === 'original' ? renderOriginalText() : renderAIAnalysis()}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    );
  };

  // Original text tab
  const renderOriginalText = () => {
    if (!essayDetail?.content) {
      return (
        <View style={styles.noContentContainer}>
          <Ionicons name="document-text-outline" size={48} color={c.foregroundMuted} />
          <Text style={[styles.noContentText, { color: c.foregroundMuted }]}>
            {t('essayGallery.detail.noContent')}
          </Text>
        </View>
      );
    }

    const paragraphs = essayDetail.content.split('\n').filter((p) => p.trim().length > 0);

    return (
      <View style={styles.originalTextContainer}>
        {paragraphs.map((paragraph, idx) => (
          <Text key={idx} style={[styles.essayParagraph, { color: c.foreground }]}>
            {paragraph}
          </Text>
        ))}
      </View>
    );
  };

  // AI Analysis tab
  const renderAIAnalysis = () => {
    // Not yet analyzed
    if (!analysisMutation.data && !analysisMutation.isPending) {
      return (
        <View style={styles.analysisPrompt}>
          <Ionicons name="sparkles" size={48} color={c.primary} />
          <Text style={[styles.analysisPromptTitle, { color: c.foreground }]}>
            {t('essayGallery.detail.ai.title')}
          </Text>
          <AnimatedButton onPress={() => analysisMutation.mutate()} style={styles.analyzeButton}>
            {t('essayGallery.detail.ai.startAnalysis')}
          </AnimatedButton>
        </View>
      );
    }

    // Loading
    if (analysisMutation.isPending) {
      return (
        <View style={styles.analysisPrompt}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.analyzingText, { color: c.foregroundMuted }]}>
            {t('essayGallery.detail.ai.analyzing')}
          </Text>
        </View>
      );
    }

    const analysis = analysisMutation.data;
    if (!analysis) return null;

    return (
      <View style={styles.analysisContainer}>
        {/* Overall Score Ring */}
        <View style={styles.overallScoreSection}>
          <CircularProgress
            value={analysis.overallScore}
            size={100}
            strokeWidth={10}
            color={
              analysis.overallScore >= 80
                ? RESULT_COLORS.ADMITTED
                : analysis.overallScore >= 60
                  ? RESULT_COLORS.DEFERRED
                  : RESULT_COLORS.WAITLISTED
            }
            label={t('essayGallery.detail.analysis.score')}
          />
        </View>

        {/* Summary */}
        <View style={[styles.analysisSummary, { backgroundColor: c.muted }]}>
          <Text style={[styles.analysisSummaryLabel, { color: c.foregroundMuted }]}>
            {t('essayGallery.detail.analysis.overallComment')}
          </Text>
          <Text style={[styles.analysisSummaryText, { color: c.foreground }]}>
            {analysis.summary}
          </Text>
        </View>

        {/* Structure Checklist */}
        <View style={styles.structureSection}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>
            {t('essayGallery.detail.analysis.structureAnalysis')}
          </Text>
          <View style={[styles.structureCard, { backgroundColor: c.muted }]}>
            <StructureCheckItem
              label={t('essayGallery.detail.analysis.hookStrength')}
              checked={analysis.structure.hasStrongOpening}
              colors={c}
            />
            <StructureCheckItem
              label={t('essayGallery.detail.analysis.themeClarity')}
              checked={analysis.structure.hasClarity}
              colors={c}
            />
            <StructureCheckItem
              label={t('essayGallery.detail.analysis.endingImpact')}
              checked={analysis.structure.hasGoodConclusion}
              colors={c}
            />
          </View>
          {analysis.structure.feedback && (
            <Text style={[styles.structureFeedback, { color: c.foregroundSecondary }]}>
              {analysis.structure.feedback}
            </Text>
          )}
        </View>

        {/* Paragraph-by-paragraph review */}
        <View style={styles.paragraphReviewSection}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>
            {t('essayGallery.detail.analysis.paragraphReview')}
          </Text>
          {analysis.paragraphs.map((para) => (
            <ParagraphReviewCard
              key={para.paragraphIndex}
              paragraph={para}
              expanded={expandedParagraphs.has(para.paragraphIndex)}
              onToggle={() => toggleParagraph(para.paragraphIndex)}
              colors={c}
              statusLabel={statusLabel}
              t={t}
            />
          ))}
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ title: t('essayGallery.title') }} />

      <View style={[styles.container, { backgroundColor: c.background }]}>
        {isLoading ? (
          renderSkeleton()
        ) : !gallery || gallery.items.length === 0 ? (
          <View style={styles.emptyContainer}>
            {listHeader}
            <EmptyState
              icon="document-text-outline"
              title={t('essayGallery.noResults')}
              action={
                hasActiveFilters
                  ? { label: t('essayGallery.clearFilters'), onPress: clearFilters }
                  : undefined
              }
            />
          </View>
        ) : (
          <FlatList
            data={gallery.items}
            renderItem={renderEssayCard}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={listHeader}
            ListFooterComponent={renderPagination}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Detail Bottom Sheet (rendered as a portal-like overlay) */}
      {renderDetailSheet()}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper Components (inline, not separate files)
// ---------------------------------------------------------------------------

function StructureCheckItem({
  label,
  checked,
  colors: c,
}: {
  label: string;
  checked: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.structureCheckItem}>
      <Ionicons
        name={checked ? 'checkmark-circle' : 'close-circle'}
        size={20}
        color={checked ? RESULT_COLORS.ADMITTED : RESULT_COLORS.REJECTED}
      />
      <Text style={[styles.structureCheckLabel, { color: c.foreground }]}>{label}</Text>
    </View>
  );
}

function ParagraphReviewCard({
  paragraph,
  expanded,
  onToggle,
  colors: c,
  statusLabel,
  t,
}: {
  paragraph: ParagraphAnalysis;
  expanded: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
  statusLabel: (s: string) => string;
  t: (key: string) => string;
}) {
  const statusColor = STATUS_COLORS[paragraph.status] || c.foregroundMuted;

  return (
    <View style={[styles.paragraphCard, { borderColor: c.border }]}>
      {/* Header - always visible, tappable */}
      <TouchableOpacity onPress={onToggle} style={styles.paragraphCardHeader}>
        <View style={styles.paragraphCardHeaderLeft}>
          <View style={[styles.paragraphScoreBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.paragraphScoreText, { color: statusColor }]}>
              {paragraph.score}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusLabel(paragraph.status)}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={c.foregroundMuted}
        />
      </TouchableOpacity>

      {/* Comment */}
      <Text
        style={[styles.paragraphComment, { color: c.foregroundSecondary }]}
        numberOfLines={expanded ? undefined : 2}
      >
        {paragraph.comment}
      </Text>

      {/* Expanded content */}
      {expanded && (
        <View style={styles.paragraphExpandedContent}>
          {/* Paragraph excerpt */}
          <View style={[styles.paragraphExcerpt, { backgroundColor: c.muted }]}>
            <Text
              style={[styles.paragraphExcerptText, { color: c.foregroundSecondary }]}
              numberOfLines={4}
            >
              {paragraph.paragraphText}
            </Text>
          </View>

          {/* Highlights */}
          {paragraph.highlights.length > 0 && (
            <View style={styles.highlightsSection}>
              <Text style={[styles.highlightsTitle, { color: RESULT_COLORS.ADMITTED }]}>
                {t('essayGallery.detail.analysis.highlights')}
              </Text>
              {paragraph.highlights.map((h, i) => (
                <View key={i} style={styles.bulletItem}>
                  <Ionicons name="star" size={12} color={RESULT_COLORS.ADMITTED} />
                  <Text style={[styles.bulletText, { color: c.foreground }]}>{h}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Suggestions */}
          {paragraph.suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={[styles.suggestionsTitle, { color: RESULT_COLORS.WAITLISTED }]}>
                {t('essayGallery.detail.analysis.suggestions')}
              </Text>
              {paragraph.suggestions.map((s, i) => (
                <View key={i} style={styles.bulletItem}>
                  <Ionicons name="bulb" size={12} color={RESULT_COLORS.WAITLISTED} />
                  <Text style={[styles.bulletText, { color: c.foreground }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 32,
  },

  // Filters
  filtersContainer: {
    marginBottom: spacing.sm,
  },
  searchBar: {
    marginBottom: spacing.md,
  },
  filterScroll: {
    marginBottom: spacing.sm,
  },
  filterScrollContent: {
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  filterPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  clearFiltersText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // Results count
  resultsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resultsCount: {
    fontSize: fontSize.sm,
  },

  // Essay card
  essayCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  essayCardInner: {
    flexDirection: 'row',
  },
  resultBar: {
    width: 4,
    borderTopLeftRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.lg,
  },
  essayCardBody: {
    flex: 1,
    padding: spacing.lg,
  },
  essayCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    flexShrink: 1,
  },
  rankBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  rankText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifiedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  yearText: {
    fontSize: fontSize.xs,
  },
  previewText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing.sm,
  },
  essayCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordCount: {
    fontSize: fontSize.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: 10,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  pageText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Skeleton
  skeletonContainer: {
    padding: spacing.lg,
  },
  skeletonItem: {
    marginBottom: spacing.md,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Detail Bottom Sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  detailLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  // Detail header
  detailHeader: {
    marginBottom: spacing.lg,
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  detailSchoolName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    flex: 1,
    marginRight: spacing.md,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },

  // Applicant stats
  applicantStats: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  applicantStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  applicantStatLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  applicantStatValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },

  // Prompt
  promptSection: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  promptLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  promptText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
  },

  // Detail tabs
  detailTabs: {
    marginBottom: spacing.lg,
  },

  // Original text
  noContentContainer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  noContentText: {
    fontSize: fontSize.sm,
  },
  originalTextContainer: {
    gap: spacing.lg,
  },
  essayParagraph: {
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.75,
  },

  // AI Analysis
  analysisPrompt: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.lg,
  },
  analysisPromptTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  analyzeButton: {
    minWidth: 200,
  },
  analyzingText: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  analysisContainer: {
    gap: spacing.lg,
  },

  // Overall score
  overallScoreSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  // Summary
  analysisSummary: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  analysisSummaryLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  analysisSummaryText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
  },

  // Structure
  structureSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  structureCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  structureCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  structureCheckLabel: {
    fontSize: fontSize.sm,
  },
  structureFeedback: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    paddingHorizontal: spacing.xs,
  },

  // Paragraph review
  paragraphReviewSection: {
    gap: spacing.md,
  },
  paragraphCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  paragraphCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  paragraphCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paragraphScoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paragraphScoreText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  paragraphComment: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  paragraphExpandedContent: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  paragraphExcerpt: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  paragraphExcerptText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
    fontStyle: 'italic',
  },
  highlightsSection: {
    gap: spacing.xs,
  },
  highlightsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  suggestionsSection: {
    gap: spacing.xs,
  },
  suggestionsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  bulletText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    flex: 1,
  },
});
