import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, SkeletonListItem } from '@/components/ui';
import { getResultBadgeVariant } from '@/utils/case-helpers';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Case } from '@/types';
import { SectionHeader } from './SectionHeader';

export interface RecentCasesListProps {
  cases: Case[];
  loading?: boolean;
}

export function RecentCasesList({ cases, loading }: RecentCasesListProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('home.recentCases')}
        moreLabel={t('home.viewAll')}
        onMore={() => router.push('/(tabs)/cases')}
      />
      {loading ? (
        <View>
          {[1, 2, 3].map((i) => (
            <SkeletonListItem key={i} hasAvatar={false} />
          ))}
        </View>
      ) : cases.length ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {cases.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/case/${c.id}`)}
              style={[
                styles.row,
                i < cases.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${c.school?.name ?? t('common.unknownSchool')} ${c.result}`}
            >
              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {c.school?.name || t('common.unknownSchool')}
                </Text>
                <Text style={[styles.meta, { color: colors.foregroundMuted }]} numberOfLines={1}>
                  {c.major} · {c.year}
                </Text>
              </View>
              <Badge variant={getResultBadgeVariant(c.result)}>
                {t(`cases.result.${c.result.toLowerCase()}`)}
              </Badge>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <EmptyState icon="folder-open-outline" title={t('cases.noCases')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  card: { borderWidth: 1, borderRadius: borderRadius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.sm, marginTop: 3 },
});
