import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColors, borderRadius, withOpacity } from '@/utils/theme';

type IconBadgeSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<IconBadgeSize, { container: number; icon: number }> = {
  sm: { container: 36, icon: 18 },
  md: { container: 44, icon: 22 },
  lg: { container: 56, icon: 28 },
};

interface IconBadgeProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  size?: IconBadgeSize;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconBadge({ icon, size = 'md', color, backgroundColor, style }: IconBadgeProps) {
  const colors = useColors();
  const sizeConfig = SIZE_MAP[size];
  const iconColor = color ?? colors.primary;
  const bgColor = backgroundColor ?? withOpacity(iconColor, 0.1);

  return (
    <View
      style={[
        styles.container,
        {
          width: sizeConfig.container,
          height: sizeConfig.container,
          borderRadius: borderRadius.lg,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={sizeConfig.icon} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
