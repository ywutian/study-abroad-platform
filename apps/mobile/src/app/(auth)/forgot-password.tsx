import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async () => {
    if (!email) {
      setError(t('auth.errors.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email }, { skipAuth: true });
      setSent(true);
      toast.success(t('auth.resetPassword.sent'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { paddingTop: insets.top + spacing['4xl'] }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="mail-open" size={48} color={colors.success} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('auth.resetPassword.sent')}
          </Text>
          <Text style={[styles.description, { color: colors.foregroundMuted }]}>
            {t('auth.verifyEmail.description', { email })}
          </Text>
          <Button
            variant="outline"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            {t('auth.verifyEmail.backToLogin')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing['2xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backNav}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="key" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('auth.resetPassword.title')}
          </Text>
          <Text style={[styles.description, { color: colors.foregroundMuted }]}>
            {t('auth.resetPassword.description')}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label={t('auth.login.email')}
            placeholder={t('auth.login.emailPlaceholder')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(undefined);
            }}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={
              <Ionicons name="mail-outline" size={20} color={colors.foregroundMuted} />
            }
          />

          <Button
            onPress={handleSubmit}
            loading={loading}
            size="lg"
          >
            {t('auth.resetPassword.sendLink')}
          </Button>
        </View>

        {/* Login link */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.foregroundMuted }]}>
            {t('auth.register.hasAccount')}
          </Text>
          <Link href="/(auth)/login">
            <Text style={[styles.footerLink, { color: colors.primary }]}>
              {t('auth.register.signIn')}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    minHeight: '100%',
  },
  backNav: {
    marginBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    marginBottom: spacing['2xl'],
  },
  backButton: {
    marginTop: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: fontSize.sm,
  },
  footerLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});

