import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

interface StatItem {
  value: number | string;
  label: string;
  color?: string;
}

interface StatsRowProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  style?: StyleProp<ViewStyle>;
  showDividers?: boolean;
}

export function StatsRow({ stats, columns, style, showDividers = false }: StatsRowProps) {
  const colors = useColors();
  const cols = columns ?? stats.length;

  return (
    <View style={[styles.container, style]}>
      {stats.map((stat, index) => (
        <React.Fragment key={index}>
          {showDividers && index > 0 && (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}
          <View style={[styles.stat, { flex: 1 / cols }]}>
            <Text style={[styles.value, { color: stat.color ?? colors.foreground }]}>
              {stat.value}
            </Text>
            <Text style={[styles.label, { color: colors.foregroundMuted }]}>{stat.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  value: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: fontSize.xs,
  },
  divider: {
    width: 1,
    height: 32,
    marginHorizontal: spacing.sm,
  },
});
