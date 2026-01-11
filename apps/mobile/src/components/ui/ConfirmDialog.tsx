/**
 * 确认对话框组件
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { AnimatedButton } from './AnimatedButton';

interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
  loading = false,
  icon,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const finalConfirmText = confirmText ?? t('ui.dialog.confirm');
  const finalCancelText = cancelText ?? t('ui.dialog.cancel');
  const isDestructive = variant === 'destructive';

  const defaultIcon = isDestructive ? 'warning' : 'help-circle';
  const iconColor = isDestructive ? colors.error : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.overlay]}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              entering={SlideInDown.springify().damping(15)}
              exiting={SlideOutDown.springify().damping(15)}
              style={[styles.dialog, { backgroundColor: colors.card }]}
            >
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                <Ionicons name={icon || defaultIcon} size={32} color={iconColor} />
              </View>

              {/* Content */}
              <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
              {message && (
                <Text style={[styles.message, { color: colors.foregroundMuted }]}>{message}</Text>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <AnimatedButton
                  variant="outline"
                  onPress={onClose}
                  style={styles.button}
                  disabled={loading}
                >
                  {finalCancelText}
                </AnimatedButton>
                <AnimatedButton
                  variant={isDestructive ? 'destructive' : 'default'}
                  onPress={onConfirm}
                  style={styles.button}
                  loading={loading}
                >
                  {finalConfirmText}
                </AnimatedButton>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  button: {
    flex: 1,
  },
});

export default ConfirmDialog;
