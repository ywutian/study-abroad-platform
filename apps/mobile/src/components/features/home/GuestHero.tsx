import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AnimatedButton } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export function GuestHero() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{t('home.guestWelcome')}</Text>
      <Text style={[styles.subtitle, { color: colors.foregroundMuted }]}>
        {t('home.loginPrompt')}
      </Text>
      <AnimatedButton
        onPress={() => router.push('/(auth)/login')}
        style={styles.button}
        accessibilityLabel={t('common.login')}
      >
        {t('common.login')}
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    margin: spacing.lg,
    marginBottom: 0,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  subtitle: { fontSize: fontSize.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  button: { alignSelf: 'flex-start' },
});
