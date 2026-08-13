import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SchoolAvatar } from '@/components/features/SchoolAvatar';
import {
  AnimatedCard,
  Badge,
  CardContent,
  EmptyState,
  Loading,
  RankingBadge,
  SearchBar,
  Skeleton,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedSearch, usePaginatedQuery } from '@/hooks/api';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import type { School } from '@/types';
import { formatAcceptanceRate } from '@/utils/format';
import { fontFamily, spacing, useColors, withOpacity } from '@/utils/theme';
import { API_ROUTES, schoolListRoutes } from '@study-abroad/shared';
import { styles } from './find-college.styles';

import {
  DEFAULT_FILTERS,
  FilterModal,
  PAGE_LIMIT,
  type Filters,
} from '@/components/features/find-college/FilterModal';

// ============== Helpers ==============

function formatTuition(tuition: number): string {
  if (tuition == null || !Number.isFinite(tuition)) return '—';
  if (tuition >= 1000) {
    return `$${(tuition / 1000).toFixed(0)}k`;
  }
  return `$${tuition.toLocaleString()}`;
}

// formatAcceptanceRate imported from @/utils/format

// ============== Main Page ==============

export default function FindCollegePage() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Search state
  const { search, debouncedSearch, handleSearchChange } = useDebouncedSearch();

  // Filter state
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.minRank || appliedFilters.maxRank) count++;
    if (appliedFilters.minTuition || appliedFilters.maxTuition) count++;
    if (appliedFilters.minAcceptanceRate || appliedFilters.maxAcceptanceRate) count++;
    if (appliedFilters.state) count++;
    if (appliedFilters.type && appliedFilters.type !== 'all') count++;
    return count;
  }, [appliedFilters]);

  // Active filter tags for display
  const activeFilterTags = useMemo(() => {
    const tags: { key: string; label: string }[] = [];

    if (appliedFilters.minRank || appliedFilters.maxRank) {
      const min = appliedFilters.minRank || '1';
      const max = appliedFilters.maxRank || '200';
      tags.push({
        key: 'rank',
        label: t('findCollege.tags.rank', { min, max }),
      });
    }

    if (appliedFilters.minTuition || appliedFilters.maxTuition) {
      const min = appliedFilters.minTuition
        ? formatTuition(Number(appliedFilters.minTuition))
        : '$0';
      const max = appliedFilters.maxTuition
        ? formatTuition(Number(appliedFilters.maxTuition))
        : '$80k';
      tags.push({
        key: 'tuition',
        label: t('findCollege.tags.tuition', {
          min,
          max,
        }),
      });
    }

    if (appliedFilters.minAcceptanceRate || appliedFilters.maxAcceptanceRate) {
      const min = appliedFilters.minAcceptanceRate || '0';
      const max = appliedFilters.maxAcceptanceRate || '100';
      tags.push({
        key: 'acceptance',
        label: t('findCollege.tags.acceptance', {
          min,
          max,
        }),
      });
    }

    if (appliedFilters.state) {
      tags.push({ key: 'state', label: appliedFilters.state });
    }

    if (appliedFilters.type && appliedFilters.type !== 'all') {
      tags.push({
        key: 'type',
        label:
          appliedFilters.type === 'private'
            ? t('findCollege.filters.typePrivate')
            : t('findCollege.filters.typePublic'),
      });
    }

    return tags;
  }, [appliedFilters, t]);

  const removeFilterTag = (key: string) => {
    setAppliedFilters((prev) => {
      const next = { ...prev };
      switch (key) {
        case 'rank':
          next.minRank = '';
          next.maxRank = '';
          break;
        case 'tuition':
          next.minTuition = '';
          next.maxTuition = '';
          break;
        case 'acceptance':
          next.minAcceptanceRate = '';
          next.maxAcceptanceRate = '';
          break;
        case 'state':
          next.state = '';
          break;
        case 'type':
          next.type = 'all';
          break;
      }
      return next;
    });
    setFilters((prev) => {
      const next = { ...prev };
      switch (key) {
        case 'rank':
          next.minRank = '';
          next.maxRank = '';
          break;
        case 'tuition':
          next.minTuition = '';
          next.maxTuition = '';
          break;
        case 'acceptance':
          next.minAcceptanceRate = '';
          next.maxAcceptanceRate = '';
          break;
        case 'state':
          next.state = '';
          break;
        case 'type':
          next.type = 'all';
          break;
      }
      return next;
    });
  };

  // ============== Queries ==============

  // Build the filter→param map (renames the form fields to the API's param names).
  const schoolParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {
      search: debouncedSearch || undefined,
    };
    if (appliedFilters.minRank) params.rankMin = Number(appliedFilters.minRank);
    if (appliedFilters.maxRank) params.rankMax = Number(appliedFilters.maxRank);
    if (appliedFilters.minTuition) params.tuitionMin = Number(appliedFilters.minTuition);
    if (appliedFilters.maxTuition) params.tuitionMax = Number(appliedFilters.maxTuition);
    if (appliedFilters.minAcceptanceRate)
      params.acceptanceMin = Number(appliedFilters.minAcceptanceRate);
    if (appliedFilters.maxAcceptanceRate)
      params.acceptanceMax = Number(appliedFilters.maxAcceptanceRate);
    if (appliedFilters.state) params.state = appliedFilters.state;
    if (appliedFilters.type && appliedFilters.type !== 'all') {
      params.schoolType = appliedFilters.type;
    }
    return params;
  }, [debouncedSearch, appliedFilters]);

  // Fetch schools (infinite scroll). `reference` tier caches the catalog so revisits
  // are instant; usePaginatedQuery bakes in keepPreviousData so the list never blanks
  // to a skeleton when the search term or filters change.
  const {
    items: schools,
    total: totalResults,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = usePaginatedQuery<School>({
    queryKey: qk.findCollege.list(debouncedSearch, appliedFilters),
    endpoint: '/schools',
    params: schoolParams,
    limit: PAGE_LIMIT,
    cacheTier: 'reference',
  });

  // Fetch user's school list to determine "in list" state
  const { data: schoolListData } = useQuery({
    queryKey: qk.schoolList.all,
    queryFn: () =>
      apiClient.get<{ id: string; schoolId: string; school: School }[]>(API_ROUTES.SCHOOL_LISTS),
  });

  const schoolListIds = useMemo(() => {
    const ids = new Set<string>();
    if (schoolListData) {
      for (const item of schoolListData) {
        ids.add(item.schoolId);
      }
    }
    return ids;
  }, [schoolListData]);

  // Add to school list mutation
  const addToListMutation = useMutation({
    mutationFn: (schoolId: string) => apiClient.post(API_ROUTES.SCHOOL_LISTS, { schoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.schoolList.all });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('findCollege.addedToList'));
    },
    onError: () => {
      toast.error(t('findCollege.addError'));
    },
  });

  // Remove from school list mutation. DELETE /school-lists/:id expects the
  // SchoolListItem PK, not the schoolId — resolve it from the cached list.
  const removeFromListMutation = useMutation({
    mutationFn: (schoolId: string) => {
      const item = (schoolListData ?? []).find((i) => i.schoolId === schoolId);
      if (!item) return Promise.reject(new Error('SCHOOL_NOT_IN_LIST'));
      return apiClient.delete(schoolListRoutes.byId(item.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.schoolList.all });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.info(t('findCollege.removedFromList'));
    },
    onError: () => {
      toast.error(t('findCollege.removeError'));
    },
  });

  const toggleSchoolList = useCallback(
    (schoolId: string) => {
      if (schoolListIds.has(schoolId)) {
        removeFromListMutation.mutate(schoolId);
      } else {
        addToListMutation.mutate(schoolId);
      }
    },
    [schoolListIds, addToListMutation, removeFromListMutation]
  );

  // ============== Filter Handlers ==============

  const handleApplyFilters = (newFilters: Filters) => {
    setFilters(newFilters);
    setAppliedFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  // ============== Filter Chips ==============

  const filterChips = [
    {
      key: 'rank',
      label: t('findCollege.chips.rank'),
      icon: 'trophy-outline' as const,
    },
    {
      key: 'tuition',
      label: t('findCollege.chips.tuition'),
      icon: 'cash-outline' as const,
    },
    {
      key: 'acceptance',
      label: t('findCollege.chips.acceptance'),
      icon: 'stats-chart-outline' as const,
    },
    {
      key: 'state',
      label: t('findCollege.chips.state'),
      icon: 'location-outline' as const,
    },
    {
      key: 'type',
      label: t('findCollege.chips.type'),
      icon: 'school-outline' as const,
    },
  ];

  const isChipActive = (key: string): boolean => {
    switch (key) {
      case 'rank':
        return !!(appliedFilters.minRank || appliedFilters.maxRank);
      case 'tuition':
        return !!(appliedFilters.minTuition || appliedFilters.maxTuition);
      case 'acceptance':
        return !!(appliedFilters.minAcceptanceRate || appliedFilters.maxAcceptanceRate);
      case 'state':
        return !!appliedFilters.state;
      case 'type':
        return !!(appliedFilters.type && appliedFilters.type !== 'all');
      default:
        return false;
    }
  };

  // ============== Render Items ==============

  const renderSchoolCard = useCallback(
    ({ item, index }: { item: School; index: number }) => {
      const isInList = schoolListIds.has(item.id);
      const isMutating = addToListMutation.isPending || removeFromListMutation.isPending;

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 50).duration(300)}
          style={styles.cardWrapper}
        >
          <AnimatedCard onPress={() => router.push(`/school/${item.id}`)} hapticFeedback>
            <CardContent style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <View style={styles.mediaStack}>
                  {item.media?.campusCover?.url ? (
                    <Image
                      source={{ uri: item.media.campusCover.url }}
                      style={[styles.coverThumb, { backgroundColor: colors.muted }]}
                      resizeMode="cover"
                    />
                  ) : null}
                  <SchoolAvatar
                    name={item.name}
                    logoUrl={item.media?.logo?.url ?? item.logoUrl}
                    website={item.website}
                    size="lg"
                    style={item.media?.campusCover?.url ? styles.logoOverlay : undefined}
                  />
                </View>
                <View style={styles.schoolInfo}>
                  <Text style={[styles.schoolName, { color: colors.foreground }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.nameZh && (
                    <Text
                      style={[styles.schoolNameZh, { color: colors.foregroundMuted }]}
                      numberOfLines={1}
                    >
                      {item.nameZh}
                    </Text>
                  )}
                  {(item.city || item.state) && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={12} color={colors.foregroundMuted} />
                      <Text
                        style={[styles.locationText, { color: colors.foregroundMuted }]}
                        numberOfLines={1}
                      >
                        {[item.city, item.state].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Heart / List Toggle */}
                <TouchableOpacity
                  onPress={() => toggleSchoolList(item.id)}
                  disabled={isMutating}
                  style={styles.heartButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isInList ? t('findCollege.removedFromList') : t('findCollege.addedToList')
                  }
                  accessibilityState={{ selected: isInList }}
                >
                  <Ionicons
                    name={isInList ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isInList ? colors.error : colors.foregroundMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <RankingBadge rankings={item.rankings} usNewsRank={item.usNewsRank} />
                {item.acceptanceRate != null && (
                  <Badge variant="outline">{formatAcceptanceRate(item.acceptanceRate)}</Badge>
                )}
                {item.tuition != null && (
                  <Badge variant="secondary">{formatTuition(item.tuition)}</Badge>
                )}
              </View>
            </CardContent>
          </AnimatedCard>
        </Animated.View>
      );
    },
    [
      colors,
      schoolListIds,
      toggleSchoolList,
      addToListMutation.isPending,
      removeFromListMutation.isPending,
      t,
    ]
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <Loading size="small" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.cardWrapper}>
              <View
                style={[
                  styles.skeletonCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Skeleton width={56} height={56} borderRadius={28} />
                    <View style={styles.schoolInfo}>
                      <Skeleton width="80%" height={18} />
                      <Skeleton width="50%" height={14} style={styles.skeletonMarginTop} />
                      <Skeleton width="40%" height={12} style={styles.skeletonMarginTopSmall} />
                    </View>
                  </View>
                  <View style={[styles.statsRow, { marginTop: spacing.md }]}>
                    <Skeleton width={50} height={24} borderRadius={12} />
                    <Skeleton width={50} height={24} borderRadius={12} />
                    <Skeleton width={50} height={24} borderRadius={12} />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    return (
      <EmptyState
        icon="search-outline"
        title={t('findCollege.noResults')}
        description={t('findCollege.noResultsDescription')}
        action={
          activeFilterCount > 0
            ? {
                label: t('findCollege.clearFilters'),
                onPress: handleResetFilters,
              }
            : undefined
        }
      />
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('findCollege.title'),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
          <SearchBar
            value={search}
            onChangeText={handleSearchChange}
            placeholder={t('findCollege.searchPlaceholder')}
            style={styles.searchBar}
          />
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={[styles.filterButton, { backgroundColor: colors.muted }]}
            accessibilityRole="button"
            accessibilityLabel={t('findCollege.filters.title')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="options" size={20} color={colors.foreground} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text
                  style={[
                    styles.filterBadgeText,
                    { color: colors.primaryForeground, fontFamily: fontFamily.mono },
                  ]}
                >
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Filter Chips - Horizontally Scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          style={styles.chipsScroll}
        >
          {filterChips.map((chip) => {
            const active = isChipActive(chip.key);
            return (
              <TouchableOpacity
                key={chip.key}
                onPress={() => setFilterModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={chip.label}
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  active
                    ? {
                        backgroundColor: withOpacity(colors.primary, 0.08),
                        borderColor: colors.primary,
                      }
                    : { backgroundColor: colors.muted },
                ]}
              >
                <Ionicons
                  name={chip.icon}
                  size={14}
                  color={active ? colors.primary : colors.foregroundMuted}
                  style={styles.chipIcon}
                />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? colors.primary : colors.foregroundSecondary,
                    },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Active Filter Tags */}
        {activeFilterTags.length > 0 && (
          <View style={styles.tagsContainer}>
            {activeFilterTags.map((tag) => (
              <TouchableOpacity
                key={tag.key}
                onPress={() => removeFilterTag(tag.key)}
                accessibilityRole="button"
                accessibilityLabel={tag.label}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[
                  styles.tag,
                  {
                    backgroundColor: withOpacity(colors.primary, 0.0625),
                    borderColor: withOpacity(colors.primary, 0.19),
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: colors.primary }]}>{tag.label}</Text>
                <Ionicons
                  name="close-circle"
                  size={14}
                  color={colors.primary}
                  style={styles.tagCloseIcon}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Results Count */}
        {!isLoading && schools.length > 0 && (
          <View style={styles.resultCountContainer}>
            <Text style={[styles.resultCountText, { color: colors.foregroundMuted }]}>
              {t('findCollege.resultsCount', {
                count: totalResults,
              })}
            </Text>
          </View>
        )}

        {/* School List */}
        <FlatList
          data={schools}
          renderItem={renderSchoolCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Filter Modal */}
        <FilterModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          filters={filters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      </View>
    </>
  );
}

// ============== Styles ==============
