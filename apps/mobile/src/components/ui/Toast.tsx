import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  show: (config: ToastConfig) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ToastConfig>({ message: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (newConfig: ToastConfig) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setConfig(newConfig);
      setVisible(true);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const defaultDuration =
        newConfig.type === 'error' ? 5000 : newConfig.type === 'warning' ? 4000 : 3000;
      timeoutRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, newConfig.duration || defaultDuration);
    },
    [fadeAnim]
  );

  const success = useCallback(
    (message: string) => {
      show({ message, type: 'success' });
    },
    [show]
  );

  const error = useCallback(
    (message: string) => {
      show({ message, type: 'error' });
    },
    [show]
  );

  const warning = useCallback(
    (message: string) => {
      show({ message, type: 'warning' });
    },
    [show]
  );

  const info = useCallback(
    (message: string) => {
      show({ message, type: 'info' });
    },
    [show]
  );

  const getTypeConfig = () => {
    switch (config.type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          color: colors.success,
          bgColor: withOpacity(colors.success, 0.12),
          defaultDuration: 3000,
          liveRegion: 'polite' as const,
        };
      case 'error':
        return {
          icon: 'close-circle' as const,
          color: colors.error,
          bgColor: withOpacity(colors.error, 0.12),
          defaultDuration: 5000,
          liveRegion: 'assertive' as const,
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          color: colors.warning,
          bgColor: withOpacity(colors.warning, 0.12),
          defaultDuration: 4000,
          liveRegion: 'assertive' as const,
        };
      default:
        return {
          icon: 'information-circle' as const,
          color: colors.info,
          bgColor: withOpacity(colors.info, 0.12),
          defaultDuration: 3000,
          liveRegion: 'polite' as const,
        };
    }
  };

  const typeConfig = getTypeConfig();

  return (
    <ToastContext.Provider value={{ show, success, error, warning, info }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.container,
            {
              top: insets.top + spacing.md,
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion={typeConfig.liveRegion}
            style={[
              styles.toast,
              { shadowColor: colors.foreground },
              {
                backgroundColor: typeConfig.bgColor,
                borderColor: withOpacity(typeConfig.color, 0.3),
              },
            ]}
          >
            <View style={[styles.accentBar, { backgroundColor: typeConfig.color }]} />
            <Ionicons
              name={typeConfig.icon}
              size={20}
              color={typeConfig.color}
              style={styles.icon}
            />
            <Text style={[styles.message, { color: colors.foreground }]} numberOfLines={2}>
              {config.message}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }).start(() => setVisible(false));
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={colors.foregroundMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// Standalone Toast component for simple use
export function Toast({
  config,
  visible,
  onClose,
}: {
  config: ToastConfig;
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  const getTypeConfig = () => {
    switch (config.type) {
      case 'success':
        return { icon: 'checkmark-circle' as const, color: colors.success };
      case 'error':
        return { icon: 'close-circle' as const, color: colors.error };
      case 'warning':
        return { icon: 'warning' as const, color: colors.warning };
      default:
        return { icon: 'information-circle' as const, color: colors.info };
    }
  };

  if (!visible) return null;

  const typeConfig = getTypeConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + spacing.md,
          opacity: fadeAnim,
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          { shadowColor: colors.foreground },
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name={typeConfig.icon} size={20} color={typeConfig.color} style={styles.icon} />
        <Text style={[styles.message, { color: colors.foreground }]}>{config.message}</Text>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={colors.foregroundMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 2,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xl,
  },
  icon: {
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
