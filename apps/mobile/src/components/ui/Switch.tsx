import React from 'react';
import {
  View,
  Text,
  Switch as RNSwitch,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Switch({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
  style,
}: SwitchProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, disabled && styles.disabled, style]}>
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
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.muted,
          true: colors.primary + '80',
        }}
        thumbColor={value ? colors.primary : colors.foregroundMuted}
        ios_backgroundColor={colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.md,
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
});




