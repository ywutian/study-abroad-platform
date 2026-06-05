import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
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

export interface QuickActionsGridProps {
  /** Pending task count → badge on the Timeline action. */
  pendingCount?: number;
}

type QuickAction = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  desc: string;
  route: string;
  accent?: boolean;
  badge?: number;
};

export function QuickActionsGrid({ pendingCount = 0 }: QuickActionsGridProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const actions = useMemo<QuickAction[]>(
    () => [
      {
        icon: 'trending-up-outline',
        title: t('home.features.prediction'),
        desc: t('home.features.predictionDesc'),
        route: '/prediction',
        accent: true,
      },
      {
        icon: 'calendar-outline',
        title: t('home.features.timeline'),
        desc: t('home.features.timelineDesc'),
        route: '/timeline',
        badge: pendingCount,
      },
      {
        icon: 'chatbubbles-outline',
        title: t('home.features.forum'),
        desc: t('home.features.forumDesc'),
        route: '/forum',
      },
      {
        icon: 'game-controller-outline',
        title: t('home.features.swipe'),
        desc: t('home.features.swipeDesc'),
        route: '/swipe',
      },
    ],
    [t, pendingCount]
  );

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.quickActions')} />
      <View style={styles.grid}>
        {actions.map((a) => {
          const tint = a.accent ? colors.primary : colors.foregroundSecondary;
          return (
            <View key={a.route} style={styles.cell}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(a.route as Href)}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={a.title}
              >
                {a.badge ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text
                      style={[
                        styles.badgeText,
                        { color: colors.primaryForeground, fontFamily: fontFamily.mono },
                      ]}
                    >
                      {a.badge > 99 ? '99+' : a.badge}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: a.accent
                        ? withOpacity(colors.primary, 0.14)
                        : colors.backgroundTertiary,
                    },
                  ]}
                >
                  <Ionicons name={a.icon} size={22} color={tint} />
                </View>
                <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={[styles.desc, { color: colors.foregroundMuted }]} numberOfLines={1}>
                  {a.desc}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { width: '33.33%', padding: spacing.xs },
  card: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  desc: { fontSize: fontSize.xs, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: { fontSize: 10, fontWeight: fontWeight.bold },
});
