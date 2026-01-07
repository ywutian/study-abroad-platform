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

import { Button, Input, Checkbox } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const register = useAuthStore((state) => state.register);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    
    if (!email) {
      newErrors.email = t('auth.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.errors.invalidEmail');
    }
    
    if (!password) {
      newErrors.password = t('auth.errors.passwordRequired');
    } else if (password.length < 8) {
      newErrors.password = t('auth.errors.passwordTooShort');
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.errors.passwordMismatch');
    }

    if (!agreeTerms) {
      newErrors.terms = t('errors.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await register({ email, password });
      toast.success(t('auth.register.registerSuccess'));
      router.replace('/(tabs)');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.register.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

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
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
            <Ionicons name="person-add" size={40} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('auth.register.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.foregroundMuted }]}>
            {t('auth.register.subtitle')}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label={t('auth.register.email')}
            placeholder={t('auth.register.emailPlaceholder')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={
              <Ionicons name="mail-outline" size={20} color={colors.foregroundMuted} />
            }
          />

          <Input
            label={t('auth.register.password')}
            placeholder={t('auth.register.passwordPlaceholder')}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
            error={errors.password}
            secureTextEntry
            autoComplete="new-password"
            leftIcon={
              <Ionicons name="lock-closed-outline" size={20} color={colors.foregroundMuted} />
            }
          />

          <Input
            label={t('auth.register.confirmPassword')}
            placeholder={t('auth.register.confirmPlaceholder')}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
            }}
            error={errors.confirmPassword}
            secureTextEntry
            autoComplete="new-password"
            leftIcon={
              <Ionicons name="lock-closed-outline" size={20} color={colors.foregroundMuted} />
            }
          />

          <Checkbox
            checked={agreeTerms}
            onPress={() => {
              setAgreeTerms(!agreeTerms);
              if (errors.terms) setErrors({ ...errors, terms: undefined });
            }}
            label={t('auth.register.agreeTerms')}
          />
          {errors.terms && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {errors.terms}
            </Text>
          )}

          <Button
            onPress={handleRegister}
            loading={loading}
            size="lg"
            style={styles.registerButton}
          >
            {t('auth.register.registerButton')}
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
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.base,
  },
  form: {
    marginBottom: spacing['2xl'],
  },
  errorText: {
    fontSize: fontSize.xs,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
  registerButton: {
    marginTop: spacing.lg,
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

