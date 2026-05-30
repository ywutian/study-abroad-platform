import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
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
          {label && <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>}
          {showValue && (
            <Text style={[styles.value, { color: colors.primary }]}>{displayValue}</Text>
          )}
        </View>
      )}
      {Platform.OS === 'web' ? (
        // @react-native-community/slider has no RN-web build (triggers an
        // "Invalid hook call" on web). Fall back to a native DOM range input so
        // the control works in web/Expo-web; iOS/Android keep RNSlider below.
        React.createElement('input' as never, {
          type: 'range',
          value,
          min: minimumValue,
          max: maximumValue,
          step,
          disabled,
          onChange: (e: { target: { value: string } }) =>
            onValueChange(Number(e?.target?.value ?? value)),
          style: {
            width: '100%',
            height: 40,
            accentColor: colors.primary,
            opacity: disabled ? 0.5 : 1,
          },
        })
      ) : (
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
      )}
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
