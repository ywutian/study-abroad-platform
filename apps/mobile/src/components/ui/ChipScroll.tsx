import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';

interface ChipItem {
  id: string;
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

interface ChipScrollProps {
  items: ChipItem[];
  selected: string;
  onSelect: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function ChipScroll({ items, selected, onSelect, style }: ChipScrollProps) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, style]}
    >
      {items.map((item) => {
        const isSelected = item.id === selected;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? withOpacity(colors.primary, 0.15) : colors.muted,
                borderColor: isSelected ? colors.primary : 'transparent',
              },
            ]}
          >
            {item.icon && (
              <Ionicons
                name={item.icon}
                size={14}
                color={isSelected ? colors.primary : colors.foregroundMuted}
                style={styles.chipIcon}
              />
            )}
            <Text
              style={[
                styles.chipText,
                {
                  color: isSelected ? colors.primary : colors.foregroundMuted,
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: spacing.xs,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
