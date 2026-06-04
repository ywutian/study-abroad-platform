import React from 'react';
import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        // Each profile sub-screen is pushed individually, so it becomes the root
        // of this nested stack with no automatic back button. Provide an explicit
        // one (same fix as settings/index) so users are never stranded.
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ paddingRight: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen name="basic" options={{ title: t('profile.basicInfo') }} />
      <Stack.Screen name="scores" options={{ title: t('profile.testScores') }} />
      <Stack.Screen name="activities" options={{ title: t('profile.activities') }} />
      <Stack.Screen name="awards" options={{ title: t('profile.awards') }} />
      <Stack.Screen name="education" options={{ title: t('profile.education') }} />
      <Stack.Screen name="essays" options={{ title: t('profile.essays') }} />
      <Stack.Screen name="analysis" options={{ title: t('applicationAnalysis.title') }} />
      <Stack.Screen name="export" options={{ title: t('profile.exportData') }} />
    </Stack>
  );
}
