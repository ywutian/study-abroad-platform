/**
 * 设置页面
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Constants from 'expo-constants';

import { AnimatedCard, CardContent, Switch, Avatar, AnimatedButton, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
  type Colors,
} from '@/utils/theme';
import { useAuthStore } from '@/stores';
import { useThemeStore } from '@/stores/theme';
import { userRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useNotificationPreferences } from '@/hooks/useNotifications';

export const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';

interface SettingItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  type: 'navigate' | 'toggle' | 'action' | 'info';
  onPress?: () => void;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { colorScheme, setMode } = useThemeStore();
  const toast = useToast();

  const [biometrics, setBiometrics] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Delete account state
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { preferences, updatePreferences } = useNotificationPreferences();

  // Load biometric state on mount
  useEffect(() => {
    async function checkBiometrics() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(hasHardware && isEnrolled);

        if (hasHardware && isEnrolled) {
          const stored = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
          setBiometrics(stored === 'true');
        }
      } catch {
        setBiometricAvailable(false);
      }
    }
    checkBiometrics();
  }, []);

  const handleLogout = () => {
    Alert.alert(t('common.logout'), t('settings.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // Delete account - show dialog with password input
  const handleDeleteAccount = () => {
    setDeletePassword('');
    setDeleteDialogVisible(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error(t('auth.errors.passwordRequired'));
      return;
    }

    setDeleting(true);
    try {
      await apiClient.delete(userRoutes.me(), {
        body: JSON.stringify({ password: deletePassword }),
      });

      setDeleteDialogVisible(false);
      toast.success(t('settings.deleteAccountSuccess'));
      await logout();
      router.replace('/(auth)/login');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('errors.unknown');
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleLanguageChange = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    Haptics.selectionAsync();
  };

  // App Store Review
  const handleRateApp = async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      } else {
        // Fallback: open app store URL or show thank you
        Alert.alert(t('settings.thankYou'), t('settings.thankYouReview'));
      }
    } catch {
      Alert.alert(t('settings.thankYou'), t('settings.thankYouReview'));
    }
  };

  // Biometric toggle handler
  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Verify biometric before enabling
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('settings.biometricVerify'),
          fallbackLabel: t('common.cancel'),
          disableDeviceFallback: false,
        });

        if (result.success) {
          await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
          setBiometrics(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.success(t('settings.biometricEnabled'));
        }
        // If user cancelled, don't change state
      } catch {
        toast.error(t('settings.biometricFailed'));
      }
    } else {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
      setBiometrics(false);
      Haptics.selectionAsync();
      toast.info(t('settings.biometricDisabled'));
    }
  };

  const sections: SettingSection[] = [
    {
      title: t('settings.sections.account'),
      items: [
        {
          icon: 'person-outline',
          label: t('settings.personalInfo'),
          type: 'navigate',
          onPress: () => router.push('/profile/basic' as Href),
        },
        {
          icon: 'shield-checkmark-outline',
          label: t('settings.accountSecurity'),
          type: 'navigate',
          onPress: () => router.push('/security' as Href),
        },
      ],
    },
    {
      title: t('settings.sections.preferences'),
      items: [
        {
          icon: 'moon-outline',
          label: t('settings.darkMode'),
          type: 'toggle',
          toggleValue: colorScheme === 'dark',
          onToggle: (value) => {
            setMode(value ? 'dark' : 'light');
            Haptics.selectionAsync();
          },
        },
        {
          icon: 'language-outline',
          label: t('settings.language'),
          value: i18n.language === 'zh' ? t('settings.languageZh') : t('settings.languageEn'),
          type: 'navigate',
          onPress: handleLanguageChange,
        },
        ...(biometricAvailable
          ? [
              {
                icon: 'finger-print-outline' as keyof typeof Ionicons.glyphMap,
                label: t('settings.biometrics'),
                type: 'toggle' as const,
                toggleValue: biometrics,
                onToggle: handleBiometricToggle,
              },
            ]
          : []),
      ],
    },
    {
      title: t('settings.sections.notifications'),
      items: [
        {
          icon: 'notifications-outline',
          label: t('settings.pushNotification'),
          type: 'toggle',
          toggleValue: preferences?.readiness.remotePush ?? false,
          onToggle: async (value) => {
            try {
              await updatePreferences({ readinessRemotePush: value });
              Haptics.selectionAsync();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : t('errors.unknown'));
            }
          },
        },
      ],
    },
    {
      title: t('settings.sections.security'),
      items: [
        {
          icon: 'key-outline',
          label: t('settings.changePassword'),
          type: 'navigate',
          onPress: () => router.push('/security' as Href),
        },
        {
          icon: 'phone-portrait-outline',
          label: t('settings.loginDevices'),
          type: 'navigate',
          onPress: () => router.push('/security' as Href),
        },
      ],
    },
    {
      title: t('settings.sections.help'),
      items: [
        {
          icon: 'help-circle-outline',
          label: t('settings.faq'),
          type: 'navigate',
          onPress: () => Linking.openURL('https://www.lumniedu.com/help'),
        },
        {
          icon: 'chatbubble-outline',
          label: t('settings.feedback'),
          type: 'navigate',
          onPress: () => Linking.openURL('mailto:contact@studyabroad.com'),
        },
      ],
    },
    {
      title: t('settings.sections.support'),
      items: [
        {
          icon: 'help-circle-outline',
          label: t('settings.helpCenter'),
          type: 'navigate',
          onPress: () => Linking.openURL('https://www.lumniedu.com/help'),
        },
        {
          icon: 'chatbubble-outline',
          label: t('settings.contactSupport'),
          type: 'navigate',
          onPress: () => Linking.openURL('mailto:contact@studyabroad.com'),
        },
        {
          icon: 'star-outline',
          label: t('settings.rateApp'),
          type: 'navigate',
          onPress: handleRateApp,
        },
      ],
    },
    {
      title: t('settings.sections.about'),
      items: [
        {
          icon: 'information-circle-outline',
          label: t('settings.version'),
          value: Constants.expoConfig?.version || '1.0.0',
          type: 'info',
        },
        {
          icon: 'document-text-outline',
          label: t('settings.termsOfService'),
          type: 'navigate',
          onPress: () => Linking.openURL('https://www.lumniedu.com/terms'),
        },
        {
          icon: 'shield-outline',
          label: t('settings.privacyPolicy'),
          type: 'navigate',
          onPress: () => Linking.openURL('https://www.lumniedu.com/privacy'),
        },
      ],
    },
  ];

  // 添加登出和删除账号
  if (isAuthenticated) {
    sections.push({
      title: t('settings.sections.accountActions'),
      items: [
        {
          icon: 'log-out-outline',
          label: t('common.logout'),
          type: 'action',
          onPress: handleLogout,
        },
        {
          icon: 'trash-outline',
          label: t('settings.deleteAccount'),
          type: 'action',
          danger: true,
          onPress: handleDeleteAccount,
        },
      ],
    });
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        {isAuthenticated && user && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <TouchableOpacity
              onPress={() => router.push('/profile/basic' as Href)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('settings.personalInfo')}
            >
              <AnimatedCard style={styles.profileCard}>
                <CardContent style={styles.profileContent}>
                  <Avatar source={undefined} name={user.email} size="lg" />
                  <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: colors.foreground }]}>
                      {user.email.split('@')[0]}
                    </Text>
                    <Text style={[styles.profileEmail, { color: colors.foregroundMuted }]}>
                      {user.email}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
                </CardContent>
              </AnimatedCard>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Settings Sections */}
        {sections.map((section, sectionIndex) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(100 + sectionIndex * 50).duration(400)}
            style={styles.section}
          >
            <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>
              {section.title}
            </Text>
            <AnimatedCard>
              <CardContent style={styles.sectionContent}>
                {section.items.map((item, itemIndex) => (
                  <React.Fragment key={item.label}>
                    {itemIndex > 0 && (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                    <SettingRow item={item} colors={colors} />
                  </React.Fragment>
                ))}
              </CardContent>
            </AnimatedCard>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Delete Account Dialog with password confirmation */}
      {deleteDialogVisible && (
        <View style={[styles.passwordOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.passwordDialog, { backgroundColor: colors.card }]}>
            <View
              style={[
                styles.deleteIconContainer,
                { backgroundColor: withOpacity(colors.error, 0.08) },
              ]}
            >
              <Ionicons name="trash" size={32} color={colors.error} />
            </View>
            <Text style={[styles.deleteTitle, { color: colors.foreground }]}>
              {t('settings.deleteAccount')}
            </Text>
            <Text style={[styles.deleteMessage, { color: colors.foregroundMuted }]}>
              {t('settings.deleteAccountConfirm')}
            </Text>
            <Input
              label={t('settings.enterPasswordToDelete')}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder={t('auth.login.passwordPlaceholder')}
              secureTextEntry
              containerStyle={styles.passwordInput}
            />
            <View style={styles.deleteActions}>
              <AnimatedButton
                variant="outline"
                onPress={() => {
                  setDeleteDialogVisible(false);
                  setDeletePassword('');
                }}
                style={styles.deleteActionButton}
                disabled={deleting}
              >
                {t('common.cancel')}
              </AnimatedButton>
              <AnimatedButton
                variant="destructive"
                onPress={handleConfirmDeleteAccount}
                style={styles.deleteActionButton}
                loading={deleting}
              >
                {t('common.delete')}
              </AnimatedButton>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

// Setting Row Component
function SettingRow({ item, colors }: { item: SettingItem; colors: Colors }) {
  const textColor = item.danger ? colors.error : colors.foreground;

  const content = (
    <View style={styles.settingRow}>
      <View
        style={[
          styles.settingIcon,
          {
            backgroundColor: item.danger ? withOpacity(colors.error, 0.08) : colors.muted,
          },
        ]}
      >
        <Ionicons name={item.icon} size={20} color={item.danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: textColor }]}>{item.label}</Text>

      {item.type === 'toggle' ? (
        <Switch
          value={item.toggleValue || false}
          onValueChange={item.onToggle || (() => {})}
          accessibilityLabel={item.label}
        />
      ) : item.type === 'info' ? (
        <Text
          style={[
            styles.settingValue,
            { color: colors.foregroundMuted, fontFamily: fontFamily.mono },
          ]}
        >
          {item.value}
        </Text>
      ) : (
        <View style={styles.settingRight}>
          {item.value && (
            <Text style={[styles.settingValue, { color: colors.foregroundMuted }]}>
              {item.value}
            </Text>
          )}
          {item.type === 'navigate' && (
            <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
          )}
        </View>
      )}
    </View>
  );

  if (item.type === 'toggle' || item.type === 'info') {
    return content;
  }

  return (
    <TouchableOpacity
      onPress={item.onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    margin: spacing.lg,
    marginBottom: 0,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionContent: {
    padding: 0,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fontSize.base,
  },
  settingValue: {
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  // Delete account password dialog
  passwordOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 100,
  },
  passwordDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  deleteTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  deleteMessage: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  passwordInput: {
    width: '100%',
    marginBottom: spacing.md,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  deleteActionButton: {
    flex: 1,
  },
});
