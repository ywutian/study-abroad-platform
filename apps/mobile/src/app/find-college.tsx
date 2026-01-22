import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import debounce from 'lodash.debounce';

import {
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  Avatar,
  SearchBar,
  Skeleton,
  AnimatedButton,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { School, PaginatedResponse } from '@/types';

// ============== Constants ==============

const US_STATES = [
  'California',
  'New York',
  'Massachusetts',
  'Texas',
  'Pennsylvania',
  'Illinois',
  'Florida',
  'Michigan',
  'Ohio',
  'Georgia',
  'North Carolina',
  'Virginia',
  'Washington',
  'Maryland',
  'Connecticut',
  'New Jersey',
  'Indiana',
  'Minnesota',
  'Wisconsin',
  'Colorado',
];

const SCHOOL_TYPE_OPTIONS = [
  { value: 'all', labelKey: 'findCollege.filters.typeAll' },
  { value: 'private', labelKey: 'findCollege.filters.typePrivate' },
  { value: 'public', labelKey: 'findCollege.filters.typePublic' },
];

const PAGE_LIMIT = 20;

// ============== Types ==============

interface Filters {
  minRank: string;
  maxRank: string;
  minTuition: string;
  maxTuition: string;
  minAcceptanceRate: string;
  maxAcceptanceRate: string;
  state: string;
  type: string;
}

const DEFAULT_FILTERS: Filters = {
  minRank: '',
  maxRank: '',
  minTuition: '',
  maxTuition: '',
  minAcceptanceRate: '',
  maxAcceptanceRate: '',
  state: '',
  type: 'all',
};

// ============== Filter Modal ==============

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (filters: Filters) => void;
  onReset: () => void;
}

