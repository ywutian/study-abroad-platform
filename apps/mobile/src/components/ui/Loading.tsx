import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors as themeColors, spacing, fontSize } from '@/utils/theme';

// Use light theme colors as default - these components may be used before providers are ready
const defaultColors = themeColors.light;

interface LoadingProps {
  size?: 'small' | 'large';
  text?: string;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Loading({ size = 'large', text, fullScreen = false, style }: LoadingProps) {
  const content = (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={defaultColors.primary} />
      {text !== undefined && (
        <Text style={[styles.text, { color: defaultColors.foregroundMuted }]}>
          {text || 'Loading...'}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View 
        style={[
          styles.fullScreen, 
          { backgroundColor: defaultColors.background }
        ]}
      >
        {content}
      </View>
    );
  }

  return content;
}

// Skeleton loading component
interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ 
  width = '100%' as const, 
  height = 20, 
  borderRadius = 4,
  style 
}: SkeletonProps) {
  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as number | `${number}%`,
          height,
          borderRadius,
          backgroundColor: defaultColors.muted,
        },
        style,
      ]}
    />
  );
}

// Loading overlay
interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
}

export function LoadingOverlay({ visible, text }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: defaultColors.overlay }]}>
      <View 
        style={[
          styles.overlayContent, 
          { backgroundColor: defaultColors.card }
        ]}
      >
        <ActivityIndicator size="large" color={defaultColors.primary} />
        <Text style={[styles.overlayText, { color: defaultColors.foreground }]}>
          {text || 'Loading...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
  },
  skeleton: {
    opacity: 0.5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    padding: spacing['2xl'],
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  overlayText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
  },
});
