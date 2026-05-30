import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, Input, Select, Loading, Card, CardContent } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius, withOpacity } from '@/utils/theme';
import type { Profile } from '@/types';

const GRADE_OPTIONS = [
  { value: 'FRESHMAN', label: '9' },
  { value: 'SOPHOMORE', label: '10' },
  { value: 'JUNIOR', label: '11' },
  { value: 'SENIOR', label: '12' },
  { value: 'GAP_YEAR', label: 'Gap Year' },
];

const SCHOOL_TYPE_OPTIONS_KEYS = [
  { value: 'PUBLIC_SCHOOL', key: 'publicSchool' },
  { value: 'PRIVATE_SCHOOL', key: 'privateSchool' },
  { value: 'INTERNATIONAL', key: 'international' },
];

const BUDGET_OPTIONS_KEYS = [
  { value: 'LOW', key: 'under30k' },
  { value: 'MEDIUM', key: 'under50k' },
  { value: 'HIGH', key: 'under70k' },
  { value: 'UNLIMITED', key: 'above70k' },
];

const VISIBILITY_OPTIONS_KEYS = [
  { value: 'PRIVATE', key: 'private' },
  { value: 'ANONYMOUS', key: 'anonymous' },
  { value: 'PUBLIC', key: 'public' },
  { value: 'VERIFIED_ONLY', key: 'verifiedOnly' },
];

const GPA_SCALE_OPTIONS = [
  { value: '4', label: '4.0' },
  { value: '5', label: '5.0' },
  { value: '100', label: '100' },
];

export default function BasicInfoScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<Profile>(profileRoutes.me()),
  });

  const [grade, setGrade] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [currentSchool, setCurrentSchool] = useState('');
  const [targetMajor, setTargetMajor] = useState('');
  const [gpa, setGpa] = useState('');
  const [gpaScale, setGpaScale] = useState('4');
  const [budgetTier, setBudgetTier] = useState('');
  const [visibility, setVisibility] = useState('PRIVATE');

  useEffect(() => {
    if (profile) {
      setGrade(profile.grade || '');
      setSchoolType(profile.currentSchoolType || '');
      setCurrentSchool(profile.currentSchool || '');
      setTargetMajor(profile.targetMajor || '');
      setGpa(profile.gpa?.toString() || '');
      setGpaScale(profile.gpaScale?.toString() || '4');
      setBudgetTier(profile.budgetTier || '');
      setVisibility(profile.visibility || 'PRIVATE');
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.put<Profile>(profileRoutes.me(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.show({ type: 'success', message: t('profileEdit.saveSuccess') });
    },
    onError: () => {
      toast.show({ type: 'error', message: t('profileEdit.saveFailed') });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      grade: grade || undefined,
      currentSchoolType: schoolType || undefined,
      currentSchool: currentSchool || undefined,
      targetMajor: targetMajor || undefined,
      gpa: gpa ? parseFloat(gpa) : null,
      gpaScale: gpaScale ? parseInt(gpaScale, 10) : undefined,
      budgetTier: budgetTier || undefined,
      visibility,
    });
  };

  const schoolTypeOptions = SCHOOL_TYPE_OPTIONS_KEYS.map((opt) => ({
    value: opt.value,
    label: t(`profile.schoolTypes.${opt.key}`),
  }));

  const budgetOptions = BUDGET_OPTIONS_KEYS.map((opt) => ({
    value: opt.value,
    label: t(`profile.budgetTiers.${opt.key}`),
  }));

  const visibilityOptions = VISIBILITY_OPTIONS_KEYS.map((opt) => ({
    value: opt.value,
    label: t(`profile.visibilityOptions.${opt.key}`),
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header band — icon chip + screen title */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: withOpacity(colors.primary, 0.14) }]}>
          <Ionicons name="person-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {t('profile.basicInfo')}
          </Text>
          <Text style={[styles.headerSub, { color: colors.foregroundMuted }]} numberOfLines={1}>
            {t('profile.completeProfile')}
          </Text>
        </View>
      </View>

      {/* Academic & background card */}
      <Card style={styles.card}>
        <CardContent style={styles.cardContent}>
          <Select
            options={GRADE_OPTIONS}
            value={grade}
            onChange={setGrade}
            label={t('profile.fields.grade')}
            placeholder={t('profile.fields.grade')}
          />

          <Select
            options={schoolTypeOptions}
            value={schoolType}
            onChange={setSchoolType}
            label={t('profile.fields.schoolType')}
            placeholder={t('profile.fields.schoolType')}
          />

          <Input
            value={currentSchool}
            onChangeText={setCurrentSchool}
            label={t('profile.fields.currentSchool')}
            placeholder={t('profile.fields.currentSchool')}
          />

          <Input
            value={targetMajor}
            onChangeText={setTargetMajor}
            label={t('profile.fields.targetMajor')}
            placeholder={t('profile.fields.targetMajor')}
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Input
                value={gpa}
                onChangeText={setGpa}
                label={t('profile.fields.gpaValue')}
                placeholder="3.8"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.rowItemSmall}>
              <Select
                options={GPA_SCALE_OPTIONS}
                value={gpaScale}
                onChange={setGpaScale}
                label={t('profile.fields.gpaScale')}
              />
            </View>
          </View>

          <Select
            options={budgetOptions}
            value={budgetTier}
            onChange={setBudgetTier}
            label={t('profile.fields.budget')}
            placeholder={t('profile.fields.budget')}
          />
        </CardContent>
      </Card>

      {/* Privacy card */}
      <View style={styles.sectionLabelRow}>
        <Ionicons name="lock-closed-outline" size={15} color={colors.foregroundMuted} />
        <Text style={[styles.sectionLabel, { color: colors.foregroundMuted }]}>
          {t('profile.visibility')}
        </Text>
      </View>
      <Card style={styles.card}>
        <CardContent style={styles.cardContent}>
          <Select
            options={visibilityOptions}
            value={visibility}
            onChange={setVisibility}
            label={t('profile.visibility')}
          />
        </CardContent>
      </Card>

      <Button onPress={handleSave} loading={saveMutation.isPending} style={styles.saveButton}>
        {t('common.save')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  card: {
    borderRadius: borderRadius.lg,
  },
  cardContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: -spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 2,
  },
  rowItemSmall: {
    flex: 1,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
});
