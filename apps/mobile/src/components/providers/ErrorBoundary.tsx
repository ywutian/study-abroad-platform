/**
 * 全局错误边界
 *
 * 捕获 React 渲染错误，显示友好的错误页面
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { i18n } from '@/lib/i18n';
import { captureException } from '@/lib/sentry';

import { useColors, withOpacity, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

// ==================== ErrorFallback Function Component ====================

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  onReload: () => void;
}

function ErrorFallback({ error, errorInfo: _errorInfo, onRetry, onReload }: ErrorFallbackProps) {
  const themeColors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.content}>
        <View
          style={[styles.iconContainer, { backgroundColor: withOpacity(themeColors.error, 0.08) }]}
        >
          <Ionicons name="bug-outline" size={64} color={themeColors.error} />
        </View>

        <Text style={[styles.title, { color: themeColors.foreground }]}>
          {i18n.t('ui.error.title')}
        </Text>
        <Text style={[styles.message, { color: themeColors.foregroundMuted }]}>
          {i18n.t('ui.error.message')}
        </Text>

        {__DEV__ && error && (
          <ScrollView
            style={[styles.errorContainer, { backgroundColor: themeColors.muted }]}
            horizontal
          >
            <Text style={[styles.errorText, { color: themeColors.error }]}>{error.toString()}</Text>
          </ScrollView>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: themeColors.primary }]}
            onPress={onRetry}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={[styles.retryButtonText, { color: themeColors.primaryForeground }]}>
              {i18n.t('common.retry')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reloadButton, { backgroundColor: themeColors.muted }]}
            onPress={onReload}
          >
            <Ionicons name="reload-outline" size={20} color={themeColors.foreground} />
            <Text style={[styles.reloadButtonText, { color: themeColors.foreground }]}>
              {i18n.t('common.reload')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ==================== ErrorBoundary Class Component ====================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // 上报错误到 Sentry
    captureException(error, {
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      // 如果无法重新加载，至少重置错误状态
      this.handleRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

// ==================== Static Styles (layout-only, no colors) ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: fontSize.base,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  errorContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    maxHeight: 100,
    width: '100%',
  },
  errorText: {
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
  },
  actions: {
    gap: spacing.md,
    width: '100%',
  },
  retryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  reloadButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  reloadButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
});
