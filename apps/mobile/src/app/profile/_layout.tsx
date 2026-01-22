import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/utils/theme';

export default function ProfileLayout() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.foreground,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="scores" options={{ title: t('profile.testScores') }} />
      <Stack.Screen name="activities" options={{ title: t('profile.activities') }} />
      <Stack.Screen name="awards" options={{ title: t('profile.awards') }} />
      <Stack.Screen name="education" options={{ title: t('profile.education') }} />
    </Stack>
  );
}
