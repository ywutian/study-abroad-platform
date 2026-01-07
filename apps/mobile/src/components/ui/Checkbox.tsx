import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Checkbox({
  checked,
  onPress,
  label,
  description,
  disabled = false,
  style,
}: CheckboxProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, disabled && styles.disabled, style]}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked ? colors.primary : colors.border,
            backgroundColor: checked ? colors.primary : 'transparent',
          },
        ]}
      >
        {checked && (
          <Ionicons
            name="checkmark"
            size={16}
            color={colors.primaryForeground}
          />
        )}
      </View>
      {(label || description) && (
        <View style={styles.textContainer}>
          {label && (
            <Text style={[styles.label, { color: colors.foreground }]}>
              {label}
            </Text>
          )}
          {description && (
            <Text style={[styles.description, { color: colors.foregroundMuted }]}>
              {description}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

interface RadioProps {
  selected: boolean;
  onPress: () => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Radio({
  selected,
  onPress,
  label,
  description,
  disabled = false,
  style,
}: RadioProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, disabled && styles.disabled, style]}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        {selected && (
          <View
            style={[
              styles.radioInner,
              { backgroundColor: colors.primary },
            ]}
          />
        )}
      </View>
      {(label || description) && (
        <View style={styles.textContainer}>
          {label && (
            <Text style={[styles.label, { color: colors.foreground }]}>
              {label}
            </Text>
          )}
          {description && (
            <Text style={[styles.description, { color: colors.foregroundMuted }]}>
              {description}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// Radio group component
interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function RadioGroup({
  options,
  value,
  onChange,
  label,
  style,
}: RadioGroupProps) {
  const colors = useColors();

  return (
    <View style={style}>
      {label && (
        <Text style={[styles.groupLabel, { color: colors.foreground }]}>
          {label}
        </Text>
      )}
      {options.map((option) => (
        <Radio
          key={option.value}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
          label={option.label}
          description={option.description}
          disabled={option.disabled}
          style={styles.radioItem}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  description: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  groupLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.md,
  },
  radioItem: {
    paddingVertical: spacing.sm,
  },
});




