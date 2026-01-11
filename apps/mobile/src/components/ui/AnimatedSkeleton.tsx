import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, borderRadius as br } from '@/utils/theme';

interface AnimatedSkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'circle' | 'text';
}

export function AnimatedSkeleton({
  width = '100%',
  height = 20,
  borderRadius = br.sm,
  style,
  variant = 'default',
}: AnimatedSkeletonProps) {
  const colors = useColors();
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1, // infinite
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmerProgress.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'circle':
        return {
          width: height,
          height: height,
          borderRadius: height / 2,
        };
      case 'text':
        return {
          height: 14,
          borderRadius: br.sm,
        };
      default:
        return {
          width: width as number | `${number}%`,
          height,
          borderRadius,
        };
    }
  };

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { backgroundColor: colors.muted },
        getVariantStyles(),
        animatedStyle,
        style,
      ]}
    />
  );
}

// 骨架屏卡片
interface SkeletonCardProps {
  style?: StyleProp<ViewStyle>;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.cardHeader}>
        <AnimatedSkeleton variant="circle" height={40} />
        <View style={styles.cardHeaderText}>
          <AnimatedSkeleton width="60%" height={16} />
          <AnimatedSkeleton width="40%" height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <AnimatedSkeleton height={14} style={{ marginBottom: 8 }} />
        <AnimatedSkeleton width="80%" height={14} style={{ marginBottom: 8 }} />
        <AnimatedSkeleton width="60%" height={14} />
      </View>
    </View>
  );
}

// 骨架屏列表项
interface SkeletonListItemProps {
  style?: StyleProp<ViewStyle>;
  hasAvatar?: boolean;
}

export function SkeletonListItem({ style, hasAvatar = true }: SkeletonListItemProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.listItem,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {hasAvatar && <AnimatedSkeleton variant="circle" height={48} />}
      <View style={[styles.listItemContent, !hasAvatar && { marginLeft: 0 }]}>
        <AnimatedSkeleton width="70%" height={16} />
        <AnimatedSkeleton width="50%" height={12} style={{ marginTop: 8 }} />
      </View>
      <AnimatedSkeleton width={60} height={24} borderRadius={br.md} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  card: {
    borderRadius: br.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  cardBody: {},
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: br.lg,
    borderWidth: 1,
    marginBottom: 8,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
});









