import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  ViewStyle,
  StyleProp,
  useColorScheme,
} from 'react-native';
import { colors as themeColors, spacing, fontSize } from '@/utils/theme';

// Use system color scheme to pick colors — avoids white flash when user is in dark mode
function useDefaultColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? themeColors.dark : themeColors.light;
}

interface LoadingProps {
  size?: 'small' | 'large';
  text?: string;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Loading({ size = 'large', text, fullScreen = false, style }: LoadingProps) {
  const colors = useDefaultColors();
  const content = (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={colors.primary} />
      {text !== undefined && (
        <Text style={[styles.text, { color: colors.foregroundMuted }]}>{text || 'Loading...'}</Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>{content}</View>
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
  style,
}: SkeletonProps) {
  // Theme-aware: use the active scheme's muted color so dark-mode skeletons
  // don't flash the light cream palette on a near-black background.
  const colors = useDefaultColors();
  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as number | `${number}%`,
          height,
          borderRadius,
          backgroundColor: colors.muted,
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
  const colors = useDefaultColors();
  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
      <View style={[styles.overlayContent, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.overlayText, { color: colors.foreground }]}>
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