function FilterModal({ visible, onClose, filters, onApply, onReset }: FilterModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const [draft, setDraft] = useState<Filters>(filters);

  // Sync draft when modal opens
  React.useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [visible, filters]);

  const updateDraft = (key: keyof Filters, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const stateOptions = [
    { value: '', label: t('findCollege.filters.allStates', 'All States') },
    ...US_STATES.map((s) => ({ value: s, label: s })),
  ];

  const typeOptions = SCHOOL_TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.labelKey, o.value === 'all' ? 'All' : o.value === 'private' ? 'Private' : 'Public'),
  }));

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS);
    onReset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t('findCollege.filters.title', 'Filters')}
      footer={
        <>
          <AnimatedButton variant="outline" onPress={handleReset} style={styles.filterActionButton}>
            {t('findCollege.filters.reset', 'Reset')}
          </AnimatedButton>
          <AnimatedButton onPress={handleApply} style={styles.filterActionButton}>
            {t('findCollege.filters.apply', 'Apply')}
          </AnimatedButton>
        </>
      }
    >
      {/* Rank Range */}
      <Text style={[styles.filterSectionLabel, { color: colors.foreground }]}>
        {t('findCollege.filters.rankRange', 'US News Rank')}
      </Text>
      <View style={styles.rangeRow}>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder={t('findCollege.filters.min', 'Min')}
            placeholderTextColor={colors.placeholder}
            value={draft.minRank}
            onChangeText={(v) => updateDraft('minRank', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <Text style={[styles.rangeSeparator, { color: colors.foregroundMuted }]}>-</Text>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder={t('findCollege.filters.max', 'Max')}
            placeholderTextColor={colors.placeholder}
            value={draft.maxRank}
            onChangeText={(v) => updateDraft('maxRank', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>

      {/* Tuition Range */}
      <Text style={[styles.filterSectionLabel, { color: colors.foreground }]}>
        {t('findCollege.filters.tuitionRange', 'Tuition (USD)')}
      </Text>
      <View style={styles.rangeRow}>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="$0"
            placeholderTextColor={colors.placeholder}
            value={draft.minTuition}
            onChangeText={(v) => updateDraft('minTuition', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
        <Text style={[styles.rangeSeparator, { color: colors.foregroundMuted }]}>-</Text>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="$80,000"
            placeholderTextColor={colors.placeholder}
            value={draft.maxTuition}
            onChangeText={(v) => updateDraft('maxTuition', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      </View>

      {/* Acceptance Rate Range */}
      <Text style={[styles.filterSectionLabel, { color: colors.foreground }]}>
        {t('findCollege.filters.acceptanceRate', 'Acceptance Rate (%)')}
      </Text>
      <View style={styles.rangeRow}>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="0%"
            placeholderTextColor={colors.placeholder}
            value={draft.minAcceptanceRate}
            onChangeText={(v) => updateDraft('minAcceptanceRate', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <Text style={[styles.rangeSeparator, { color: colors.foregroundMuted }]}>-</Text>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="100%"
            placeholderTextColor={colors.placeholder}
            value={draft.maxAcceptanceRate}
            onChangeText={(v) => updateDraft('maxAcceptanceRate', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>

      {/* State */}
      <Select
        label={t('findCollege.filters.state', 'State / Region')}
        options={stateOptions}
        value={draft.state}
        onChange={(v) => updateDraft('state', v)}
        placeholder={t('findCollege.filters.allStates', 'All States')}
      />

      {/* School Type */}
      <Select
        label={t('findCollege.filters.type', 'School Type')}
        options={typeOptions}
        value={draft.type}
        onChange={(v) => updateDraft('type', v)}
      />
    </Modal>
  );
}

// ============== Helpers ==============

function formatTuition(tuition: number): string {
  if (tuition >= 1000) {
    return `$${(tuition / 1000).toFixed(0)}k`;
  }
  return `$${tuition.toLocaleString()}`;
}

function formatAcceptanceRate(rate: number): string {
  // API may return as decimal (0.05) or percentage (5)
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(1)}%`;
}

// ============== Main Page ==============

export default function FindCollegePage() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Search state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    debouncedSetSearch(value);
  };

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
        label: t('findCollege.tags.rank', 'Rank {{min}}-{{max}}', { min, max }),
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
        label: t('findCollege.tags.tuition', 'Tuition {{min}}-{{max}}', {
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
        label: t('findCollege.tags.acceptance', '{{min}}%-{{max}}% Acceptance', {
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
            ? t('findCollege.filters.typePrivate', 'Private')
            : t('findCollege.filters.typePublic', 'Public'),
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

  // Fetch schools with infinite query
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ['find-college-schools', debouncedSearch, appliedFilters],
      queryFn: async ({ pageParam = 1 }) => {
        const params: Record<string, string | number | boolean | undefined> = {
          page: pageParam,
          limit: PAGE_LIMIT,
          search: debouncedSearch || undefined,
        };

        if (appliedFilters.minRank) params.minRank = Number(appliedFilters.minRank);
        if (appliedFilters.maxRank) params.maxRank = Number(appliedFilters.maxRank);
        if (appliedFilters.minTuition) params.minTuition = Number(appliedFilters.minTuition);
        if (appliedFilters.maxTuition) params.maxTuition = Number(appliedFilters.maxTuition);
        if (appliedFilters.minAcceptanceRate)
          params.minAcceptanceRate = Number(appliedFilters.minAcceptanceRate);
        if (appliedFilters.maxAcceptanceRate)
          params.maxAcceptanceRate = Number(appliedFilters.maxAcceptanceRate);
        if (appliedFilters.state) params.state = appliedFilters.state;
        if (appliedFilters.type && appliedFilters.type !== 'all') params.type = appliedFilters.type;

        return apiClient.get<PaginatedResponse<School>>('/schools', { params });
      },
      getNextPageParam: (lastPage) => {
        if (lastPage.page < lastPage.totalPages) {
          return lastPage.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
    });

  const schools = data?.pages.flatMap((page) => page.items) || [];
  const totalResults = data?.pages[0]?.total ?? 0;

  // Fetch user's school list to determine "in list" state
  const { data: schoolListData } = useQuery({
    queryKey: ['school-list'],
    queryFn: () => apiClient.get<{ schoolId: string; school: School }[]>('/school-lists'),
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
    mutationFn: (schoolId: string) => apiClient.post('/school-lists', { schoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-list'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('findCollege.addedToList', 'Added to your school list'));
    },
    onError: () => {
      toast.error(t('findCollege.addError', 'Failed to add school to list'));
    },
  });

  // Remove from school list mutation
  const removeFromListMutation = useMutation({
    mutationFn: (schoolId: string) => apiClient.delete(`/school-lists/${schoolId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-list'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.info(t('findCollege.removedFromList', 'Removed from your school list'));
    },
    onError: () => {
      toast.error(t('findCollege.removeError', 'Failed to remove school from list'));
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
      label: t('findCollege.chips.rank', 'Rank'),
      icon: 'trophy-outline' as const,
    },
    {
      key: 'tuition',
      label: t('findCollege.chips.tuition', 'Tuition'),
      icon: 'cash-outline' as const,
    },
    {
      key: 'acceptance',
      label: t('findCollege.chips.acceptance', 'Acceptance'),
      icon: 'stats-chart-outline' as const,
    },
    {
      key: 'state',
      label: t('findCollege.chips.state', 'State'),
      icon: 'location-outline' as const,
    },
    {
      key: 'type',
      label: t('findCollege.chips.type', 'Type'),
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
                <Avatar source={item.logoUrl} name={item.name} size="lg" />
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
                {item.usNewsRank != null && <Badge variant="default">#{item.usNewsRank}</Badge>}
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
                      <Skeleton width="50%" height={14} style={{ marginTop: 8 }} />
                      <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
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
        title={t('findCollege.noResults', 'No schools found')}
        description={t('findCollege.noResultsDescription', 'Try adjusting your search or filters')}
        action={
          activeFilterCount > 0
            ? {
                label: t('findCollege.clearFilters', 'Clear Filters'),
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
          title: t('findCollege.title', 'Find College'),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
          <SearchBar
            value={search}
            onChangeText={handleSearchChange}
            placeholder={t('findCollege.searchPlaceholder', 'Search schools by name...')}
            style={styles.searchBar}
          />
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={[styles.filterButton, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="options" size={20} color={colors.foreground} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
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
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary + '15' : colors.muted,
                    borderColor: active ? colors.primary : 'transparent',
                  },
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
                style={[
                  styles.tag,
                  {
                    backgroundColor: colors.primary + '10',
                    borderColor: colors.primary + '30',
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
              {t('findCollege.resultsCount', '{{count}} schools found', {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flex: 1,
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },

  // Filter Chips
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: spacing.xs,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Active Filter Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  tagCloseIcon: {
    marginLeft: spacing.xs,
  },

  // Results count
  resultCountContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  resultCountText: {
    fontSize: fontSize.sm,
  },

  // List
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  schoolNameZh: {
    fontSize: fontSize.sm,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: fontSize.xs,
  },
  heartButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },

  // Loading / Footer
  loadingContainer: {
    flex: 1,
  },
  skeletonCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },

  // Filter Modal
  filterSectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rangeInputWrapper: {
    flex: 1,
  },
  rangeInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    minHeight: 44,
  },
  rangeSeparator: {
    marginHorizontal: spacing.sm,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  filterActionButton: {
    flex: 1,
  },
});
