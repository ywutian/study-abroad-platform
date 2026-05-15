import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, Input, Select, Loading } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
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
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.form}>
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

        <Select
          options={visibilityOptions}
          value={visibility}
          onChange={setVisibility}
          label={t('profile.visibility')}
        />

        <Button onPress={handleSave} loading={saveMutation.isPending} style={styles.saveButton}>
          {t('common.save')}
        </Button>
      </View>
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
  form: {
    padding: spacing.lg,
    gap: spacing.lg,
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
    marginTop: spacing.md,
  },
});
