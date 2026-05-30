import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CircularProgress } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export interface GradeRingCardProps {
  completeness: number;
}

export function GradeRingCard({ completeness }: GradeRingCardProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const ringColor = useMemo(() => {
    if (completeness >= 80) return colors.success;
    if (completeness >= 50) return colors.warning;
    return colors.error;
  }, [completeness, colors]);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/profile')}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.profileGrade')} ${completeness}%`}
      >
        <CircularProgress
          value={completeness}
          size={58}
          strokeWidth={6}
          color={ringColor}
          trackColor={colors.backgroundTertiary}
        />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.foreground }]}>{t('home.profileGrade')}</Text>
          <Text style={[styles.sub, { color: colors.foregroundMuted }]} numberOfLines={1}>
            {t('home.profileCompletion', { pct: completeness })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  sub: { fontSize: fontSize.sm, marginTop: 3 },
});
