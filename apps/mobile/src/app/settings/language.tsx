import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RadioGroup } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { userService } from '@/lib/api/services/user';
import { useAuthStore } from '@/stores';
import type { User } from '@/types';
import { useColors, spacing } from '@/utils/theme';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const { user, setUser } = useAuthStore();
  const [selected, setSelected] = useState(getCurrentLanguage());

  const options = [
    { value: 'zh', label: t('settings.languageZh') },
    { value: 'en', label: t('settings.languageEn') },
  ];

  const handleChange = async (value: string) => {
    setSelected(value);
    await changeLanguage(value as 'zh' | 'en');
    if (user) {
      const previousUser = user;
      setUser({ ...user, locale: value });
      try {
        const updatedUser = await userService.updateMe({ locale: value });
        setUser(updatedUser as User);
      } catch {
        setUser(previousUser);
      }
    }
    toast.show({ type: 'success', message: t('common.success') });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RadioGroup
        options={options}
        value={selected}
        onChange={handleChange}
        label={t('settings.language')}
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
