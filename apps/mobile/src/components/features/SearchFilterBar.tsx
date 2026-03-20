import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, borderRadius } from '@/utils/theme';
import { SearchBar } from '@/components/ui/SearchBar';
import { Badge } from '@/components/ui/Badge';

interface SearchFilterBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  filterCount?: number;
  onSortPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SearchFilterBar({
  value,
  onChangeText,
  placeholder,
  onFilterPress,
  filterCount,
  onSortPress,
  style,
}: SearchFilterBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchWrapper}>
        <SearchBar value={value} onChangeText={onChangeText} placeholder={placeholder} />
      </View>
      {onFilterPress && (
        <View>
          <TouchableOpacity
            onPress={onFilterPress}
            style={[styles.iconButton, { backgroundColor: colors.muted }]}
            accessibilityRole="button"
            accessibilityLabel="Filter"
          >
            <Ionicons name="options-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
          {filterCount !== undefined && filterCount > 0 && (
            <View style={styles.badgeWrapper}>
              <Badge variant="default">{String(filterCount)}</Badge>
            </View>
          )}
        </View>
      )}
      {onSortPress && (
        <TouchableOpacity
          onPress={onSortPress}
          style={[styles.iconButton, { backgroundColor: colors.muted }]}
          accessibilityRole="button"
          accessibilityLabel="Sort"
        >
          <Ionicons name="swap-vertical-outline" size={20} color={colors.foreground} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  searchWrapper: {
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrapper: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
});
