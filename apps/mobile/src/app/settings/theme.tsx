import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RadioGroup } from '@/components/ui';
import { useThemeStore } from '@/stores';
import { useColors, spacing } from '@/utils/theme';

export default function ThemeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { mode, setMode } = useThemeStore();

  const options = [
    { value: 'light', label: t('settings.lightMode') },
    { value: 'dark', label: t('settings.darkMode') },
    { value: 'system', label: t('settings.systemMode') },
  ];

  const handleChange = async (value: string) => {
    await setMode(value as 'light' | 'dark' | 'system');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RadioGroup
        options={options}
        value={mode}
        onChange={handleChange}
        label={t('settings.theme')}
        style={styles.group}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  group: {
    marginTop: spacing.md,
  },
});
