/**
 * CaseComparisonPanel — "students like you who applied here".
 *
 * Real admission cases similar to the current user, shown alongside a
 * prediction. Honest by design: with fewer than the server minimum it states
 * the count factually and renders no verdict (mirrors the web panel).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Badge, EmptyState, Loading } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

interface SimilarCase {
  id: string;
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  gpaRange?: string;
  satRange?: string;
  major?: string;
  tags: string[];
  demographicTags: string[];
  activitySummary: string;
}

interface SimilarCasesResponse {
  status: 'OK' | 'INSUFFICIENT_DATA';
  count: number;
  minRequired: number;
  nationalityMatched: boolean;
  breakdown: { admitted: number; rejected: number; waitlisted: number };
  cases: SimilarCase[];
}

export function CaseComparisonPanel({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation();
  const colors = useColors();

  const { data, isLoading, isError } = useQuery<SimilarCasesResponse>({
    queryKey: ['cases', 'similar', schoolId],
    queryFn: () =>
      apiClient.get<SimilarCasesResponse>(
        `/cases/similar?schoolId=${encodeURIComponent(schoolId)}`
      ),
  });

  if (isLoading) return <Loading />;

  if (isError || !data) {
    return (
      <Text style={[styles.muted, { color: colors.foregroundMuted }]}>
        {t('cases.comparisonLoadError')}
      </Text>
    );
  }

  // Insufficient sample OR a malformed/empty payload — degrade gracefully
  // (never render a verdict, never crash on a missing breakdown).
  if (data.status !== 'OK' || !data.breakdown) {
    return (
      <EmptyState
        icon="information-circle-outline"
        title={t('cases.insufficientTitle')}
        description={
          data.count > 0
            ? t('cases.insufficientDescWithCount', { count: data.count })
            : t('cases.insufficientDesc')
        }
      />
    );
  }

  const { breakdown } = data;
  const total = breakdown.admitted + breakdown.rejected + breakdown.waitlisted || 1;
  const resultColor = (r: string) =>
    r === 'ADMITTED'
      ? colors.success
      : r === 'REJECTED'
        ? colors.error
        : r === 'WAITLISTED'
          ? colors.warning
          : colors.foregroundMuted;

  return (
    <View style={styles.container}>
      <Text style={[styles.summary, { color: colors.foregroundMuted }]}>
        {t('cases.comparisonSummary', {
          admitted: breakdown.admitted,
          rejected: breakdown.rejected,
          waitlisted: breakdown.waitlisted,
        })}
      </Text>
      <View style={[styles.bar, { backgroundColor: colors.muted }]}>
        <View
          style={{
            backgroundColor: colors.success,
            width: `${(breakdown.admitted / total) * 100}%`,
          }}
        />
        <View
          style={{
            backgroundColor: colors.warning,
            width: `${(breakdown.waitlisted / total) * 100}%`,
          }}
        />
        <View
          style={{
            backgroundColor: colors.error,
            width: `${(breakdown.rejected / total) * 100}%`,
          }}
        />
      </View>

      {!data.nationalityMatched && (
        <Text style={[styles.muted, { color: colors.foregroundMuted }]}>
          {t('cases.crossNationalityNote')}
        </Text>
      )}

      {(data.cases ?? []).slice(0, 6).map((c) => (
        <View key={c.id} style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.rowHead}>
            <Text style={[styles.stats, { color: colors.foregroundMuted }]} numberOfLines={1}>
              {[c.gpaRange && `GPA ${c.gpaRange}`, c.satRange && `SAT ${c.satRange}`, c.major]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={[styles.resultText, { color: resultColor(c.result) }]}>
              {t(`cases.result.${c.result.toLowerCase()}`)}
            </Text>
          </View>
          {(c.demographicTags.length > 0 || c.tags.length > 0) && (
            <View style={styles.tags}>
              {[...c.demographicTags, ...c.tags].slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  summary: { fontSize: fontSize.xs },
  muted: { fontSize: fontSize.xs },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  row: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stats: { flex: 1, fontSize: fontSize.xs },
  resultText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
