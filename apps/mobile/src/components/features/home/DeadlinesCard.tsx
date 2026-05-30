import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
} from '@/utils/theme';
import { SectionHeader } from './SectionHeader';

export interface DeadlineRow {
  id: string;
  schoolName: string;
  round?: string;
  deadline: string;
  daysLeft: number;
}

export interface DeadlinesCardProps {
  deadlines: DeadlineRow[];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function DeadlinesCard({ deadlines }: DeadlinesCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  if (deadlines.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t('home.upcomingDeadlines')}
        moreLabel={t('home.viewAll')}
        onMore={() => router.push('/timeline')}
      />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {deadlines.map((d, i) => {
          const urgent = d.daysLeft <= 7;
          const urgency =
            d.daysLeft <= 3 ? colors.error : d.daysLeft <= 7 ? colors.warning : colors.foreground;
          return (
            <TouchableOpacity
              key={d.id}
              activeOpacity={0.7}
              onPress={() => router.push('/timeline')}
              style={[
                styles.row,
                i < deadlines.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${d.schoolName} ${t('home.nextActionDays', { days: d.daysLeft })}`}
            >
              <View
                style={[
                  styles.logo,
                  {
                    backgroundColor: withOpacity(colors.primary, 0.12),
                    borderColor: withOpacity(colors.primary, 0.25),
                  },
                ]}
              >
                <Text
                  style={[styles.logoText, { color: colors.primary, fontFamily: fontFamily.mono }]}
                >
                  {initials(d.schoolName)}
                </Text>
              </View>
              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {d.schoolName}
                </Text>
                <View style={styles.badges}>
                  {d.round ? (
                    <View style={[styles.badge, { backgroundColor: colors.backgroundTertiary }]}>
                      <Text
                        style={[
                          styles.badgeText,
                          { color: colors.foregroundSecondary, fontFamily: fontFamily.mono },
                        ]}
                      >
                        {d.round}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.badge, { backgroundColor: withOpacity(urgency, 0.14) }]}>
                    <Text style={[styles.badgeText, { color: urgency }]}>
                      {urgent ? t('home.statusActive') : t('home.statusUpcoming')}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.days}>
                <Text style={[styles.daysValue, { color: urgency, fontFamily: fontFamily.mono }]}>
                  {d.daysLeft}
                </Text>
                <Text style={[styles.daysUnit, { color: colors.foregroundMuted }]}>
                  {t('home.daysLeft')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  card: { borderWidth: 1, borderRadius: borderRadius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  badges: { flexDirection: 'row', gap: 6, marginTop: 5 },
  badge: { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  days: { alignItems: 'flex-end', minWidth: 34 },
  daysValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  daysUnit: { fontSize: 10, marginTop: 1 },
});
