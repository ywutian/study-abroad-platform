/**
 * 进度条组件
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useColors, spacing, fontSize, fontWeight, borderRadius as br } from '@/utils/theme';

// ==================== Progress (简单进度条) ====================

interface ProgressProps {
  value: number;
  max?: number;
  height?: number;
  color?: string;
  trackColor?: string;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

export function Progress({
  value,
  max = 100,
  height = 8,
  color,
  trackColor,
  animated = true,
  style,
  borderRadius,
}: ProgressProps) {
  const colors = useColors();
  const progress = useSharedValue(0);
  
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const fillColor = color || colors.primary;
  const bgColor = trackColor || colors.muted;
  const radius = borderRadius ?? height / 2;

  useEffect(() => {
    if (animated) {
      progress.value = withTiming(percentage, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = percentage;
    }
  }, [percentage, animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        {
          height,
          backgroundColor: bgColor,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: fillColor,
            borderRadius: radius,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

// ==================== ProgressBar (带标签的进度条) ====================

interface ProgressBarProps extends ProgressProps {
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  size = 'md',
  color,
  trackColor,
  animated = true,
  style,
}: ProgressBarProps) {
  const colors = useColors();
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const heights = { sm: 4, md: 8, lg: 12 };
  const height = heights[size];

  return (
    <View style={[styles.progressBarContainer, style]}>
      {(label || showValue) && (
        <View style={styles.progressBarHeader}>
          {label && (
            <Text style={[styles.progressBarLabel, { color: colors.foreground }]}>
              {label}
            </Text>
          )}
          {showValue && (
            <Text style={[styles.progressBarValue, { color: colors.foregroundMuted }]}>
              {Math.round(percentage)}%
            </Text>
          )}
        </View>
      )}
      <Progress
        value={value}
        max={max}
        height={height}
        color={color}
        trackColor={trackColor}
        animated={animated}
      />
    </View>
  );
}

// ==================== CircularProgress (圆形进度) ====================

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  showValue?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  color,
  trackColor,
  showValue = true,
  label,
  style,
}: CircularProgressProps) {
  const colors = useColors();
  const progress = useSharedValue(0);
  
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const fillColor = color || colors.primary;
  const bgColor = trackColor || colors.muted;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.value = withTiming(percentage / 100, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [percentage]);

  const animatedProps = useAnimatedStyle(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[styles.circularContainer, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {/* Background Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress Circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          fill="none"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
          // @ts-ignore
          animatedProps={animatedProps}
        />
      </Svg>
      {(showValue || label) && (
        <View style={styles.circularContent}>
          {showValue && (
            <Text style={[styles.circularValue, { color: colors.foreground }]}>
              {Math.round(percentage)}%
            </Text>
          )}
          {label && (
            <Text style={[styles.circularLabel, { color: colors.foregroundMuted }]}>
              {label}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Progress
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  
  // ProgressBar
  progressBarContainer: {
    width: '100%',
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressBarLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  progressBarValue: {
    fontSize: fontSize.sm,
  },
  
  // CircularProgress
  circularContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  circularValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  circularLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});

export default Progress;
