import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import RNSlider from '@react-native-community/slider';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Slider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  label,
  showValue = true,
  formatValue,
  disabled = false,
  style,
}: SliderProps) {
  const colors = useColors();

  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <View style={[styles.container, style]}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && (
            <Text style={[styles.label, { color: colors.foreground }]}>
              {label}
            </Text>
          )}
          {showValue && (
            <Text style={[styles.value, { color: colors.primary }]}>
              {displayValue}
            </Text>
          )}
        </View>
      )}
      <RNSlider
        value={value}
        onValueChange={onValueChange}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        disabled={disabled}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.muted}
        thumbTintColor={colors.primary}
        style={[styles.slider, disabled && styles.disabled]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  value: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  disabled: {
    opacity: 0.5,
  },
});




