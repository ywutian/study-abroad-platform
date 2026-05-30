import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

export interface SectionHeaderProps {
  title: string;
  moreLabel?: string;
  onMore?: () => void;
}

export function SectionHeader({ title, moreLabel, onMore }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {moreLabel && onMore ? (
        <TouchableOpacity
          onPress={onMore}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel={moreLabel}
        >
          <Text style={[styles.moreText, { color: colors.primary }]}>{moreLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
    flex: 1,
    minWidth: 0,
  },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  moreText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
