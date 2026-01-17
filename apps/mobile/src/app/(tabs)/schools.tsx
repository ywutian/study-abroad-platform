import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import debounce from 'lodash.debounce';

import {
  Card,
  CardContent,
  SearchBar,
  Badge,
  Avatar,
  Loading,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { BottomSheet } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';
import type { School, PaginatedResponse } from '@/types';

type SortOption = 'usnewsRank' | 'acceptanceRate' | 'tuition' | 'name';

export default function SchoolsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('usnewsRank');
  const [filterVisible, setFilterVisible] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    debouncedSetSearch(value);
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ['schools', debouncedSearch, sortBy],
      queryFn: async ({ pageParam = 1 }) => {
        return apiClient.get<PaginatedResponse<School>>('/schools', {
          params: {
            page: pageParam,
            limit: 20,
            search: debouncedSearch || undefined,
            sort: sortBy,
            order: sortBy === 'name' ? 'asc' : 'asc',
          },
        });
      },
      getNextPageParam: (lastPage) => {
        if (lastPage.meta.page < lastPage.meta.totalPages) {
          return lastPage.meta.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
    });

  const schools = data?.pages.flatMap((page) => page.data) || [];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'usnewsRank', label: t('schools.sort.ranking') },
    { value: 'acceptanceRate', label: t('schools.sort.acceptanceRate') },
    { value: 'tuition', label: t('schools.sort.tuition') },
    { value: 'name', label: t('schools.sort.name') },
  ];

  const renderSchoolItem = ({ item }: { item: School }) => (
    <TouchableOpacity onPress={() => router.push(`/school/${item.id}`)} style={styles.cardWrapper}>
      <Card>
        <CardContent style={styles.cardContent}>
          <Avatar source={item.logoUrl} name={item.name} size="lg" />
          <View style={styles.schoolInfo}>
            <Text style={[styles.schoolName, { color: colors.foreground }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.schoolLocation, { color: colors.foregroundMuted }]}>
              {item.city}, {item.state}
            </Text>
            <View style={styles.badges}>
              {item.usnewsRank && <Badge variant="secondary">#{item.usnewsRank}</Badge>}
              {item.acceptanceRate && (
                <Badge variant="outline">{(item.acceptanceRate * 100).toFixed(0)}%</Badge>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
        </CardContent>
      </Card>
    </TouchableOpacity>
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
      <FlatList
        data={schools}
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
              sortBy === option.value && { backgroundColor: colors.primary + '10' },
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
