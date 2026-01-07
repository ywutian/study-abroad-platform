import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
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

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  hapticFeedback?: boolean;
  scaleOnPress?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface CardTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

interface CardDescriptionProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

interface CardContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface CardFooterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedCard({
  children,
  style,
  onPress,
  hapticFeedback = true,
  scaleOnPress = true,
}: AnimatedCardProps) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.1);

  const triggerHaptic = () => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: shadowOpacity.value,
  }));

  if (onPress) {
    const gesture = Gesture.Tap()
      .onBegin(() => {
        if (scaleOnPress) {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
          shadowOpacity.value = withTiming(0.15, { duration: 100 });
        }
      })
      .onFinalize(() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        shadowOpacity.value = withTiming(0.1, { duration: 100 });
      })
      .onEnd(() => {
        runOnJS(triggerHaptic)();
        runOnJS(handlePress)();
      });

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.foreground,
            },
            animatedStyle,
            style,
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.foreground,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function CardTitle({ children, style }: CardTitleProps) {
  const colors = useColors();
  return (
    <Text style={[styles.title, { color: colors.cardForeground }, style]}>
      {children}
    </Text>
  );
}

export function CardDescription({ children, style }: CardDescriptionProps) {
  const colors = useColors();
  return (
    <Text style={[styles.description, { color: colors.foregroundMuted }, style]}>
      {children}
    </Text>
  );
}

export function CardContent({ children, style }: CardContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function CardFooter({ children, style }: CardFooterProps) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  description: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});




