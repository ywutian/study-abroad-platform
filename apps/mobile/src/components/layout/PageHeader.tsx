import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { borderRadius, fontSize, fontWeight, spacing, useColors, withOpacity } from '@/utils/theme';

type PageHeaderVariant = 'marketing' | 'entry' | 'tool' | 'ai' | 'community' | 'admin';
type PageHeaderTone =
  | 'default'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ai'
  | 'reach'
  | 'target'
  | 'safety'
  | 'likely';

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
  variant?: PageHeaderVariant;
  tone?: PageHeaderTone;
  color?: string;
  stats?: PageHeaderStat[];
  actions?: PageHeaderAction[];
  style?: StyleProp<ViewStyle>;
}

const variantStyles: Record<PageHeaderVariant, { card: boolean; paddingTop: number }> = {
  marketing: { card: false, paddingTop: spacing.xl },
  entry: { card: false, paddingTop: spacing.lg },
  tool: { card: false, paddingTop: spacing.lg },
  ai: { card: true, paddingTop: spacing.lg },
  community: { card: true, paddingTop: spacing.lg },
  admin: { card: true, paddingTop: spacing.lg },
};

function resolveToneColor(
  colors: ReturnType<typeof useColors>,
  tone?: PageHeaderTone,
  color?: string
): string {
  if (color) {
    return color;
  }

  switch (tone) {
    case 'neutral':
      return colors.foregroundMuted;
    case 'success':
    case 'safety':
      return colors.success;
    case 'warning':
    case 'target':
      return colors.warning;
    case 'danger':
    case 'reach':
      return colors.error;
    case 'likely':
      return colors.info;
    case 'ai':
    case 'info':
    case 'default':
    default:
      return colors.primary;
  }
}

export function PageHeader({
  title,
  description,
  icon,
  variant = 'tool',
  tone = 'default',
  color,
  stats,
  actions,
  style,
}: PageHeaderProps) {
  const colors = useColors();
  const accentColor = resolveToneColor(colors, tone, color);
  const isCard = variantStyles[variant].card;
  const themedContainerStyle = isCard
    ? { backgroundColor: colors.card, borderColor: colors.border }
    : undefined;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: variantStyles[variant].paddingTop },
        isCard && styles.cardContainer,
        themedContainerStyle,
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleSection}>
          {icon ? (
            <View
              style={[styles.iconContainer, { backgroundColor: withOpacity(accentColor, 0.12) }]}
            >
              <Ionicons name={icon} size={24} color={accentColor} />
            </View>
          ) : null}
          <View style={styles.textSection}>
            <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>
              {title}
            </Text>
            {description ? (
              <Text style={[styles.description, { color: colors.foregroundMuted }]}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>
        {actions && actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((action, index) => (
              <View
                key={index}
                style={[styles.actionButton, { backgroundColor: colors.muted }]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={colors.foreground}
                  onPress={action.onPress}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.divider, { backgroundColor: withOpacity(accentColor, 0.24) }]} />

      {stats && stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[
                styles.stat,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  cardContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    lineHeight: 20,
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
    borderRadius: 999,
    marginTop: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
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
