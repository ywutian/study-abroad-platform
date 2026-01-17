import React from 'react';
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
  Avatar,
  Loading,
  ErrorState,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Case } from '@/types';

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();

  const {
    data: caseData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['case', id],
    queryFn: () => apiClient.get<Case>(`/cases/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !caseData) {
    return <ErrorState title={t('errors.notFound')} onRetry={() => router.back()} />;
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
    { label: 'GPA', value: caseData.gpa?.toFixed(2), scale: caseData.gpaScale },
    { label: 'SAT', value: caseData.satScore },
    { label: 'ACT', value: caseData.actScore },
    { label: 'TOEFL', value: caseData.toeflScore },
    { label: 'IELTS', value: caseData.ieltsScore },
  ].filter((item) => item.value);

  return (
    <>
      <Stack.Screen
        options={{
          title: caseData.school?.name || t('cases.detail'),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: getResultColor() + '15' }]}>
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
            style={styles.schoolRow}
          >
            <Avatar source={caseData.school?.logoUrl} name={caseData.school?.name} size="lg" />
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
            {caseData.verified && (
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
                      {stat.scale && <Text style={styles.statScale}>/{stat.scale}</Text>}
                    </Text>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Activities */}
        {caseData.activities && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>{t('cases.detail.activities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={[styles.contentText, { color: colors.foreground }]}>
                {caseData.activities}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Awards */}
        {caseData.awards && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>{t('cases.detail.awards')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={[styles.contentText, { color: colors.foreground }]}>
                {caseData.awards}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Essays */}
        {caseData.essays && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>{t('cases.detail.essays')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={[styles.contentText, { color: colors.foreground }]}>
                {caseData.essays}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        {caseData.tips && (
          <Card style={[styles.card, { backgroundColor: colors.primary + '10' }]}>
            <CardHeader>
              <CardTitle>
                <View style={styles.tipsHeader}>
                  <Ionicons name="bulb" size={20} color={colors.primary} />
                  <Text style={[styles.tipsTitle, { color: colors.primary }]}>
                    {t('cases.detail.tips')}
                  </Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={[styles.contentText, { color: colors.foreground }]}>
                {caseData.tips}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Points earned */}
        {caseData.points && caseData.points > 0 && (
          <View style={styles.pointsContainer}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={[styles.pointsText, { color: colors.foregroundMuted }]}>
              +{caseData.points} points
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
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
    backgroundColor: 'rgba(255,255,255,0.5)',
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
  },
  statScale: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
  },
  contentText: {
    fontSize: fontSize.base,
    lineHeight: 24,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipsTitle: {
    marginLeft: spacing.sm,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pointsText: {
    marginLeft: spacing.xs,
    fontSize: fontSize.sm,
  },
  bottomSpacer: {
    height: spacing['2xl'],
  },
});
