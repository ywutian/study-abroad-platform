import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
} from '@/utils/theme';
import { SectionHeader } from './SectionHeader';

export interface TierTilesProps {
  tiers: { reach: number; target: number; safety: number };
}

export function TierTiles({ tiers }: TierTilesProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const items = [
    {
      key: 'reach',
      icon: 'trending-up',
      zh: t('home.tiers.reach'),
      en: 'Reach',
      value: tiers.reach,
      color: colors.error,
    },
    {
      key: 'target',
      icon: 'locate',
      zh: t('home.tiers.target'),
      en: 'Target',
      value: tiers.target,
      color: colors.warning,
    },
    {
      key: 'safety',
      icon: 'shield-checkmark',
      zh: t('home.tiers.safety'),
      en: 'Safety',
      value: tiers.safety,
      color: colors.success,
    },
  ] as const;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('home.schoolTiers')}
        moreLabel={t('home.viewSchoolList')}
        onMore={() => router.push('/prediction')}
      />
      <View style={styles.row}>
        {items.map((it) => (
          <TouchableOpacity
            key={it.key}
            activeOpacity={0.85}
            onPress={() => router.push('/prediction')}
            style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`${it.zh} ${it.value}`}
          >
            <View style={[styles.bar, { backgroundColor: it.color }]} />
            <View style={styles.tileBody}>
              <View style={styles.tileHead}>
                <Ionicons name={it.icon} size={15} color={it.color} />
                <Text style={[styles.zh, { color: colors.foregroundSecondary }]}>{it.zh}</Text>
              </View>
              <Text style={[styles.value, { color: it.color, fontFamily: fontFamily.mono }]}>
                {it.value}
              </Text>
              <Text style={[styles.en, { color: colors.foregroundMuted }]}>{it.en}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  bar: { height: 3, width: '100%' },
  tileBody: { padding: spacing.md, paddingTop: spacing.sm },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  zh: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  value: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  en: { fontSize: fontSize.xs, marginTop: 2 },
});
