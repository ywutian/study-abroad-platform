import React, { useEffect, ReactNode } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  SlideInDown,
  SlideInUp,
  SlideInLeft,
  SlideInRight,
  ZoomIn,
  BounceIn,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type AnimationType =
  | 'fade'
  | 'fadeUp'
  | 'fadeDown'
  | 'fadeLeft'
  | 'fadeRight'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'zoom'
  | 'bounce';

interface FadeInViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  animation?: AnimationType;
  /** 用于列表交错动画的索引 */
  index?: number;
  /** 交错动画延迟间隔（毫秒） */
  staggerDelay?: number;
}

// 预设动画配置
const animationPresets = {
  fade: FadeIn,
  fadeUp: FadeInUp,
  fadeDown: FadeInDown,
  fadeLeft: FadeInLeft,
  fadeRight: FadeInRight,
  slideUp: SlideInUp,
  slideDown: SlideInDown,
  slideLeft: SlideInLeft,
  slideRight: SlideInRight,
  zoom: ZoomIn,
  bounce: BounceIn,
};

export function FadeInView({
  children,
  style,
  delay = 0,
  duration = 300,
  animation = 'fadeUp',
  index = 0,
  staggerDelay = 50,
}: FadeInViewProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <View style={style}>{children}</View>;
  }

  const totalDelay = delay + index * staggerDelay;
  const enteringAnimation = animationPresets[animation].delay(totalDelay).duration(duration);

  return (
    <Animated.View entering={enteringAnimation} style={style}>
      {children}
    </Animated.View>
  );
}

// 自定义动画视图（更灵活的控制）
interface CustomAnimatedViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  translateY?: number;
  translateX?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
}

export function CustomAnimatedView({
  children,
  style,
  delay = 0,
  duration = 300,
  translateY = 20,
  translateX = 0,
  scale = 1,
  rotate = 0,
  opacity = 0,
}: CustomAnimatedViewProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [delay, duration, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value * (1 - opacity) + opacity,
    transform: [
      { translateY: (1 - progress.value) * translateY },
      { translateX: (1 - progress.value) * translateX },
      { scale: 1 - (1 - progress.value) * (1 - scale) },
      { rotate: `${(1 - progress.value) * rotate}deg` },
    ],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

// 脉冲动画视图
interface PulseViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  minScale?: number;
  maxScale?: number;
}

export function PulseView({
  children,
  style,
  duration = 1000,
  minScale: _minScale = 0.97,
  maxScale = 1.03,
}: PulseViewProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    scale.value = withRepeat(withTiming(maxScale, { duration: duration / 2 }), -1, true);
  }, [duration, maxScale, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
