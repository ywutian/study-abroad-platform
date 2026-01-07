import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Avatar,
  Button,
  Loading,
  ErrorState,
} from '@/components/ui';
import { Tabs } from '@/components/ui/Tabs';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { School, Case, PaginatedResponse } from '@/types';

export default function SchoolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();

  const { data: school, isLoading, error } = useQuery({
    queryKey: ['school', id],
    queryFn: () => apiClient.get<School>(`/schools/${id}`),
    enabled: !!id,
  });

  const { data: casesData } = useQuery({
    queryKey: ['schoolCases', id],
    queryFn: () => apiClient.get<PaginatedResponse<Case>>('/cases', {
      params: { schoolId: id, limit: 10 },
    }),
    enabled: !!id,
  });

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !school) {
    return (
      <ErrorState
        title={t('errors.notFound')}
        onRetry={() => router.back()}
      />
    );
  }

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return `$${value.toLocaleString()}`;
  };

  const formatPercent = (value?: number) => {
    if (!value) return '-';
    return `${(value * 100).toFixed(1)}%`;
  };

  const stats = [
    { label: t('schools.detail.acceptanceRate'), value: formatPercent(school.acceptanceRate) },
    { label: t('schools.detail.tuition'), value: formatCurrency(school.tuition) },
    { label: t('schools.detail.avgSalary'), value: formatCurrency(school.avgSalary) },
    { label: t('schools.detail.students'), value: school.totalStudents?.toLocaleString() || '-' },
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
              <View style={styles.rankingsRow}>
                {school.usnewsRank && (
                  <View style={styles.rankItem}>
                    <Text style={[styles.rankValue, { color: colors.primary }]}>
                      #{school.usnewsRank}
                    </Text>
                    <Text style={[styles.rankLabel, { color: colors.foregroundMuted }]}>
                      {t('schools.detail.usnewsRank')}
                    </Text>
                  </View>
                )}
                {school.qsRank && (
                  <View style={styles.rankItem}>
                    <Text style={[styles.rankValue, { color: colors.primary }]}>
                      #{school.qsRank}
                    </Text>
                    <Text style={[styles.rankLabel, { color: colors.foregroundMuted }]}>
                      {t('schools.detail.qsRank')}
                    </Text>
                  </View>
                )}
              </View>
            </CardContent>
          </Card>

          {/* Website */}
          {school.website && (
            <Button
              variant="outline"
              onPress={() => Linking.openURL(school.website!)}
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
              <Card key={index} style={styles.card}>
                <CardContent style={styles.deadlineItem}>
                  <View style={styles.deadlineInfo}>
                    <Text style={[styles.deadlineType, { color: colors.foreground }]}>
                      {deadline.type}
                    </Text>
                    {deadline.notes && (
                      <Text style={[styles.deadlineNotes, { color: colors.foregroundMuted }]}>
                        {deadline.notes}
                      </Text>
                    )}
                  </View>
                  <Badge variant="secondary">{deadline.date}</Badge>
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
              <Card key={index} style={styles.card}>
                <CardContent>
                  <Text style={[styles.essayPrompt, { color: colors.foreground }]}>
                    {prompt.prompt}
                  </Text>
                  <View style={styles.essayMeta}>
                    {prompt.wordLimit && (
                      <Badge variant="outline">{prompt.wordLimit} words</Badge>
                    )}
                    {prompt.required && (
                      <Badge variant="error">Required</Badge>
                    )}
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
          {casesData?.data?.length ? (
            casesData.data.map((caseItem) => (
              <TouchableOpacity
                key={caseItem.id}
                onPress={() => router.push(`/case/${caseItem.id}`)}
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
                    <Badge
                      variant={
                        caseItem.result === 'ADMITTED'
                          ? 'success'
                          : caseItem.result === 'REJECTED'
                          ? 'error'
                          : 'warning'
                      }
                    >
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
      <Stack.Screen options={{ title: school.name }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Avatar
            source={school.logoUrl}
            name={school.name}
            size="xl"
            style={styles.logo}
          />
          <Text style={[styles.name, { color: colors.foreground }]}>
            {school.name}
          </Text>
          {school.nameZh && (
            <Text style={[styles.nameZh, { color: colors.foregroundMuted }]}>
              {school.nameZh}
            </Text>
          )}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={colors.foregroundMuted} />
            <Text style={[styles.location, { color: colors.foregroundMuted }]}>
              {school.city}, {school.state}, {school.country}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

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
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  logo: {
    marginBottom: spacing.lg,
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




