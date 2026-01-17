import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors, spacing, fontSize, borderRadius } from '@/utils/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  onClear,
  autoFocus = false,
  style,
}: SearchBarProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.input,
          borderColor: isFocused ? colors.inputFocus : colors.inputBorder,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={20} color={colors.foregroundMuted} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || t('common.search')}
        placeholderTextColor={colors.placeholder}
        autoFocus={autoFocus}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        style={[styles.input, { color: colors.foreground }]}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color={colors.foregroundMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Search with filters variant
interface FilterOption {
  key: string;
  label: string;
}

interface SearchWithFiltersProps extends SearchBarProps {
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

export function SearchWithFilters({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  onClear,
  filters,
  activeFilter,
  onFilterChange,
  style,
}: SearchWithFiltersProps) {
  const colors = useColors();

  return (
    <View style={style}>
      <SearchBar
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        onSubmit={onSubmit}
        onClear={onClear}
      />
      {filters && filters.length > 0 && (
        <View style={styles.filtersContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => onFilterChange?.(filter.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === filter.key ? colors.primary : colors.muted,
                },
              ]}
            >
              <Ionicons
                name={activeFilter === filter.key ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={
                  activeFilter === filter.key ? colors.primaryForeground : colors.foregroundMuted
                }
                style={styles.filterIcon}
              />
              <View>
                <Ionicons
                  name="text"
                  size={0}
                  color={activeFilter === filter.key ? colors.primaryForeground : colors.foreground}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  filtersContainer: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  filterIcon: {
    marginRight: spacing.xs,
  },
});
