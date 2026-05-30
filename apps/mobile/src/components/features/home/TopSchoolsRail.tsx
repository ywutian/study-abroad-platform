import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RankingBadge, EmptyState, AnimatedSkeleton } from '@/components/ui';
import { SchoolAvatar } from '@/components/features/SchoolAvatar';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { School } from '@/types';
import { SectionHeader } from './SectionHeader';

export interface TopSchoolsRailProps {
  schools: School[];
  loading?: boolean;
}

export function TopSchoolsRail({ schools, loading }: TopSchoolsRailProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('home.topSchools')}
        moreLabel={t('home.viewAll')}
        onMore={() => router.push('/(tabs)/schools')}
      />
      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <AnimatedSkeleton variant="circle" height={48} style={{ marginBottom: spacing.sm }} />
              <AnimatedSkeleton height={14} style={{ marginBottom: spacing.sm }} />
              <AnimatedSkeleton width={70} height={20} borderRadius={10} />
            </View>
          ))}
        </ScrollView>
      ) : schools.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {schools.map((school) => (
            <TouchableOpacity
              key={school.id}
              activeOpacity={0.85}
              onPress={() => router.push(`/school/${school.id}`)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={school.name}
            >
              <SchoolAvatar
                name={school.name}
                logoUrl={school.media?.logo?.url ?? school.logoUrl}
                website={school.website}
                size="lg"
                style={styles.logo}
              />
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
                {school.name}
              </Text>
              <RankingBadge rankings={school.rankings} usNewsRank={school.usNewsRank} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <EmptyState icon="school-outline" title={t('schools.noResults')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  rail: { paddingRight: spacing.lg, gap: spacing.md },
  card: {
    width: 144,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  logo: { marginBottom: spacing.sm },
  name: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    height: 36,
  },
});
