import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, fontSize, borderRadius, fontWeight } from '@/utils/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  ref?: React.Ref<TextInput>;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  inputContainerStyle,
  secureTextEntry,
  style,
  ref,
  ...props
}: InputProps) {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordInput = secureTextEntry !== undefined;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.error : isFocused ? colors.inputFocus : colors.inputBorder,
          },
          inputContainerStyle,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color: colors.foreground,
            },
            leftIcon ? { paddingLeft: 0 } : undefined,
            rightIcon || isPasswordInput ? { paddingRight: 0 } : undefined,
            style,
          ]}
          placeholderTextColor={colors.placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPasswordInput && !showPassword}
          {...props}
        />

        {isPasswordInput && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconRight}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.foregroundMuted}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !isPasswordInput && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>

      {(error || hint) && (
        <Text style={[styles.hint, { color: error ? colors.error : colors.foregroundMuted }]}>
          {error || hint}
        </Text>
      )}
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  iconLeft: {
    paddingLeft: spacing.md,
  },
  iconRight: {
    paddingRight: spacing.md,
  },
  hint: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
