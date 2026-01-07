/**
 * 动画数字组件
 */

import React, { useEffect } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColors, fontSize, fontWeight } from '@/utils/theme';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: StyleProp<TextStyle>;
}

export function AnimatedCounter({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  decimals = 0,
  style,
}: AnimatedCounterProps) {
  const colors = useColors();
  const [displayValue, setDisplayValue] = React.useState(0);

  // 由于 Reanimated 的限制，我们使用 useEffect 来更新显示值
  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    
    const interval = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startTime) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // cubic ease out
      const newValue = startValue + (value - startValue) * easedProgress;
      setDisplayValue(Math.round(newValue * Math.pow(10, decimals)) / Math.pow(10, decimals));
      
      if (progress >= 1) {
        clearInterval(interval);
        setDisplayValue(value);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [value, duration, decimals]);

  const formatValue = (val: number) => {
    if (decimals > 0) {
      return val.toFixed(decimals);
    }
    return Math.round(val).toLocaleString();
  };

  return (
    <Text
      style={[
        {
          fontSize: fontSize.xl,
          fontWeight: fontWeight.bold,
          color: colors.foreground,
        },
        style,
      ]}
    >
      {prefix}{formatValue(displayValue)}{suffix}
    </Text>
  );
}

/**
 * 格式化紧凑数字 (如 1.2K, 3.5M)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export default AnimatedCounter;
