import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  COLOR_THEME_CATEGORIES,
  COLOR_THEME_DEFINITIONS,
  getColorThemeCategoryLabel,
  getThemePreview,
  type ColorPalette,
  type ColorThemeCategory,
} from '@study-abroad/shared';

import { RadioGroup } from '@/components/ui';
import { useThemeStore } from '@/stores';
import { borderRadius, fontSize, fontWeight, spacing, useColors } from '@/utils/theme';

export default function ThemeScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { mode, setMode, colorPalette, setColorPalette } = useThemeStore();
  const labelLocale = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | ColorThemeCategory>('all');
  const normalizedQuery = query.trim().toLowerCase();

  const options = [
    { value: 'light', label: t('settings.lightMode') },
    { value: 'dark', label: t('settings.darkMode') },
    { value: 'system', label: t('settings.systemMode') },
  ];

  const handleChange = async (value: string) => {
    await setMode(value as 'light' | 'dark' | 'system');
  };

  const categoryOptions = useMemo(
    () => [
      { id: 'all' as const, label: t('settings.themeAll') },
      ...COLOR_THEME_CATEGORIES.map((category) => ({
        id: category.id,
        label: getColorThemeCategoryLabel(category.id, labelLocale),
      })),
    ],
    [labelLocale, t]
  );

  const visibleThemes = useMemo(
    () =>
      COLOR_THEME_DEFINITIONS.filter((theme) => {
        if (activeCategory !== 'all' && theme.category !== activeCategory) return false;
        if (!normalizedQuery) return true;
        return `${theme.id} ${theme.labelZh} ${theme.labelEn} ${theme.descriptionZh} ${theme.descriptionEn}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [activeCategory, normalizedQuery]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <RadioGroup
        options={options}
        value={mode}
        onChange={handleChange}
        label={t('settings.theme')}
        style={styles.group}
      />

      <View style={styles.paletteHeader}>
        <Text style={[styles.paletteTitle, { color: colors.foreground }]}>
          {t('settings.colorTheme')}
        </Text>
        <Text style={[styles.paletteDescription, { color: colors.foregroundMuted }]}>
          {t('settings.colorThemeDesc')}
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('settings.themeSearchPlaceholder')}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={t('settings.themeSearchPlaceholder')}
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroller}
      >
        {categoryOptions.map((category) => {
          const active = activeCategory === category.id;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={category.label}
              accessibilityState={{ selected: active }}
              onPress={() => setActiveCategory(category.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: active ? colors.primaryForeground : colors.foregroundMuted },
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {visibleThemes.length === 0 ? (
        <View
          style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Text style={[styles.paletteDescription, { color: colors.foregroundMuted }]}>
            {t('settings.themeNoResults')}
          </Text>
        </View>
      ) : (
        <View style={styles.paletteGrid}>
          {visibleThemes.map((theme) => {
            const active = colorPalette === theme.id;
            const preview = getThemePreview(theme.id as ColorPalette);
            return (
              <Pressable
                key={theme.id}
                accessibilityRole="button"
                accessibilityLabel={labelLocale === 'zh' ? theme.labelZh : theme.labelEn}
                accessibilityState={{ selected: active }}
                onPress={() => setColorPalette(theme.id as ColorPalette)}
                style={[
                  styles.paletteCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: preview.canvas }]}>
                  <View style={[styles.swatchPanel, { backgroundColor: preview.surface }]} />
                  <View style={[styles.swatchButton, { backgroundColor: preview.primary }]} />
                  <View style={[styles.swatchAccent, { backgroundColor: preview.accent }]} />
                </View>
                <Text numberOfLines={1} style={[styles.paletteName, { color: colors.foreground }]}>
                  {labelLocale === 'zh' ? theme.labelZh : theme.labelEn}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.paletteMeta, { color: colors.foregroundMuted }]}
                >
                  {preview.style.typographyPreset} / {preview.style.cardPreset}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  group: {
    marginTop: spacing.md,
  },
  paletteHeader: {
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  paletteTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  paletteDescription: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  categoryScroller: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  categoryChip: {
    height: 36,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  categoryChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paletteCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  swatch: {
    height: 52,
    overflow: 'hidden',
    borderRadius: borderRadius.sm,
  },
  swatchPanel: {
    position: 'absolute',
    left: 8,
    top: 8,
    height: 24,
    width: 52,
    borderRadius: borderRadius.sm,
  },
  swatchButton: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    height: 10,
    width: 42,
    borderRadius: borderRadius.full,
  },
  swatchAccent: {
    position: 'absolute',
    right: 8,
    top: 8,
    height: 18,
    width: 18,
    borderRadius: borderRadius.full,
  },
  paletteName: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  paletteMeta: {
    marginTop: spacing.xs,
    fontSize: 10,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
});
