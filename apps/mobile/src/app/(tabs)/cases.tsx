import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import {
  Card,
  CardContent,
  SearchBar,
  Badge,
  Button,
  Loading,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { BottomSheet } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { SubmitCaseModal } from '@/components/features/SubmitCaseModal';
import { useDebouncedSearch, usePaginatedQuery } from '@/hooks/api';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import { useColors, spacing, fontSize, fontWeight, fontFamily } from '@/utils/theme';
import { getResultBadgeVariant } from '@/utils/case-helpers';
import type { Case, CaseResult } from '@/types';

interface CaseListItemProps {
  item: Case;
}

const CaseListItem = memo(function CaseListItem({ item }: CaseListItemProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/case/${item.id}`)}
      style={styles.cardWrapper}
      accessibilityRole="button"
      accessibilityLabel={`${item.school?.name || t('common.unknownSchool')}, ${item.major}, ${item.year}, ${t(`cases.result.${item.result.toLowerCase()}`)}`}
    >
      <Card>
        <CardContent>
          <View style={styles.caseHeader}>
            <View style={styles.caseInfo}>
              <Text style={[styles.schoolName, { color: colors.foreground }]} numberOfLines={1}>
                {item.school?.name || t('common.unknownSchool')}
              </Text>
              <Text style={[styles.caseMeta, { color: colors.foregroundMuted }]}>
                {item.major} · {item.year} · {item.round || 'RD'}
              </Text>
            </View>
            <Badge variant={getResultBadgeVariant(item.result)}>
              {t(`cases.result.${item.result.toLowerCase()}`)}
            </Badge>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {item.gpaRange && (
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>GPA</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {item.gpaRange}
                </Text>
              </View>
            )}
            {item.satRange && (
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>SAT</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {item.satRange}
                </Text>
              </View>
            )}
            {item.toeflRange && (
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>TOEFL</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {item.toeflRange}
                </Text>
              </View>
            )}
          </View>

          {/* Badges */}
          <View style={styles.footerRow}>
            {item.isVerified && (
              <Badge variant="success">
                <View style={styles.badgeContent}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                  <Text style={styles.badgeText}>{t('cases.verified')}</Text>
                </View>
              </Badge>
            )}
            {item.visibility === 'ANONYMOUS' && (
              <Badge variant="secondary">{t('cases.anonymous')}</Badge>
            )}
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
});

export default function CasesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { isAuthenticated } = useAuthStore();

  const { search, debouncedSearch, handleSearchChange } = useDebouncedSearch();
  const [filterVisible, setFilterVisible] = useState(false);
  const [resultFilter, setResultFilter] = useState<CaseResult | ''>('');
  const [yearFilter, setYearFilter] = useState('');
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const queryClient = useQueryClient();

  const {
    items: cases,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = usePaginatedQuery<Case>({
    queryKey: qk.cases.list({ search: debouncedSearch, result: resultFilter, year: yearFilter }),
    endpoint: '/cases',
    params: {
      search: debouncedSearch || undefined,
      result: resultFilter || undefined,
      year: yearFilter || undefined,
    },
  });

  // Announce search results for screen readers
  useEffect(() => {
    if (!isLoading && debouncedSearch && cases.length >= 0) {
      AccessibilityInfo.announceForAccessibility(
        t('cases.a11y.searchResults', { count: cases.length })
      );
    }
  }, [debouncedSearch, cases.length, isLoading, t]);

  const resultOptions = [
    { value: '', label: t('common.all') || 'All' },
    { value: 'ADMITTED', label: t('cases.result.admitted') },
    { value: 'REJECTED', label: t('cases.result.rejected') },
    { value: 'WAITLISTED', label: t('cases.result.waitlisted') },
  ];

  const yearOptions = [
    { value: '', label: t('common.all') || 'All' },
    { value: '2025', label: '2025' },
    { value: '2024', label: '2024' },
    { value: '2023', label: '2023' },
    { value: '2022', label: '2022' },
  ];

  const renderCaseItem = ({ item }: { item: Case }) => <CaseListItem item={item} />;

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
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} style={styles.cardWrapper}>
              <CardContent>
                <View style={styles.caseHeader}>
                  <View style={styles.caseInfo}>
                    <Skeleton width="70%" height={18} />
                    <Skeleton width="50%" height={14} style={styles.skeletonMarginTop} />
                  </View>
                  <Skeleton width={60} height={24} borderRadius={12} />
                </View>
                <View style={[styles.statsRow, styles.loadingStatsRow]}>
                  <Skeleton width={50} height={32} />
                  <Skeleton width={50} height={32} />
                  <Skeleton width={50} height={32} />
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      );
    }

    return (
      <EmptyState
        icon="folder-open-outline"
        title={t('cases.noCases')}
        action={
          isAuthenticated
            ? {
                label: t('cases.submitCase'),
                onPress: () => setSubmitModalVisible(true),
              }
            : undefined
        }
      />
    );
  };

  const activeFiltersCount = (resultFilter ? 1 : 0) + (yearFilter ? 1 : 0);

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
          accessibilityRole="button"
          accessibilityLabel={t('common.filter')}
          accessibilityState={{ expanded: filterVisible }}
        >
          <Ionicons name="filter" size={20} color={colors.foreground} />
          {activeFiltersCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
              <Text
                style={[
                  styles.filterBadgeText,
                  { color: colors.primaryForeground, fontFamily: fontFamily.mono },
                ]}
              >
                {activeFiltersCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Submit Case Button (for authenticated users) */}
      {isAuthenticated && (
        <View style={styles.submitContainer}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Ionicons name="add" size={18} color={colors.primary} />}
            onPress={() => setSubmitModalVisible(true)}
          >
            {t('cases.submitCase')}
          </Button>
        </View>
      )}

      {/* Cases List */}
      <FlashList
        data={cases}
        renderItem={renderCaseItem}
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

      {/* Filter Bottom Sheet */}
      <BottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        title={t('common.filter')}
      >
        <View style={styles.filterContent}>
          <Select
            label={t('cases.filters.result')}
            options={resultOptions}
            value={resultFilter}
            onChange={(value) => setResultFilter(value as CaseResult | '')}
          />
          <Select
            label={t('cases.filters.year')}
            options={yearOptions}
            value={yearFilter}
            onChange={setYearFilter}
          />
          <View style={styles.filterActions}>
            <Button
              variant="outline"
              onPress={() => {
                setResultFilter('');
                setYearFilter('');
              }}
              style={styles.filterAction}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilterVisible(false);
              }}
              style={styles.filterAction}
            >
              {t('common.confirm')}
            </Button>
          </View>
        </View>
      </BottomSheet>

      {/* Submit Case Modal */}
      <SubmitCaseModal
        visible={submitModalVisible}
        onClose={() => setSubmitModalVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: qk.cases.all });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badgeText: { marginLeft: 4 },
  skeletonMarginTop: { marginTop: 8 },
  loadingStatsRow: { marginTop: spacing.md },
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
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  submitContainer: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    alignItems: 'flex-end',
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  caseInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  caseMeta: {
    fontSize: fontSize.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  filterContent: {
    padding: spacing.lg,
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  filterAction: {
    flex: 1,
  },
});
