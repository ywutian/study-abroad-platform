/**
 * Submit Case Modal - Multi-step form for submitting admission cases
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash.debounce';

import * as Haptics from 'expo-haptics';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { School, CaseResult, PaginatedResponse } from '@/types';

interface SubmitCaseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface CaseFormData {
  // Step 1: School & Result
  schoolId: string;
  schoolName: string;
  major: string;
  year: string;
  result: CaseResult | '';
  round: string;
  // Step 2: Scores
  gpa: string;
  gpaScale: string;
  satScore: string;
  actScore: string;
  toeflScore: string;
}

const INITIAL_FORM: CaseFormData = {
  schoolId: '',
  schoolName: '',
  major: '',
  year: '',
  result: '',
  round: '',
  gpa: '',
  gpaScale: '4.0',
  satScore: '',
  actScore: '',
  toeflScore: '',
};

const TOTAL_STEPS = 2;

export function SubmitCaseModal({ visible, onClose, onSuccess }: SubmitCaseModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CaseFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CaseFormData, string>>>({});

  // School search state
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolResults, setSchoolResults] = useState<School[]>([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  const updateField = <K extends keyof CaseFormData>(key: K, value: CaseFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error when user edits field
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // School autocomplete search — debounce stored in ref to avoid re-creation
  const debouncedSchoolSearchRef = useRef(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSchoolResults([]);
        setShowSchoolDropdown(false);
        return;
      }

      setSearchingSchools(true);
      try {
        const response = await apiClient.get<PaginatedResponse<School>>('/schools', {
          params: { search: query, limit: 10, page: 1 },
        });
        setSchoolResults(response.items);
        setShowSchoolDropdown(true);
      } catch {
        setSchoolResults([]);
      } finally {
        setSearchingSchools(false);
      }
    }, 300)
  );

  // Cancel pending debounce on unmount
  useEffect(() => {
    const cancel = debouncedSchoolSearchRef.current;
    return () => {
      cancel.cancel();
    };
  }, []);

  const handleSchoolSearchChange = (text: string) => {
    setSchoolSearch(text);
    if (text !== form.schoolName) {
      updateField('schoolId', '');
      updateField('schoolName', '');
    }
    debouncedSchoolSearchRef.current(text);
  };

  const selectSchool = (school: School) => {
    updateField('schoolId', school.id);
    updateField('schoolName', school.name);
    setSchoolSearch(school.name);
    setShowSchoolDropdown(false);
    setSchoolResults([]);
  };

  const yearOptions = useMemo(
    () => [
      { value: '2026', label: '2026' },
      { value: '2025', label: '2025' },
      { value: '2024', label: '2024' },
      { value: '2023', label: '2023' },
      { value: '2022', label: '2022' },
    ],
    []
  );

  const resultOptions = useMemo(
    () => [
      { value: 'ADMITTED', label: t('cases.result.admitted') },
      { value: 'REJECTED', label: t('cases.result.rejected') },
      { value: 'WAITLISTED', label: t('cases.result.waitlisted') },
      { value: 'DEFERRED', label: t('cases.result.deferred') },
    ],
    [t]
  );

  const roundOptions = useMemo(
    () => [
      { value: 'ED', label: 'ED' },
      { value: 'ED2', label: 'ED2' },
      { value: 'EA', label: 'EA' },
      { value: 'REA', label: 'REA' },
      { value: 'RD', label: 'RD' },
    ],
    []
  );

  // Validation
  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof CaseFormData, string>> = {};
    if (!form.schoolId) newErrors.schoolId = t('errors.required');
    if (!form.year) newErrors.year = t('errors.required');
    if (!form.result) newErrors.result = t('errors.required');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Partial<Record<keyof CaseFormData, string>> = {};
    if (form.gpa && (isNaN(Number(form.gpa)) || Number(form.gpa) < 0 || Number(form.gpa) > 5)) {
      newErrors.gpa = t('cases.submit.gpaRange');
    }
    if (
      form.satScore &&
      (isNaN(Number(form.satScore)) || Number(form.satScore) < 400 || Number(form.satScore) > 1600)
    ) {
      newErrors.satScore = t('cases.submit.satRange');
    }
    if (
      form.actScore &&
      (isNaN(Number(form.actScore)) || Number(form.actScore) < 1 || Number(form.actScore) > 36)
    ) {
      newErrors.actScore = t('cases.submit.actRange');
    }
    if (
      form.toeflScore &&
      (isNaN(Number(form.toeflScore)) ||
        Number(form.toeflScore) < 0 ||
        Number(form.toeflScore) > 120)
    ) {
      newErrors.toeflScore = t('cases.submit.toeflRange');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep2()) {
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        schoolId: form.schoolId,
        year: Number(form.year),
        result: form.result,
        visibility: 'ANONYMOUS',
      };

      if (form.major) payload.major = form.major;
      if (form.round) payload.round = form.round;

      // Convert individual scores to range strings (backend expects "X.X-X.X" format)
      if (form.gpa) {
        const gpa = Number(form.gpa);
        const scale = Number(form.gpaScale) || 4.0;
        const lower = Math.max(0, gpa - 0.1).toFixed(1);
        const upper = Math.min(scale, gpa + 0.1).toFixed(1);
        payload.gpaRange = `${lower}-${upper}`;
      }
      if (form.satScore) {
        const sat = Number(form.satScore);
        payload.satRange = `${Math.max(400, sat - 25)}-${Math.min(1600, sat + 25)}`;
      }
      if (form.actScore) {
        const act = Number(form.actScore);
        payload.actRange = `${Math.max(1, act - 1)}-${Math.min(36, act + 1)}`;
      }
      if (form.toeflScore) {
        const toefl = Number(form.toeflScore);
        payload.toeflRange = `${Math.max(0, toefl - 3)}-${Math.min(120, toefl + 3)}`;
      }

      await apiClient.post('/cases', payload);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('cases.submit.submitSuccess'));
      handleClose();
      onSuccess?.();
    } catch (error: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error instanceof Error ? error.message : t('cases.submit.submitFailed');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setForm(INITIAL_FORM);
    setErrors({});
    setSchoolSearch('');
    setSchoolResults([]);
    setShowSchoolDropdown(false);
    onClose();
  };

  // Step indicators
  const renderStepIndicator = () => (
    <View
      style={styles.stepIndicator}
      accessibilityRole="tablist"
      accessibilityLabel={t('cases.submit.stepProgress', { step, total: TOTAL_STEPS })}
    >
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            {
              backgroundColor: i + 1 <= step ? colors.primary : colors.muted,
            },
            i + 1 === step && styles.stepDotActive,
          ]}
          accessibilityLabel={t('cases.submit.stepN', { n: i + 1 })}
          accessibilityState={{ selected: i + 1 === step }}
        />
      ))}
    </View>
  );

  // Step 1: School & Result
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        {t('cases.submit.selectSchool')}
      </Text>

      {/* School search input */}
      <View style={styles.schoolSearchContainer}>
        <Input
          label={t('cases.submit.selectSchool')}
          value={schoolSearch}
          onChangeText={handleSchoolSearchChange}
          placeholder={t('schools.searchPlaceholder')}
          error={errors.schoolId}
          leftIcon={<Ionicons name="search" size={18} color={colors.foregroundMuted} />}
          rightIcon={
            searchingSchools ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : form.schoolId ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            ) : undefined
          }
        />

        {/* School dropdown */}
        {showSchoolDropdown && schoolResults.length > 0 && (
          <View
            style={[
              styles.schoolDropdown,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
          >
            {schoolResults.map((school) => (
              <TouchableOpacity
                key={school.id}
                style={[styles.schoolOption, { borderBottomColor: colors.border }]}
                onPress={() => selectSchool(school)}
              >
                <Text
                  style={[styles.schoolOptionName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {school.name}
                </Text>
                {school.nameZh && (
                  <Text
                    style={[styles.schoolOptionNameZh, { color: colors.foregroundMuted }]}
                    numberOfLines={1}
                  >
                    {school.nameZh}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        {/* No results message */}
        {!searchingSchools &&
          schoolSearch.length >= 2 &&
          !form.schoolId &&
          schoolResults.length === 0 &&
          !showSchoolDropdown && (
            <Text style={[styles.noSchoolResults, { color: colors.foregroundMuted }]}>
              {t('schools.noResults')}
            </Text>
          )}
      </View>

      <Input
        label={t('cases.submit.selectMajor')}
        value={form.major}
        onChangeText={(text) => updateField('major', text)}
        placeholder={t('cases.submit.majorPlaceholder')}
      />

      <Select
        label={t('cases.submit.selectYear')}
        options={yearOptions}
        value={form.year}
        onChange={(value) => updateField('year', value)}
        placeholder={t('cases.submit.selectYear')}
        error={errors.year}
      />

      <Select
        label={t('cases.submit.selectResult')}
        options={resultOptions}
        value={form.result}
        onChange={(value) => updateField('result', value as CaseResult)}
        placeholder={t('cases.submit.selectResult')}
        error={errors.result}
      />

      <Select
        label={t('cases.submit.selectRound')}
        options={roundOptions}
        value={form.round}
        onChange={(value) => updateField('round', value)}
        placeholder={t('cases.submit.selectRound')}
      />
    </View>
  );

  // Step 2: Scores
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        {t('cases.submit.enterScores')}
      </Text>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label={t('cases.submit.enterGpa')}
            value={form.gpa}
            onChangeText={(text) => updateField('gpa', text)}
            placeholder={t('cases.submit.gpaPlaceholder')}
            keyboardType="decimal-pad"
            error={errors.gpa}
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label={t('cases.submit.gpaScale')}
            value={form.gpaScale}
            onChangeText={(text) => updateField('gpaScale', text)}
            placeholder={t('cases.submit.gpaScalePlaceholder')}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label="SAT"
            value={form.satScore}
            onChangeText={(text) => updateField('satScore', text)}
            placeholder={t('cases.submit.satPlaceholder')}
            keyboardType="number-pad"
            error={errors.satScore}
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="ACT"
            value={form.actScore}
            onChangeText={(text) => updateField('actScore', text)}
            placeholder={t('cases.submit.actPlaceholder')}
            keyboardType="number-pad"
            error={errors.actScore}
          />
        </View>
      </View>

      <Input
        label="TOEFL"
        value={form.toeflScore}
        onChangeText={(text) => updateField('toeflScore', text)}
        placeholder={t('cases.submit.toeflPlaceholder')}
        keyboardType="number-pad"
        error={errors.toeflScore}
      />
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      default:
        return null;
    }
  };

  const footer = (
    <View style={styles.footerRow}>
      {step > 1 && (
        <Button
          variant="outline"
          onPress={handleBack}
          style={styles.footerButton}
          disabled={submitting}
        >
          {t('common.back')}
        </Button>
      )}
      {step < TOTAL_STEPS ? (
        <Button onPress={handleNext} style={styles.footerButton}>
          {t('common.next')}
        </Button>
      ) : (
        <Button onPress={handleSubmit} loading={submitting} style={styles.footerButton}>
          {t('common.submit')}
        </Button>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title={t('cases.submit.title')}
      footer={footer}
      closeOnBackdrop={false}
      fullScreen
    >
      {renderStepIndicator()}
      {renderCurrentStep()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 24,
    borderRadius: 4,
  },
  stepContent: {
    paddingBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  schoolSearchContainer: {
    position: 'relative',
    zIndex: 10,
  },
  schoolDropdown: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    maxHeight: 200,
    zIndex: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  schoolOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  schoolOptionName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  schoolOptionNameZh: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  noSchoolResults: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
