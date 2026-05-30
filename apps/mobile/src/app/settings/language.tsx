import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/Toast';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { userService } from '@/lib/api/services/user';
import { useAuthStore } from '@/stores';
import type { User } from '@/types';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';

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
      <Text style={[styles.groupLabel, { color: colors.foregroundMuted }]}>
        {t('settings.language')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {options.map((option, index) => {
          const active = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => handleChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
                active && { backgroundColor: withOpacity(colors.primary, 0.1) },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={[styles.radio, { borderColor: active ? colors.primary : colors.border }]}
              >
                {active ? (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.primary : colors.foreground },
                  active && { fontWeight: fontWeight.semibold },
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {active ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  groupLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
});
