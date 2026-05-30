import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

export interface HomeHeroProps {
  name: string;
  completeness: number;
  todayCount: number;
  submitted: number;
  targetSchoolCount: number;
  pendingTotal: number;
  nextDeadline?: {
    id: string;
    schoolName: string;
    round?: string;
    deadline: string;
    daysLeft: number;
  };
}

function letterGrade(pct: number, c: ReturnType<typeof useColors>) {
  if (pct >= 90) return { grade: 'A', color: c.success };
  if (pct >= 80) return { grade: 'B+', color: c.success };
  if (pct >= 70) return { grade: 'B', color: c.info };
  if (pct >= 50) return { grade: 'C', color: c.warning };
  return { grade: 'D', color: c.error };
}

function greetingKey(): 'home.greetingMorning' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greetingMorning';
  if (h < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

export function HomeHero({
  name,
  completeness,
  todayCount,
  submitted,
  targetSchoolCount,
  pendingTotal,
  nextDeadline,
}: HomeHeroProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const grade = useMemo(() => letterGrade(completeness, colors), [completeness, colors]);

  const urgency =
    nextDeadline == null
      ? colors.foregroundMuted
      : nextDeadline.daysLeft <= 3
        ? colors.error
        : nextDeadline.daysLeft <= 7
          ? colors.warning
          : colors.foreground;

  return (
    <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* greeting + grade chip */}
      <View style={styles.topRow}>
        <View style={styles.flex1}>
          <Text style={[styles.eyebrow, { color: colors.foregroundMuted }]}>
            {t(greetingKey())}
          </Text>
          <Text
            style={[styles.uname, { color: colors.foreground, fontFamily: fontFamily.mono }]}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>
        <View
          style={[styles.gradeChip, { backgroundColor: withOpacity(grade.color, 0.14) }]}
          accessibilityRole="text"
          accessibilityLabel={t('home.profileGrade') + ' ' + grade.grade}
        >
          <Text style={[styles.gradeChipText, { color: grade.color }]}>{grade.grade}</Text>
        </View>
      </View>

      {/* next-action card */}
      {nextDeadline ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/timeline')}
          style={[styles.nextAction, { backgroundColor: colors.backgroundTertiary }]}
          accessibilityRole="button"
          accessibilityLabel={`${nextDeadline.schoolName} ${t('home.nextActionDays', { days: nextDeadline.daysLeft })}`}
        >
          <View style={[styles.naIcon, { backgroundColor: withOpacity(urgency, 0.14) }]}>
            <Ionicons name="time-outline" size={22} color={urgency} />
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.naTitle, { color: colors.foreground }]} numberOfLines={1}>
              {nextDeadline.schoolName}
              {nextDeadline.round ? ` · ${nextDeadline.round}` : ''}
            </Text>
            <Text style={[styles.naSub, { color: colors.foregroundMuted }]} numberOfLines={1}>
              {t('home.nextActionTasks', { count: pendingTotal })}
            </Text>
          </View>
          <View style={styles.naDays}>
            <Text style={[styles.naDaysValue, { color: urgency, fontFamily: fontFamily.mono }]}>
              {nextDeadline.daysLeft}
            </Text>
            <Text style={[styles.naDaysUnit, { color: colors.foregroundMuted }]}>
              {t('home.daysLeft')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* 3-stat row */}
      <View style={[styles.statsRow, { borderColor: colors.border }]}>
        <Stat value={String(todayCount)} label={t('home.statTodayTasks')} colors={colors} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <Stat
          value={`${submitted}/${targetSchoolCount}`}
          label={t('home.statSubmitted')}
          colors={colors}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <Stat value={`${completeness}%`} label={t('home.statCompletion')} colors={colors} />
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.mono }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.foregroundMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  hero: {
    margin: spacing.lg,
    marginBottom: 0,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eyebrow: { fontSize: fontSize.sm, marginBottom: 2 },
  uname: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  gradeChip: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeChipText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  nextAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  naIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  naTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  naSub: { fontSize: fontSize.xs, marginTop: 3 },
  naDays: { alignItems: 'center', minWidth: 36 },
  naDaysValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, lineHeight: fontSize.xl },
  naDaysUnit: { fontSize: 10, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.5 },
  statLabel: { fontSize: fontSize.xs, marginTop: spacing.xs },
  statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: spacing.sm },
});
