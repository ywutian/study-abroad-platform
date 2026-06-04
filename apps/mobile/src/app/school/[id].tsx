import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Loading,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import { getRankingListShortLabel } from '@/components/ui/RankingBadge';
import {
  createLegacyUsNewsRanking,
  getRankingSourceLabel,
  groupRankingsBySource,
} from '@study-abroad/shared/ranking';
import { SchoolAvatar } from '@/components/features/SchoolAvatar';
import { Tabs } from '@/components/ui/Tabs';
import { API_ROUTES, schoolRoutes, schoolListRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores';
import { useColors, spacing, fontSize, fontWeight, borderRadius, fontFamily } from '@/utils/theme';
import { getResultBadgeVariant } from '@/utils/case-helpers';
import { formatAcceptanceRate } from '@/utils/format';
import { DATA_SOURCE_LABELS } from '@study-abroad/shared';
import type { SchoolProvenance } from '@study-abroad/shared';
import { isSafeUrl } from '@study-abroad/shared/utils';
import type { School, Case, PaginatedResponse } from '@/types';

function DataSourceLabel({
  field,
  provenance,
  locale,
  colors,
}: {
  field: string;
  provenance?: SchoolProvenance;
  locale: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const prov = provenance?.[field];
  if (!prov) return null;
  const label = DATA_SOURCE_LABELS[prov.source]?.[locale === 'zh' ? 'zh' : 'en'] ?? prov.source;
  const date = new Date(prov.fetchedAt);
  const freshness = date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  return (
    <Text
      style={{ fontSize: fontSize.xs - 2, color: colors.foregroundMuted, marginTop: 2 }}
      numberOfLines={1}
    >
      {t('schools.detail.dataSource', { source: label })} ·{' '}
      {t('schools.detail.updatedAt', { date: freshness })}
    </Text>
  );
}

export default function SchoolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const colors = useColors();

  const {
    data: school,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['school', id],
    queryFn: () => apiClient.get<School>(schoolRoutes.byId(id!)),
    enabled: !!id,
  });

  const { data: casesData, isLoading: casesLoading } = useQuery({
    queryKey: ['schoolCases', id],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Case>>(API_ROUTES.CASES, {
        params: { schoolId: id, page: 1, pageSize: 10 },
      }),
    enabled: !!id,
  });

  // ── Save-to-list (target school list) ──
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();

  const { data: schoolListData } = useQuery({
    queryKey: ['school-list'],
    queryFn: () => apiClient.get<{ schoolId: string }[]>(API_ROUTES.SCHOOL_LISTS),
    enabled: isAuthenticated,
  });
  const isInList = useMemo(
    () =>
      (Array.isArray(schoolListData) ? schoolListData : []).some((item) => item.schoolId === id),
    [schoolListData, id]
  );

  const addToListMutation = useMutation({
    mutationFn: () => apiClient.post(API_ROUTES.SCHOOL_LISTS, { schoolId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-list'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('findCollege.addedToList'));
    },
    onError: () => toast.error(t('findCollege.addError')),
  });

  const removeFromListMutation = useMutation({
    mutationFn: () => apiClient.delete(schoolListRoutes.byId(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-list'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.info(t('findCollege.removedFromList'));
    },
    onError: () => toast.error(t('findCollege.removeError')),
  });

  const toggleList = useCallback(() => {
    if (addToListMutation.isPending || removeFromListMutation.isPending) return;
    if (isInList) removeFromListMutation.mutate();
    else addToListMutation.mutate();
  }, [isInList, addToListMutation, removeFromListMutation]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.card }]}>
            <Skeleton
              width={80}
              height={80}
              borderRadius={40}
              style={{ marginBottom: spacing.lg }}
            />
            <Skeleton width={200} height={22} style={{ marginBottom: spacing.sm }} />
            <Skeleton width={140} height={16} />
          </View>
          <View style={styles.statsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Skeleton width={60} height={22} style={{ marginBottom: spacing.xs }} />
                <Skeleton width={80} height={14} />
              </View>
            ))}
          </View>
        </ScrollView>
      </>
    );
  }

  if (error || !school) {
    return <ErrorState title={t('errors.notFound')} onRetry={() => refetch()} />;
  }

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return `$${value.toLocaleString()}`;
  };

  const formatPercent = (value?: number) => {
    return formatAcceptanceRate(value);
  };

  const provenance = school.metadata?.provenance;
  const locale = i18n.language?.startsWith('zh') ? 'zh' : 'en';

  const stats = [
    {
      label: t('schools.detail.acceptanceRate'),
      value: formatPercent(school.acceptanceRate),
      field: 'acceptanceRate',
    },
    { label: t('schools.detail.tuition'), value: formatCurrency(school.tuition), field: 'tuition' },
    {
      label: t('schools.detail.avgSalary'),
      value: formatCurrency(school.avgSalary),
      field: 'avgSalary',
    },
    {
      label: t('schools.detail.students'),
      value: school.totalEnrollment?.toLocaleString() || '-',
      field: 'totalEnrollment',
    },
  ];

  const tabContent = [
    {
      key: 'overview',
      label: t('schools.detail.overview'),
      content: (
        <View style={styles.tabContent}>
          {/* Description */}
          {school.description && (
            <Card style={styles.card}>
              <CardContent>
                <Text style={[styles.description, { color: colors.foreground }]}>
                  {school.description}
                </Text>
              </CardContent>
            </Card>
          )}

          {/* Rankings */}
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>{t('schools.detail.rankings')}</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const rows = [...(school.rankings ?? [])];
                if (!rows.some((r) => r.source === 'US_NEWS')) {
                  const legacy = createLegacyUsNewsRanking(school.usNewsRank);
                  if (legacy) rows.push(legacy);
                }
                if (!rows.some((r) => r.source === 'QS') && school.qsRank) {
                  rows.push({
                    source: 'QS',
                    list: 'QS_WORLD',
                    rank: school.qsRank,
                    year: 2025,
                    confidence: 'fallback',
                  });
                }
                const grouped = groupRankingsBySource(rows);
                if (grouped.length === 0) {
                  return (
                    <Text style={[styles.rankLabel, { color: colors.foregroundMuted }]}>
                      {t('schools.detail.rankingsEmpty')}
                    </Text>
                  );
                }
                return grouped.map((r, index) => (
                  <View
                    key={r.source}
                    style={[
                      styles.rankingListRow,
                      index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={styles.rankingListInfo}>
                      <Text style={[styles.rankSource, { color: colors.foreground }]}>
                        {getRankingSourceLabel(r.source)}
                        {r.confidence === 'fallback' ? ' · Legacy' : ''}
                      </Text>
                      <Text style={[styles.rankLabel, { color: colors.foregroundMuted }]}>
                        {getRankingListShortLabel(r.list)} · {r.year}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rankValue,
                        { color: colors.primary, fontFamily: fontFamily.mono },
                      ]}
                    >
                      #{r.rank}
                    </Text>
                  </View>
                ));
              })()}
            </CardContent>
          </Card>

          {/* Website */}
          {isSafeUrl(school.website) && (
            <Button
              variant="outline"
              onPress={() => {
                Linking.openURL(school.website!).catch(() => {});
              }}
              leftIcon={<Ionicons name="globe-outline" size={18} color={colors.primary} />}
              style={styles.websiteButton}
            >
              {t('schools.detail.website')}
            </Button>
          )}
        </View>
      ),
    },
    {
      key: 'deadlines',
      label: t('schools.detail.deadlines'),
      content: (
        <View style={styles.tabContent}>
          {school.deadlines?.length ? (
            school.deadlines.map((deadline, index) => (
              <Card key={deadline.id ?? index} style={styles.card}>
                <CardContent style={styles.deadlineItem}>
                  <View style={styles.deadlineInfo}>
                    <Text style={[styles.deadlineType, { color: colors.foreground }]}>
                      {deadline.round}
                    </Text>
                    {deadline.notes && (
                      <Text style={[styles.deadlineNotes, { color: colors.foregroundMuted }]}>
                        {deadline.notes}
                      </Text>
                    )}
                  </View>
                  <Badge variant="secondary">
                    {new Date(deadline.applicationDeadline).toLocaleDateString()}
                  </Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.foregroundMuted }]}>
              {t('common.noData')}
            </Text>
          )}
        </View>
      ),
    },
    {
      key: 'essays',
      label: t('schools.detail.essayPrompts'),
      content: (
        <View style={styles.tabContent}>
          {school.essayPrompts?.length ? (
            school.essayPrompts.map((prompt, index) => (
              <Card key={prompt.id ?? index} style={styles.card}>
                <CardContent>
                  <Text style={[styles.essayPrompt, { color: colors.foreground }]}>
                    {prompt.prompt}
                  </Text>
                  <View style={styles.essayMeta}>
                    {prompt.wordLimit && (
                      <Badge variant="outline">
                        {prompt.wordLimit} {t('common.words')}
                      </Badge>
                    )}
                    {prompt.isRequired && <Badge variant="error">{t('common.required')}</Badge>}
                  </View>
                </CardContent>
              </Card>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.foregroundMuted }]}>
              {t('common.noData')}
            </Text>
          )}
        </View>
      ),
    },
    {
      key: 'cases',
      label: t('schools.detail.relatedCases'),
      content: (
        <View style={styles.tabContent}>
          {casesLoading ? (
            [1, 2, 3].map((i) => (
              <Card key={i} style={styles.card}>
                <CardContent style={styles.caseItem}>
                  <View style={styles.caseInfo}>
                    <Skeleton width="60%" height={16} style={{ marginBottom: spacing.xs }} />
                    <Skeleton width="40%" height={14} />
                  </View>
                  <Skeleton width={60} height={24} borderRadius={12} />
                </CardContent>
              </Card>
            ))
          ) : casesData?.items?.length ? (
            casesData.items.map((caseItem) => (
              <TouchableOpacity
                key={caseItem.id}
                onPress={() => router.push(`/case/${caseItem.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${caseItem.major}, ${caseItem.year}, ${t(`cases.result.${caseItem.result.toLowerCase()}`)}`}
              >
                <Card style={styles.card}>
                  <CardContent style={styles.caseItem}>
                    <View style={styles.caseInfo}>
                      <Text style={[styles.caseMajor, { color: colors.foreground }]}>
                        {caseItem.major}
                      </Text>
                      <Text style={[styles.caseYear, { color: colors.foregroundMuted }]}>
                        {caseItem.year} · {caseItem.round || 'RD'}
                      </Text>
                    </View>
                    <Badge variant={getResultBadgeVariant(caseItem.result)}>
                      {t(`cases.result.${caseItem.result.toLowerCase()}`)}
                    </Badge>
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.foregroundMuted }]}>
              {t('common.noData')}
            </Text>
          )}
        </View>
      ),
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: school.name,
          headerRight: isAuthenticated
            ? () => (
                <TouchableOpacity
                  onPress={toggleList}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isInList ? t('findCollege.removeFromList') : t('findCollege.addToList')
                  }
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ paddingLeft: 8 }}
                >
                  <Ionicons
                    name={isInList ? 'bookmark' : 'bookmark-outline'}
                    size={24}
                    color={isInList ? colors.primary : colors.foreground}
                  />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400).springify()}
          style={[styles.header, { backgroundColor: colors.card }]}
        >
          {school.media?.campusCover?.url ? (
            <Image
              source={{ uri: school.media.campusCover.url }}
              style={[styles.coverImage, { backgroundColor: colors.muted }]}
              resizeMode="cover"
            />
          ) : null}
          <SchoolAvatar
            name={school.name}
            logoUrl={school.media?.logo?.url ?? school.logoUrl}
            website={school.website}
            size="xl"
            style={[styles.logo, school.media?.campusCover?.url ? styles.logoOnCover : null]}
          />
          <Text style={[styles.name, { color: colors.foreground }]}>{school.name}</Text>
          {school.nameZh && (
            <Text style={[styles.nameZh, { color: colors.foregroundMuted }]}>{school.nameZh}</Text>
          )}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={colors.foregroundMuted} />
            <Text style={[styles.location, { color: colors.foregroundMuted }]}>
              {school.city}, {school.state}, {school.country}
            </Text>
          </View>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400).springify()}
          style={styles.statsGrid}
        >
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.statValue,
                  { color: colors.foreground, fontFamily: fontFamily.mono },
                ]}
              >
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
                {stat.label}
              </Text>
              <DataSourceLabel
                field={stat.field}
                provenance={provenance}
                locale={locale}
                colors={colors}
              />
            </View>
          ))}
        </Animated.View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <Tabs tabs={tabContent} scrollable />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    overflow: 'hidden',
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  coverImage: {
    width: '100%',
    height: 180,
    marginTop: -spacing['2xl'],
    marginBottom: spacing.md,
  },
  logo: {
    marginBottom: spacing.lg,
  },
  logoOnCover: {
    marginTop: -44,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  nameZh: {
    fontSize: fontSize.base,
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: fontSize.sm,
    marginLeft: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  tabsContainer: {
    padding: spacing.lg,
  },
  tabContent: {
    paddingTop: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fontSize.base,
    lineHeight: 24,
  },
  rankingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  rankItem: {
    alignItems: 'center',
  },
  rankingListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rankingListInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  rankSource: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  rankValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  rankLabel: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  websiteButton: {
    marginTop: spacing.md,
  },
  deadlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadlineInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  deadlineType: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  deadlineNotes: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  essayPrompt: {
    fontSize: fontSize.base,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  essayMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  caseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caseInfo: {
    flex: 1,
  },
  caseMajor: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  caseYear: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    padding: spacing.xl,
    fontSize: fontSize.base,
  },
});
