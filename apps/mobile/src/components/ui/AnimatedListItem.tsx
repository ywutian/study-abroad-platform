import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  FadeInRight,
  FadeOutLeft,
  Layout,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useColors, spacing, borderRadius } from '@/utils/theme';

interface AnimatedListItemProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  onPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeable?: boolean;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  staggerDelay?: number;
}

export function AnimatedListItem({
  children,
  style,
  index = 0,
  onPress,
  onSwipeLeft,
  onSwipeRight,
  swipeable = false,
  leftAction,
  rightAction,
  staggerDelay = 50,
}: AnimatedListItemProps) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  // 点击手势
  const tapGesture = Gesture.Tap()
    .enabled(!!onPress)
    .onBegin(() => {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
      opacity.value = withTiming(0.9, { duration: 100 });
    })
    .onFinalize(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      opacity.value = withTiming(1, { duration: 100 });
    })
    .onEnd(() => {
      runOnJS(triggerHaptic)();
      runOnJS(handlePress)();
    });

  // 滑动手势
  const panGesture = Gesture.Pan()
    .enabled(swipeable)
    .onUpdate((event) => {
      // 限制滑动范围
      const maxTranslate = 100;
      translateX.value = Math.max(
        -maxTranslate,
        Math.min(maxTranslate, event.translationX)
      );
    })
    .onEnd((event) => {
      const threshold = 60;
      if (event.translationX > threshold && onSwipeRight) {
        runOnJS(onSwipeRight)();
        runOnJS(triggerHaptic)();
      } else if (event.translationX < -threshold && onSwipeLeft) {
        runOnJS(onSwipeLeft)();
        runOnJS(triggerHaptic)();
      }
      // 回弹
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value,
  }));

  const enteringAnimation = FadeInRight.delay(index * staggerDelay)
    .duration(300)
    .springify();

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        entering={enteringAnimation}
        layout={Layout.springify()}
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          animatedStyle,
          style,
        ]}
      >
        {/* 左侧操作区 */}
        {leftAction && swipeable && (
          <View style={[styles.actionContainer, styles.leftAction]}>
            {leftAction}
          </View>
        )}

        {/* 内容区 */}
        {children}

        {/* 右侧操作区 */}
        {rightAction && swipeable && (
          <View style={[styles.actionContainer, styles.rightAction]}>
            {rightAction}
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// 简化的列表项动画容器（仅交错进入）
interface StaggeredItemProps {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
  staggerDelay?: number;
}

export function StaggeredItem({
  children,
  index,
  style,
  staggerDelay = 50,
}: StaggeredItemProps) {
  const enteringAnimation = FadeInRight.delay(index * staggerDelay)
    .duration(300)
    .springify();

  return (
    <Animated.View
      entering={enteringAnimation}
      layout={Layout.springify()}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  leftAction: {
    right: '100%',
  },
  rightAction: {
    left: '100%',
  },
});









