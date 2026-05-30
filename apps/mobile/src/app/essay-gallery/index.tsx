/**
 * Essay Gallery Page
 *
 * Browsable gallery of admission essays with search, filters, and AI analysis.
 * Thin orchestrator: list + filters + modal state.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedCounter,
  EmptyState,
  SearchBar,
  SkeletonCard,
  AnimatedButton,
} from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius, fontFamily } from '@/utils/theme';
import { essayAiRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import type { GalleryResponse, GalleryEssay } from '@/screens/essay-gallery/types';
import {
  useResultColors,
  ESSAY_TYPES,
  RESULTS,
  YEARS,
  PAGE_SIZE,
} from '@/screens/essay-gallery/types';
import { EssayCard } from '@/screens/essay-gallery/EssayCard';
import { DetailSheet } from '@/screens/essay-gallery/DetailSheet';

export default function EssayGalleryPage() {
  const { t } = useTranslation();
  const c = useColors();
  const resultColors = useResultColors();
  const insets = useSafeAreaInsets();

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
    queryFn: () => apiClient.get<GalleryResponse>(essayAiRoutes.gallery(), { params: queryParams }),
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
    setDetailVisible(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedEssayId(null);
  }, []);

  // -------------------------------------------------------------------------
  // Label helpers
  // -------------------------------------------------------------------------

  const yearLabel = useCallback(
    (y: number) => (y === 0 ? t('essayGallery.allYears') : String(y)),
    [t]
  );

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

  const resultLabel = useCallback(
    (result: string) => {
      const map: Record<string, string> = {
        ADMITTED: t('essayGallery.results.admitted'),
        REJECTED: t('essayGallery.results.rejected'),
        WAITLISTED: t('essayGallery.results.waitlisted'),
        DEFERRED: t('essayGallery.results.deferred'),
      };
      return map[result] || result;
    },
    [t]
  );

  // -------------------------------------------------------------------------
  // Sub-renders
  // -------------------------------------------------------------------------

  const renderStatsHeader = () => {
    if (!gallery?.stats) return null;
    const { total, admitted, top20 } = gallery.stats;
    return (
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[S.statsRow, { borderBottomColor: c.border }]}
      >
        <View style={S.statItem}>
          <AnimatedCounter value={total} style={[S.statValue, { color: c.primary }]} />
          <Text style={[S.statLabel, { color: c.foregroundMuted }]}>
            {t('essayGallery.stats.total')}
          </Text>
        </View>
        <View style={[S.statDivider, { backgroundColor: c.border }]} />
        <View style={S.statItem}>
          <AnimatedCounter
            value={admitted}
            style={[S.statValue, { color: resultColors.ADMITTED }]}
          />
          <Text style={[S.statLabel, { color: c.foregroundMuted }]}>
            {t('essayGallery.stats.admitted')}
          </Text>
        </View>
        <View style={[S.statDivider, { backgroundColor: c.border }]} />
        <View style={S.statItem}>
          <AnimatedCounter value={top20} style={[S.statValue, { color: c.info }]} />
          <Text style={[S.statLabel, { color: c.foregroundMuted }]}>
            {t('essayGallery.stats.top20')}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderYearFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={S.filterScroll}
      contentContainerStyle={S.filterScrollContent}
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
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={yearLabel(y)}
            style={[S.filterPill, { backgroundColor: active ? c.primary : c.muted }]}
          >
            <Text
              style={[S.filterPillText, { color: active ? c.primaryForeground : c.foreground }]}
            >
              {yearLabel(y)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderTypeFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={S.filterScroll}
      contentContainerStyle={S.filterScrollContent}
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
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={typeLabel(type)}
            style={[S.filterPill, { backgroundColor: active ? c.primary : c.muted }]}
          >
            <Text
              style={[S.filterPillText, { color: active ? c.primaryForeground : c.foreground }]}
            >
              {typeLabel(type)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderResultFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={S.filterScroll}
      contentContainerStyle={S.filterScrollContent}
    >
      {RESULTS.map((result) => {
        const active = selectedResult === result;
        const color = result !== 'ALL' ? resultColors[result] : undefined;
        return (
          <TouchableOpacity
            key={result}
            onPress={() => {
              setSelectedResult(result);
              setPage(1);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              result === 'ALL' ? t('essayGallery.results.all') : resultLabel(result)
            }
            style={[S.filterPill, { backgroundColor: active ? color || c.primary : c.muted }]}
          >
            <Text style={[S.filterPillText, { color: active ? c.onGradient : c.foreground }]}>
              {result === 'ALL' ? t('essayGallery.results.all') : resultLabel(result)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderClearFilters = () => {
    if (!hasActiveFilters) return null;
    return (
      <TouchableOpacity
        onPress={clearFilters}
        style={S.clearFiltersBtn}
        accessibilityRole="button"
        accessibilityLabel={t('essayGallery.clearFilters')}
      >
        <Ionicons name="close-circle-outline" size={16} color={c.primary} />
        <Text style={[S.clearFiltersText, { color: c.primary }]}>
          {t('essayGallery.clearFilters')}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEssayCard = useCallback(
    ({ item, index }: { item: GalleryEssay; index: number }) => (
      <EssayCard item={item} index={index} onPress={openDetail} />
    ),
    [openDetail]
  );

  const renderPagination = () => {
    if (!gallery || gallery.totalPages <= 1) return null;
    return (
      <View style={S.pagination}>
        <AnimatedButton
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t('essayGallery.prevPage')}
        </AnimatedButton>
        <Text style={[S.pageText, { color: c.foreground }]}>
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

  const renderResultsCount = () => {
    if (!gallery) return null;
    return (
      <View style={S.resultsCountRow}>
        <Text style={[S.resultsCount, { color: c.foregroundMuted }]}>
          {t('essayGallery.resultsCount', { count: gallery.total })}
        </Text>
        {isFetching && !isLoading && (
          <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: spacing.sm }} />
        )}
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={S.skeletonContainer}>
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} style={S.skeletonItem} />
      ))}
    </View>
  );

  const listHeader = useMemo(
    () => (
      <View>
        {renderStatsHeader()}
        <View style={S.filtersContainer}>
          <SearchBar
            value={search}
            onChangeText={handleSearchChange}
            placeholder={t('essayGallery.searchPlaceholder')}
            style={S.searchBar}
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
  // Main Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ title: t('essayGallery.title') }} />

      <View style={[S.container, { backgroundColor: c.background }]}>
        {isLoading ? (
          renderSkeleton()
        ) : !gallery || gallery.items.length === 0 ? (
          <View style={S.emptyContainer}>
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
            contentContainerStyle={[S.listContent, { paddingBottom: insets.bottom + spacing.lg }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Detail Bottom Sheet */}
      {detailVisible && selectedEssayId && (
        <DetailSheet essayId={selectedEssayId} onClose={closeDetail} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
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
    fontFamily: fontFamily.mono,
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
    fontFamily: fontFamily.mono,
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
});
