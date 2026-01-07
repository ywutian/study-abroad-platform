/**
 * 状态徽章组件
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

type StatusType = 
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'active'
  | 'inactive';

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function StatusBadge({
  status,
  size = 'md',
  showIcon = false,
  style,
}: StatusBadgeProps) {
  const colors = useColors();

  const statusConfigs: Record<StatusType, StatusConfig> = {
    draft: {
      label: '草稿',
      color: colors.warning,
      bgColor: colors.warning + '20',
      icon: 'create-outline',
    },
    pending: {
      label: '待处理',
      color: colors.warning,
      bgColor: colors.warning + '20',
      icon: 'time-outline',
    },
    in_progress: {
      label: '进行中',
      color: colors.info,
      bgColor: colors.info + '20',
      icon: 'reload-outline',
    },
    review: {
      label: '审核中',
      color: colors.primary,
      bgColor: colors.primary + '20',
      icon: 'eye-outline',
    },
    approved: {
      label: '已通过',
      color: colors.success,
      bgColor: colors.success + '20',
      icon: 'checkmark-circle-outline',
    },
    rejected: {
      label: '已拒绝',
      color: colors.error,
      bgColor: colors.error + '20',
      icon: 'close-circle-outline',
    },
    completed: {
      label: '已完成',
      color: colors.success,
      bgColor: colors.success + '20',
      icon: 'checkmark-done-outline',
    },
    cancelled: {
      label: '已取消',
      color: colors.foregroundMuted,
      bgColor: colors.muted,
      icon: 'ban-outline',
    },
    active: {
      label: '活跃',
      color: colors.success,
      bgColor: colors.success + '20',
      icon: 'pulse-outline',
    },
    inactive: {
      label: '未活跃',
      color: colors.foregroundMuted,
      bgColor: colors.muted,
      icon: 'moon-outline',
    },
  };

  const config = statusConfigs[status] || {
    label: status,
    color: colors.foregroundMuted,
    bgColor: colors.muted,
  };

  const sizes = {
    sm: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      fontSize: fontSize.xs,
      iconSize: 12,
    },
    md: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      fontSize: fontSize.sm,
      iconSize: 14,
    },
    lg: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.base,
      iconSize: 16,
    },
  };

  const sizeConfig = sizes[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          paddingVertical: sizeConfig.paddingVertical,
          paddingHorizontal: sizeConfig.paddingHorizontal,
        },
        style,
      ]}
    >
      {showIcon && config.icon && (
        <Ionicons
          name={config.icon}
          size={sizeConfig.iconSize}
          color={config.color}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color: config.color,
            fontSize: sizeConfig.fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    fontWeight: fontWeight.medium,
  },
});

export default StatusBadge;
