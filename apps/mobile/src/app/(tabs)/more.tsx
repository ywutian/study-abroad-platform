/**
 * More Tab — Grid of additional features
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FadeInView } from '@/components/ui';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
} from '@/utils/theme';

interface MoreItem {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
  color: string;
  badge?: number;
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const items: MoreItem[] = [
    {
      icon: 'folder-open',
      label: t('more.cases'),
      route: '/(tabs)/cases',
      color: colors.info,
    },
    {
      icon: 'notifications',
      label: t('more.notifications'),
      route: '/notifications',
      color: colors.warning,
    },
    { icon: 'chatbubbles', label: t('more.forum'), route: '/forum', color: colors.info },
    { icon: 'create', label: t('more.essays'), route: '/essays', color: colors.violet },
    { icon: 'document-text', label: t('more.resume'), route: '/resume', color: colors.primary },
    { icon: 'lock-closed', label: t('more.vault'), route: '/vault', color: colors.success },
    { icon: 'people', label: t('more.teams'), route: '/teams', color: colors.info },
    { icon: 'trophy', label: t('more.points'), route: '/points', color: colors.warning },
    { icon: 'star', label: t('more.peerReview'), route: '/peer-review', color: colors.violet },
    { icon: 'gift', label: t('more.referral'), route: '/referral', color: colors.warning },
    {
      icon: 'shield-checkmark',
      label: t('more.verification'),
      route: '/verification',
      color: colors.success,
    },
    { icon: 'podium', label: t('more.ranking'), route: '/ranking', color: colors.info },
    { icon: 'clipboard', label: t('more.assessment'), route: '/assessment', color: colors.pink },
    {
      icon: 'settings',
      label: t('more.settings'),
      route: '/settings',
      color: colors.mutedForeground,
    },
    { icon: 'calendar', label: t('more.timeline'), route: '/timeline', color: colors.primary },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>{t('more.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.foregroundMuted }]}>
          {t('more.subtitle')}
        </Text>
      </View>

      <View style={styles.grid}>
        {items.map((item, index) => (
          <FadeInView key={item.route} index={index} staggerDelay={30} style={styles.gridItem}>
            <TouchableOpacity
              onPress={() => router.push(item.route as never)}
              activeOpacity={0.7}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View
                style={[styles.iconContainer, { backgroundColor: withOpacity(item.color, 0.1) }]}
              >
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={[styles.cardLabel, { color: colors.foreground }]} numberOfLines={1}>
                {item.label}
              </Text>
              {item.badge !== undefined && item.badge > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text
                    style={[
                      styles.badgeText,
                      { color: colors.primaryForeground, fontFamily: fontFamily.mono },
                    ]}
                  >
                    {item.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </FadeInView>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    justifyContent: 'flex-start',
  },
  gridItem: {
    width: '31%',
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    minWidth: 100,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
