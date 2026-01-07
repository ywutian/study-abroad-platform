import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useColors, spacing, fontSize, borderRadius, fontWeight } from '@/utils/theme';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

interface AnimatedButtonProps {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'none';
  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function AnimatedButton({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  hapticFeedback = 'light',
  accessibilityLabel,
  accessibilityHint,
}: AnimatedButtonProps) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const triggerHaptic = () => {
    if (hapticFeedback === 'none') return;
    const impactStyle = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    }[hapticFeedback];
    Haptics.impactAsync(impactStyle);
  };

  const handlePress = () => {
    if (onPress && !disabled && !loading) {
      onPress();
    }
  };

  const gesture = Gesture.Tap()
    .enabled(!disabled && !loading)
    .onBegin(() => {
      scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
      opacity.value = withTiming(0.85, { duration: 100 });
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      opacity.value = withTiming(1, { duration: 100 });
    })
    .onEnd(() => {
      runOnJS(triggerHaptic)();
      runOnJS(handlePress)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'destructive':
        return {
          container: { backgroundColor: colors.error },
          text: { color: '#ffffff' },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.border,
          },
          text: { color: colors.foreground },
        };
      case 'secondary':
        return {
          container: { backgroundColor: colors.muted },
          text: { color: colors.foreground },
        };
      case 'ghost':
        return {
          container: { backgroundColor: 'transparent' },
          text: { color: colors.foreground },
        };
      case 'link':
        return {
          container: { backgroundColor: 'transparent' },
          text: { color: colors.primary, textDecorationLine: 'underline' },
        };
      default:
        return {
          container: { backgroundColor: colors.primary },
          text: { color: colors.primaryForeground },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            height: 36,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
          },
          text: { fontSize: fontSize.sm },
        };
      case 'lg':
        return {
          container: {
            height: 48,
            paddingHorizontal: spacing.xl,
            borderRadius: borderRadius.lg,
          },
          text: { fontSize: fontSize.lg },
        };
      case 'icon':
        return {
          container: {
            height: 40,
            width: 40,
            paddingHorizontal: 0,
            borderRadius: borderRadius.md,
          },
          text: { fontSize: fontSize.base },
        };
      default:
        return {
          container: {
            height: 44,
            paddingHorizontal: spacing.lg,
            borderRadius: borderRadius.md,
          },
          text: { fontSize: fontSize.base },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // 生成无障碍标签
  const getAccessibilityLabel = () => {
    if (accessibilityLabel) return accessibilityLabel;
    if (typeof children === 'string') return children;
    return undefined;
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.container,
          sizeStyles.container,
          variantStyles.container,
          (disabled || loading) && styles.disabled,
          animatedStyle,
          style,
        ]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: disabled || loading,
          busy: loading,
        }}
      >
        {loading ? (
          <ActivityIndicator color={variantStyles.text.color} size="small" />
        ) : (
          <>
            {leftIcon}
            {typeof children === 'string' ? (
              <Text
                style={[
                  styles.text,
                  sizeStyles.text,
                  variantStyles.text,
                  leftIcon ? { marginLeft: spacing.sm } : undefined,
                  rightIcon ? { marginRight: spacing.sm } : undefined,
                  textStyle,
                ]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
            {rightIcon}
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: fontWeight.medium,
  },
  disabled: {
    opacity: 0.5,
  },
});



