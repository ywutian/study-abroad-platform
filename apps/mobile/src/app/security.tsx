/**
 * Security Settings Page
 *
 * 1. Change Password with strength indicator
 * 2. Biometric Authentication toggle
 * 3. Active Sessions management
 * 4. Delete Account (destructive)
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Switch as RNSwitch, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton, AnimatedCard, CardContent, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { BIOMETRIC_ENABLED_KEY } from '@/screens/settings/SettingsScreen';
import { useAuthStore } from '@/stores';
import { spacing, useColors } from '@/utils/theme';
import {
  authRoutes,
  getPasswordPolicyChecks,
  isPasswordCompliant,
  userRoutes,
} from '@study-abroad/shared';
import { styles } from './security.styles';

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

function evaluatePasswordStrength(pw: string): { level: StrengthLevel; score: number } {
  if (!pw) return { level: 'weak', score: 0 };
  const passedCount = getPasswordPolicyChecks(pw).filter((check) => check.passed).length;

  if (isPasswordCompliant(pw)) {
    return { level: 'strong', score: 4 };
  }
  if (passedCount >= 5) {
    return { level: 'good', score: 3 };
  }
  if (passedCount >= 3) {
    return { level: 'fair', score: 2 };
  }
  return { level: 'weak', score: 1 };
}

export default function SecurityScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { logout } = useAuthStore();

  // -- Change Password --
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const strength = evaluatePasswordStrength(newPassword);

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.post(authRoutes.changePassword(), data),
    onSuccess: () => {
      toast.success(t('security.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => toast.error(err.message || t('security.passwordChangeFailed')),
  });

  const handleChangePassword = useCallback(() => {
    if (!currentPassword) {
      toast.error(t('security.currentPasswordRequired'));
      return;
    }
    if (!isPasswordCompliant(newPassword)) {
      toast.error(t('security.passwordTooWeak'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('security.passwordsDoNotMatch'));
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  }, [currentPassword, newPassword, confirmPassword, changePasswordMutation, toast, t]);

  // -- Biometrics --
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const hw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const available = hw && enrolled;
        setBiometricAvailable(available);
        if (available) {
          const stored = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
          setBiometricEnabled(stored === 'true');
        }
      } catch {
        setBiometricAvailable(false);
      } finally {
        setBiometricLoading(false);
      }
    })();
  }, []);

  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: t('security.biometricVerifyPrompt'),
            fallbackLabel: t('common.cancel'),
            disableDeviceFallback: false,
          });
          if (result.success) {
            await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
            setBiometricEnabled(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.success(t('security.biometricEnabled'));
          }
        } catch {
          toast.error(t('security.biometricFailed'));
        }
      } else {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
        setBiometricEnabled(false);
        Haptics.selectionAsync();
        toast.info(t('security.biometricDisabled'));
      }
    },
    [t, toast]
  );

  // -- Active Sessions --
  const logoutAllMutation = useMutation({
    mutationFn: () => apiClient.post(authRoutes.logoutAllSessions()),
    onSuccess: async () => {
      toast.success(t('security.loggedOutAll'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await logout();
      router.replace('/(auth)/login');
    },
    onError: (err: Error) => toast.error(err.message || t('security.logoutAllFailed')),
  });

  const handleLogoutAll = useCallback(() => {
    Alert.alert(t('security.logoutAllTitle'), t('security.logoutAllMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('security.logoutAllConfirm'),
        style: 'destructive',
        onPress: () => logoutAllMutation.mutate(),
      },
    ]);
  }, [logoutAllMutation, t]);

  // -- Delete Account --
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const deleteAccountMutation = useMutation({
    mutationFn: (password: string) =>
      apiClient.delete(userRoutes.me(), { body: JSON.stringify({ password }) }),
    onSuccess: async () => {
      setDeleteDialogVisible(false);
      toast.success(t('security.accountDeleted'));
      await logout();
      router.replace('/(auth)/login');
    },
    onError: (err: Error) => toast.error(err.message || t('security.deleteAccountFailed')),
  });

  const handleConfirmDelete = useCallback(() => {
    if (!deletePassword) {
      toast.error(t('security.enterPasswordToDelete'));
      return;
    }
    deleteAccountMutation.mutate(deletePassword);
  }, [deletePassword, deleteAccountMutation, toast, t]);

  const strengthColorMap: Record<StrengthLevel, string> = {
    weak: colors.error,
    fair: colors.warning,
    good: colors.info,
    strong: colors.success,
  };
  const sColor = strengthColorMap[strength.level];

  return (
    <>
      <Stack.Screen options={{ title: t('security.title') }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Change Password */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
          <AnimatedCard>
            <CardContent style={styles.cardInner}>
              <View style={styles.header}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="key-outline" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                  {t('security.changePassword')}
                </Text>
              </View>
              <Input
                label={t('security.currentPassword')}
                placeholder={t('security.currentPasswordPlaceholder')}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Input
                label={t('security.newPassword')}
                placeholder={t('security.newPasswordPlaceholder')}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              {newPassword.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBar}>
                    {[0, 1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthSeg,
                          {
                            backgroundColor: i < strength.score ? sColor : colors.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: sColor }]}>
                    {t(`security.strength.${strength.level}`)}
                  </Text>
                </View>
              )}
              <Input
                label={t('security.confirmPassword')}
                placeholder={t('security.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                error={
                  confirmPassword.length > 0 && newPassword !== confirmPassword
                    ? t('security.passwordsDoNotMatch')
                    : undefined
                }
              />
              <Text style={[styles.reqText, { color: colors.foregroundMuted }]}>
                {t('security.passwordRequirements')}
              </Text>
              <AnimatedButton
                onPress={handleChangePassword}
                loading={changePasswordMutation.isPending}
                disabled={
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  !isPasswordCompliant(newPassword) ||
                  newPassword !== confirmPassword
                }
                style={styles.btn}
              >
                {t('security.updatePassword')}
              </AnimatedButton>
            </CardContent>
          </AnimatedCard>
        </Animated.View>

        {/* Biometric Authentication */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.section}>
          <AnimatedCard>
            <CardContent style={styles.cardInner}>
              <View style={styles.header}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="finger-print-outline" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                  {t('security.biometricAuth')}
                </Text>
              </View>
              <Text style={[styles.desc, { color: colors.foregroundMuted }]}>
                {t('security.biometricDescription')}
              </Text>
              {biometricAvailable ? (
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
                    {t('security.enableBiometric')}
                  </Text>
                  <RNSwitch
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    disabled={biometricLoading}
                    trackColor={{ false: colors.muted, true: colors.primary + '80' }}
                    thumbColor={biometricEnabled ? colors.primary : colors.foregroundMuted}
                    ios_backgroundColor={colors.muted}
                  />
                </View>
              ) : (
                <View style={[styles.banner, { backgroundColor: colors.muted }]}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.foregroundMuted}
                  />
                  <Text style={[styles.bannerText, { color: colors.foregroundMuted }]}>
                    {t('security.biometricUnavailable')}
                  </Text>
                </View>
              )}
            </CardContent>
          </AnimatedCard>
        </Animated.View>

        {/* Active Sessions */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.section}>
          <AnimatedCard>
            <CardContent style={styles.cardInner}>
              <View style={styles.header}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                  {t('security.activeSessions')}
                </Text>
              </View>
              <Text style={[styles.desc, { color: colors.foregroundMuted }]}>
                {t('security.activeSessionsDescription')}
              </Text>
              <AnimatedButton
                variant="outline"
                onPress={handleLogoutAll}
                loading={logoutAllMutation.isPending}
                style={styles.btn}
                leftIcon={<Ionicons name="log-out-outline" size={18} color={colors.foreground} />}
              >
                {t('security.logoutAllDevices')}
              </AnimatedButton>
            </CardContent>
          </AnimatedCard>
        </Animated.View>

        {/* Delete Account */}
        <Animated.View entering={FadeInDown.duration(400).delay(240)} style={styles.section}>
          <AnimatedCard style={{ borderColor: colors.error + '40' }}>
            <CardContent style={styles.cardInner}>
              <View style={styles.header}>
                <View style={[styles.iconCircle, { backgroundColor: colors.error + '15' }]}>
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </View>
                <Text style={[styles.headerTitle, { color: colors.error }]}>
                  {t('security.deleteAccount')}
                </Text>
              </View>
              <Text style={[styles.desc, { color: colors.foregroundMuted }]}>
                {t('security.deleteAccountWarning')}
              </Text>
              <AnimatedButton
                variant="destructive"
                style={styles.btn}
                onPress={() => {
                  setDeletePassword('');
                  setDeleteDialogVisible(true);
                }}
                leftIcon={<Ionicons name="warning-outline" size={18} color="#fff9ef" />}
              >
                {t('security.deleteMyAccount')}
              </AnimatedButton>
            </CardContent>
          </AnimatedCard>
        </Animated.View>
      </ScrollView>

      {/* Delete Account Confirmation Dialog */}
      {deleteDialogVisible && (
        <View style={styles.overlay}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <View style={[styles.dialogIcon, { backgroundColor: colors.error + '15' }]}>
              <Ionicons name="trash" size={32} color={colors.error} />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
              {t('security.deleteAccount')}
            </Text>
            <Text style={[styles.dialogMsg, { color: colors.foregroundMuted }]}>
              {t('security.deleteAccountConfirmMessage')}
            </Text>
            <Input
              label={t('security.enterPassword')}
              placeholder={t('security.passwordPlaceholder')}
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoCapitalize="none"
              containerStyle={styles.dialogInput}
            />
            <View style={styles.dialogActions}>
              <AnimatedButton
                variant="outline"
                style={styles.dialogBtn}
                disabled={deleteAccountMutation.isPending}
                onPress={() => {
                  setDeleteDialogVisible(false);
                  setDeletePassword('');
                }}
              >
                {t('common.cancel')}
              </AnimatedButton>
              <AnimatedButton
                variant="destructive"
                style={styles.dialogBtn}
                loading={deleteAccountMutation.isPending}
                onPress={handleConfirmDelete}
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
