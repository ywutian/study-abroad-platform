import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name={icon}
        size={64}
        color={colors.foregroundMuted}
        style={styles.icon}
      />
      <Text style={[styles.title, { color: colors.foreground }]}>
        {title || t('common.noData')}
      </Text>
      {description && (
        <Text style={[styles.description, { color: colors.foregroundMuted }]}>
          {description}
        </Text>
      )}
      {action && (
        <Button onPress={action.onPress} style={styles.button}>
          {action.label}
        </Button>
      )}
    </View>
  );
}

// Error state component
interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  title,
  description,
  onRetry,
  style,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name="alert-circle-outline"
        size={64}
        color={colors.error}
        style={styles.icon}
      />
      <Text style={[styles.title, { color: colors.foreground }]}>
        {title || t('common.error')}
      </Text>
      {description && (
        <Text style={[styles.description, { color: colors.foregroundMuted }]}>
          {description}
        </Text>
      )}
      {onRetry && (
        <Button onPress={onRetry} style={styles.button}>
          {t('common.retry')}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  icon: {
    marginBottom: spacing.lg,
    opacity: 0.6,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.xl,
  },
});




