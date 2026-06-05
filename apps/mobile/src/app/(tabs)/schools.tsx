import React, { useState, memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  SearchBar,
  RankingBadge,
  Loading,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { SchoolAvatar } from '@/components/features/SchoolAvatar';
import { BottomSheet } from '@/components/ui/Modal';
import { useDebouncedSearch, usePaginatedQuery } from '@/hooks/api';
import { qk, cachePolicy } from '@/lib/query';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
} from '@/utils/theme';
import { formatAcceptanceRate } from '@/utils/format';
import type { School } from '@/types';

interface SchoolListItemProps {
  item: School;
  colors: ReturnType<typeof useColors>;
}

const SchoolListItem = memo(function SchoolListItem({ item, colors }: SchoolListItemProps) {
  const acc =
    item.acceptanceRate != null ? formatAcceptanceRate(Number(item.acceptanceRate)) : null;
  return (
    <TouchableOpacity
      onPress={() => router.push(`/school/${item.id}`)}
      style={styles.cardWrapper}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <Card>
        <CardContent style={styles.cardContent}>
          <View style={styles.mediaStack}>
            {item.media?.campusCover?.url ? (
              <Image
                source={{ uri: item.media.campusCover.url }}
                style={[styles.coverThumb, { backgroundColor: colors.muted }]}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
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
            <Text
              style={[styles.schoolLocation, { color: colors.foregroundMuted }]}
              numberOfLines={1}
            >
              {item.city}, {item.state}
            </Text>
            <View style={styles.badges}>
              <RankingBadge rankings={item.rankings} usNewsRank={item.usNewsRank} />
              {acc ? (
                <View style={[styles.accBadge, { backgroundColor: colors.backgroundTertiary }]}>
                  <Text
                    style={[
                      styles.accBadgeText,
                      { color: colors.foregroundSecondary, fontFamily: fontFamily.mono },
                    ]}
                  >
                    {acc}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
});

type SortOption = 'usnewsRank' | 'acceptanceRate' | 'tuition' | 'name';

export default function SchoolsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { search, debouncedSearch, handleSearchChange } = useDebouncedSearch();
  const [sortBy, setSortBy] = useState<SortOption>('usnewsRank');
  const [filterVisible, setFilterVisible] = useState(false);

  const {
    items: schools,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = usePaginatedQuery<School>({
    // sortBy is NOT in the key — sorting is done client-side (sortedSchools below),
    // so changing sort reuses the cached list instead of refetching from page 1.
    queryKey: qk.schools.list({ search: debouncedSearch }),
    endpoint: '/schools',
    params: {
      search: debouncedSearch || undefined,
      // Slim list-card payload (~5x smaller; drops provenance/metadata the list never renders).
      view: 'list',
    },
    // Static reference data — instant revisits (no skeleton/refetch within the tier
    // window). Pull-to-refresh still forces a reload.
    ...cachePolicy.reference,
  });

  const sortedSchools = useMemo(() => {
    const items = [...schools];

    items.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'acceptanceRate':
          return (
            (a.acceptanceRate ?? Number.POSITIVE_INFINITY) -
            (b.acceptanceRate ?? Number.POSITIVE_INFINITY)
          );
        case 'tuition':
          return (a.tuition ?? Number.POSITIVE_INFINITY) - (b.tuition ?? Number.POSITIVE_INFINITY);
        case 'usnewsRank':
        default:
          return (
            (a.usNewsRank ?? Number.POSITIVE_INFINITY) - (b.usNewsRank ?? Number.POSITIVE_INFINITY)
          );
      }
    });

    return items;
  }, [schools, sortBy]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'usnewsRank', label: t('schools.sort.ranking') },
    { value: 'acceptanceRate', label: t('schools.sort.acceptanceRate') },
    { value: 'tuition', label: t('schools.sort.tuition') },
    { value: 'name', label: t('schools.sort.name') },
  ];

  const renderSchoolItem = ({ item }: { item: School }) => (
    <SchoolListItem item={item} colors={colors} />
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
            <Card key={i} style={styles.cardWrapper}>
              <CardContent style={styles.cardContent}>
                <Skeleton width={56} height={56} borderRadius={28} />
                <View style={styles.schoolInfo}>
                  <Skeleton width="80%" height={18} />
                  <Skeleton width="50%" height={14} style={{ marginTop: 8 }} />
                  <View style={[styles.badges, { marginTop: 8 }]}>
                    <Skeleton width={50} height={20} borderRadius={10} />
                    <Skeleton width={40} height={20} borderRadius={10} />
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      );
    }

    return (
      <EmptyState
        icon="school-outline"
        title={t('schools.noResults')}
        description={search ? undefined : undefined}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search and Filter Bar */}
      <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
        <SearchBar
          value={search}
          onChangeText={handleSearchChange}
          placeholder={t('schools.searchPlaceholder')}
          style={styles.searchBar}
        />
        <TouchableOpacity
          onPress={() => setFilterVisible(true)}
          style={[styles.filterButton, { backgroundColor: colors.muted }]}
        >
          <Ionicons name="options" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Sort indicator */}
      <View style={styles.sortIndicator}>
        <Text style={[styles.sortText, { color: colors.foregroundMuted }]}>
          {sortOptions.find((o) => o.value === sortBy)?.label}
        </Text>
      </View>

      {/* Schools List */}
      <FlashList
        data={sortedSchools}
        renderItem={renderSchoolItem}
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
      />

      {/* Sort/Filter Bottom Sheet */}
      <BottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        title={t('common.sort')}
      >
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => {
              setSortBy(option.value);
              setFilterVisible(false);
            }}
            style={[
              styles.sortOption,
              sortBy === option.value && { backgroundColor: withOpacity(colors.primary, 0.1) },
            ]}
          >
            <Text
              style={[
                styles.sortOptionText,
                { color: colors.foreground },
                sortBy === option.value && { color: colors.primary },
              ]}
            >
              {option.label}
            </Text>
            {sortBy === option.value && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortIndicator: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sortText: {
    fontSize: fontSize.sm,
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaStack: {
    width: 92,
    height: 64,
    justifyContent: 'center',
  },
  coverThumb: {
    width: 92,
    height: 64,
    borderRadius: 12,
  },
  accBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  accBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  logoOverlay: {
    position: 'absolute',
    left: 6,
    bottom: 6,
  },
  schoolInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  schoolLocation: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sortOptionText: {
    fontSize: fontSize.base,
  },
});
