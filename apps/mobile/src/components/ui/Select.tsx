import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { BottomSheet } from './Modal';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  disabled = false,
  style,
}: SelectProps) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: colors.foreground }]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.error : colors.inputBorder,
          },
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            {
              color: selectedOption
                ? colors.foreground
                : colors.placeholder,
            },
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={colors.foregroundMuted}
        />
      </TouchableOpacity>

      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}

      <BottomSheet
        visible={isOpen}
        onClose={() => setIsOpen(false)}
        title={label || placeholder}
      >
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item.value)}
              disabled={item.disabled}
              style={[
                styles.option,
                item.value === value && {
                  backgroundColor: colors.primary + '10',
                },
                item.disabled && styles.optionDisabled,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color: item.disabled
                      ? colors.foregroundMuted
                      : colors.foreground,
                  },
                  item.value === value && { color: colors.primary },
                ]}
              >
                {item.label}
              </Text>
              {item.value === value && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>
          )}
          style={styles.optionsList}
        />
      </BottomSheet>
    </View>
  );
}

// Multi-select variant
interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  max?: number;
  style?: StyleProp<ViewStyle>;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  disabled = false,
  max,
  style,
}: MultiSelectProps) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabels = options
    .filter((opt) => value.includes(opt.value))
    .map((opt) => opt.label)
    .join(', ');

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, optionValue]);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: colors.foreground }]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.error : colors.inputBorder,
          },
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            {
              color: selectedLabels
                ? colors.foreground
                : colors.placeholder,
            },
          ]}
          numberOfLines={1}
        >
          {selectedLabels || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={colors.foregroundMuted}
        />
      </TouchableOpacity>

      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}

      <BottomSheet
        visible={isOpen}
        onClose={() => setIsOpen(false)}
        title={label || placeholder}
      >
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => {
            const isSelected = value.includes(item.value);
            const isDisabledByMax = !isSelected && max !== undefined && value.length >= max;
            
            return (
              <TouchableOpacity
                onPress={() => handleToggle(item.value)}
                disabled={item.disabled || isDisabledByMax}
                style={[
                  styles.option,
                  isSelected && {
                    backgroundColor: colors.primary + '10',
                  },
                  (item.disabled || isDisabledByMax) && styles.optionDisabled,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isSelected
                        ? colors.primary
                        : colors.border,
                      backgroundColor: isSelected
                        ? colors.primary
                        : 'transparent',
                    },
                  ]}
                >
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={colors.primaryForeground}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: item.disabled || isDisabledByMax
                        ? colors.foregroundMuted
                        : colors.foreground,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
          style={styles.optionsList}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  triggerText: {
    flex: 1,
    fontSize: fontSize.base,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    flex: 1,
    fontSize: fontSize.base,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
});

