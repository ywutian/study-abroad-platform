import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
  Loading,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import { SchoolAvatar } from '@/components/features/SchoolAvatar';
import { caseRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import {
  useColors,
  withOpacity,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  borderRadius,
} from '@/utils/theme';
import type { Case } from '@/types';

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();

  const {
    data: caseData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['case', id],
    queryFn: () => apiClient.get<Case>(caseRoutes.byId(id!)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.muted }]}>
            <Skeleton
              width={80}
              height={28}
              borderRadius={14}
              style={{ marginBottom: spacing.xl }}
            />
            <View style={[styles.schoolRow, { backgroundColor: withOpacity(colors.card, 0.7) }]}>
              <Skeleton width={56} height={56} borderRadius={28} />
              <View style={styles.schoolInfo}>
                <Skeleton width="70%" height={16} style={{ marginBottom: spacing.xs }} />
                <Skeleton width="50%" height={14} />
              </View>
            </View>
          </View>
          <Card style={styles.card}>
            <CardContent>
              <Skeleton width="40%" height={18} style={{ marginBottom: spacing.md }} />
              <View style={styles.statsGrid}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={styles.statItem}>
                    <Skeleton width={30} height={12} style={{ marginBottom: spacing.xs }} />
                    <Skeleton width={50} height={20} />
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>
        </ScrollView>
      </>
    );
  }

  if (error || !caseData) {
    return <ErrorState title={t('errors.notFound')} onRetry={() => refetch()} />;
  }

  const getResultColor = () => {
    switch (caseData.result) {
      case 'ADMITTED':
        return colors.success;
      case 'REJECTED':
        return colors.error;
      default:
        return colors.warning;
    }
  };

  const statItems = [
    { label: 'GPA', value: caseData.gpaRange },
    { label: 'SAT', value: caseData.satRange },
    { label: 'ACT', value: caseData.actRange },
    { label: 'TOEFL', value: caseData.toeflRange },
  ].filter((item) => item.value);

  return (
    <>
      <Stack.Screen
        options={{
          title: caseData.school?.name || t('cases.detail.title'),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: withOpacity(getResultColor(), 0.08) }]}>
          <Badge
            variant={
              caseData.result === 'ADMITTED'
                ? 'success'
                : caseData.result === 'REJECTED'
                  ? 'error'
                  : 'warning'
            }
            style={styles.resultBadge}
          >
            <Text style={styles.resultText}>
              {t(`cases.result.${caseData.result.toLowerCase()}`)}
            </Text>
          </Badge>

          {/* School Info */}
          <TouchableOpacity
            onPress={() => caseData.schoolId && router.push(`/school/${caseData.schoolId}`)}
            style={[styles.schoolRow, { backgroundColor: withOpacity(colors.card, 0.7) }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={caseData.school?.name || t('common.unknownSchool')}
          >
            <SchoolAvatar
              name={caseData.school?.name}
              logoUrl={caseData.school?.media?.logo?.url ?? caseData.school?.logoUrl}
              website={caseData.school?.website}
              size="lg"
            />
            <View style={styles.schoolInfo}>
              <Text style={[styles.schoolName, { color: colors.foreground }]}>
                {caseData.school?.name || t('common.unknownSchool')}
              </Text>
              <Text style={[styles.schoolMeta, { color: colors.foregroundMuted }]}>
                {caseData.major} · {caseData.year} · {caseData.round || 'RD'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
          </TouchableOpacity>

          {/* Verification Badge */}
          <View style={styles.badges}>
            {caseData.isVerified && (
              <Badge variant="success">
                <View style={styles.badgeContent}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={{ marginLeft: 4, color: colors.success }}>
                    {t('cases.verified')}
                  </Text>
                </View>
              </Badge>
            )}
            {caseData.visibility === 'ANONYMOUS' && (
              <Badge variant="secondary">{t('cases.anonymous')}</Badge>
            )}
          </View>
        </View>

        {/* Stats */}
        {statItems.length > 0 && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>{t('cases.detail.scores')}</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.statsGrid}>
                {statItems.map((stat, index) => (
                  <View key={index} style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
                      {stat.label}
                    </Text>
                    <Text style={[styles.statValue, { color: colors.foreground }]}>
                      {stat.value}
                    </Text>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {caseData.tags && caseData.tags.length > 0 && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>{t('cases.detail.tags')}</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.tagsRow}>
                {caseData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Essay */}
        {caseData.essayContent && (
          <EssayCard
            essayContent={caseData.essayContent}
            essayPrompt={caseData.essayPrompt}
            colors={colors}
            t={t}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

const ESSAY_PREVIEW_LENGTH = 500;

function EssayCard({
  essayContent,
  essayPrompt,
  colors,
  t,
}: {
  essayContent: string;
  essayPrompt?: string;
  colors: ReturnType<typeof useColors>;
  t: (key: string) => string;
}) {
  const isLong = essayContent.length > ESSAY_PREVIEW_LENGTH;
  const [expanded, setExpanded] = useState(!isLong);

  const displayText = expanded ? essayContent : essayContent.slice(0, ESSAY_PREVIEW_LENGTH) + '...';

  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>{t('cases.detail.essay')}</CardTitle>
      </CardHeader>
      <CardContent>
        {essayPrompt && (
          <Text style={[styles.essayPrompt, { color: colors.foregroundMuted }]}>{essayPrompt}</Text>
        )}
        <Text style={[styles.contentText, { color: colors.foreground }]}>{displayText}</Text>
        {isLong && (
          <TouchableOpacity
            onPress={() => setExpanded((prev) => !prev)}
            style={styles.expandButton}
            accessibilityRole="button"
            accessibilityLabel={expanded ? t('common.showLess') : t('common.showMore')}
          >
            <Text style={[styles.expandButtonText, { color: colors.primary }]}>
              {expanded ? t('common.showLess') : t('common.showMore')}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  resultBadge: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  resultText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    width: '100%',
  },
  schoolInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  schoolMeta: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  statItem: {
    minWidth: '30%',
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
  contentText: {
    fontSize: fontSize.base,
    lineHeight: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  essayPrompt: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
  },
  expandButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginRight: spacing.xs,
  },
  bottomSpacer: {
    height: spacing['2xl'],
  },
});
