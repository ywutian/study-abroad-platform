import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';

interface PageHeaderAction {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
}

interface PageHeaderStat {
  value: number | string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  color?: string;
  stats?: PageHeaderStat[];
  actions?: PageHeaderAction[];
  style?: StyleProp<ViewStyle>;
}

export function PageHeader({
  title,
  description,
  icon,
  color,
  stats,
  actions,
  style,
}: PageHeaderProps) {
  const colors = useColors();
  const accentColor = color ?? colors.primary;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        <View style={styles.titleSection}>
          {icon && (
            <View
              style={[styles.iconContainer, { backgroundColor: withOpacity(accentColor, 0.1) }]}
            >
              <Ionicons name={icon} size={24} color={accentColor} />
            </View>
          )}
          <View style={styles.textSection}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            {description && (
              <Text style={[styles.description, { color: colors.foregroundMuted }]}>
                {description}
              </Text>
            )}
          </View>
        </View>
        {actions && actions.length > 0 && (
          <View style={styles.actions}>
            {actions.map((action, i) => (
              <View key={i} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={colors.foreground}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                />
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={[styles.divider, { backgroundColor: withOpacity(accentColor, 0.2) }]} />
      {stats && stats.length > 0 && (
        <View style={styles.statsRow}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textSection: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  description: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 2,
    borderRadius: 1,
    marginTop: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
