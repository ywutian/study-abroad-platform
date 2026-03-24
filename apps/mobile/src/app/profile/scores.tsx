import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Button,
  Input,
  Modal,
  Select,
  Loading,
  EmptyState,
  Card,
  CardContent,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { TestScore } from '@/types';

const TEST_TYPES = ['SAT', 'ACT', 'TOEFL', 'IELTS', 'AP', 'IB', 'A_LEVEL', 'IGCSE'];

const SUBJECT_MAP: Record<string, string[]> = {
  AP: [
    'Calculus AB',
    'Calculus BC',
    'Statistics',
    'Physics C: Mechanics',
    'Physics C: E&M',
    'Physics 1',
    'Physics 2',
    'Chemistry',
    'Biology',
    'Computer Science A',
    'CS Principles',
    'English Language',
    'English Literature',
    'US History',
    'World History',
    'European History',
    'Psychology',
    'Macroeconomics',
    'Microeconomics',
    'Environmental Science',
    'Chinese Language',
    'Spanish Language',
  ],
  IB: [
    'English A',
    'Chinese A',
    'English B',
    'Chinese B',
    'Spanish B',
    'French B',
    'History',
    'Economics',
    'Psychology',
    'Geography',
    'Business Management',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    'ESS',
    'Mathematics AA',
    'Mathematics AI',
    'Visual Arts',
    'Music',
  ],
  A_LEVEL: [
    'Mathematics',
    'Further Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    'Economics',
    'Business',
    'Accounting',
    'History',
    'Geography',
    'Psychology',
    'Sociology',
    'English Literature',
    'Chinese',
    'French',
    'Spanish',
    'Art & Design',
  ],
  IGCSE: [
    'Mathematics',
    'Additional Math',
    'English Language',
    'English Literature',
    'Physics',
    'Chemistry',
    'Biology',
    'Combined Science',
    'Chinese (First Language)',
    'Chinese (Second Language)',
    'French',
    'Spanish',
    'History',
    'Geography',
    'Economics',
    'Business Studies',
    'Computer Science',
    'Accounting',
    'Art & Design',
    'Music',
  ],
};

const NEEDS_SUBJECT = ['AP', 'IB', 'A_LEVEL', 'IGCSE'];
const NEEDS_SUBSCORES: Record<string, string[]> = {
  SAT: ['readingEBRW', 'math'],
  TOEFL: ['reading', 'listening', 'speaking', 'writing'],
};

export default function ScoresScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingScore, setEditingScore] = useState<TestScore | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestScore | null>(null);

  // Form state
  const [testType, setTestType] = useState('');
  const [totalScore, setTotalScore] = useState('');
  const [testDate, setTestDate] = useState('');
  const [subject, setSubject] = useState('');
  const [subScores, setSubScores] = useState<Record<string, string>>({});

  const {
    data: scores = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['test-scores'],
    queryFn: () => apiClient.get<TestScore[]>('/profiles/me/test-scores'),
  });

  const invalidateScores = () => {
    queryClient.invalidateQueries({ queryKey: ['test-scores'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: {
      type: string;
      score: number;
      testDate?: string;
      subScores?: Record<string, number | string>;
    }) => apiClient.post<TestScore>('/profiles/me/test-scores', data),
    onSuccess: () => {
      invalidateScores();
      toast.success(t('profileEdit.saveSuccess'));
      closeModal();
    },
    onError: () => {
      toast.error(t('profileEdit.saveFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        type?: string;
        score?: number;
        testDate?: string;
        subScores?: Record<string, number | string>;
      };
    }) => apiClient.put<TestScore>(`/profiles/me/test-scores/${id}`, data),
    onSuccess: () => {
      invalidateScores();
      toast.success(t('profileEdit.saveSuccess'));
      closeModal();
    },
    onError: () => {
      toast.error(t('profileEdit.saveFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/test-scores/${id}`),
    onSuccess: () => {
      invalidateScores();
      toast.success(t('profileEdit.saveSuccess'));
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error(t('profileEdit.saveFailed'));
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const testTypeOptions = TEST_TYPES.map((type) => ({
    value: type,
    label: t(`profile.testTypes.${type.toLowerCase()}`, type),
  }));

  const resetForm = useCallback(() => {
    setTestType('');
    setTotalScore('');
    setTestDate('');
    setSubject('');
    setSubScores({});
    setEditingScore(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    resetForm();
  }, [resetForm]);

  const openAddModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEditModal = useCallback((score: TestScore) => {
    setEditingScore(score);
    setTestType(score.type);
    setTotalScore(score.score?.toString() || '');
    setTestDate(score.testDate || '');
    setSubject(score.subScores?.subject?.toString() || '');
    const restored: Record<string, string> = {};
    if (score.subScores) {
      Object.entries(score.subScores).forEach(([k, v]) => {
        if (k !== 'subject') restored[k] = String(v);
      });
    }
    setSubScores(restored);
    setModalVisible(true);
  }, []);

  const buildSubScoresPayload = useCallback((): Record<string, number | string> | undefined => {
    const payload: Record<string, number | string> = {};
    if (NEEDS_SUBJECT.includes(testType) && subject) {
      payload.subject = subject;
    }
    if (NEEDS_SUBSCORES[testType]) {
      NEEDS_SUBSCORES[testType].forEach((key) => {
        if (subScores[key] && !isNaN(Number(subScores[key]))) {
          payload[key] = Number(subScores[key]);
        }
      });
    }
    return Object.keys(payload).length > 0 ? payload : undefined;
  }, [testType, subject, subScores]);

  const handleSave = useCallback(() => {
    if (!testType) {
      toast.warning(t('profileEdit.selectTestType'));
      return;
    }
    if (!totalScore || isNaN(Number(totalScore))) {
      toast.warning(t('profileEdit.enterValidScore'));
      return;
    }

    const subScoresPayload = buildSubScoresPayload();

    if (editingScore) {
      updateMutation.mutate({
        id: editingScore.id,
        data: {
          type: testType,
          score: Number(totalScore),
          testDate: testDate || undefined,
          subScores: subScoresPayload,
        },
      });
    } else {
      createMutation.mutate({
        type: testType,
        score: Number(totalScore),
        testDate: testDate || undefined,
        subScores: subScoresPayload,
      });
    }
  }, [
    testType,
    totalScore,
    testDate,
    editingScore,
    createMutation,
    updateMutation,
    toast,
    t,
    buildSubScoresPayload,
  ]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  }, [deleteTarget, deleteMutation]);

  const getScoreColor = (type: string) => {
    switch (type) {
      case 'SAT':
        return '#6366f1';
      case 'ACT':
        return '#ec4899';
      case 'TOEFL':
        return '#f59e0b';
      case 'IELTS':
        return '#10b981';
      case 'AP':
        return '#3b82f6';
      case 'IB':
        return '#8b5cf6';
      case 'A_LEVEL':
        return '#059669';
      case 'IGCSE':
        return '#0891b2';
      default:
        return colors.primary;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {scores.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title={t('profile.noScores')}
            description={t('profileEdit.noScoresDesc')}
            action={{
              label: t('profile.addScore'),
              onPress: openAddModal,
            }}
          />
        ) : (
          <View style={styles.listContainer}>
            {scores.map((score) => (
              <Card key={score.id} style={styles.scoreCard}>
                <CardContent style={styles.scoreCardContent}>
                  <View style={styles.scoreHeader}>
                    <View style={styles.scoreTypeContainer}>
                      <View
                        style={[
                          styles.scoreTypeBadge,
                          { backgroundColor: getScoreColor(score.type) + '20' },
                        ]}
                      >
                        <Text style={[styles.scoreTypeText, { color: getScoreColor(score.type) }]}>
                          {t(`profile.testTypes.${score.type.toLowerCase()}`, score.type)}
                        </Text>
                      </View>
                      {score.subScores?.subject && (
                        <Text style={[styles.scoreSubject, { color: colors.foregroundMuted }]}>
                          {String(score.subScores.subject)}
                        </Text>
                      )}
                      {score.testDate && (
                        <Text style={[styles.scoreDate, { color: colors.foregroundMuted }]}>
                          {score.testDate}
                        </Text>
                      )}
                    </View>
                    <View style={styles.scoreActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal(score)}
                        style={styles.actionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteTarget(score)}
                        style={styles.actionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.scoreValue, { color: colors.foreground }]}>
                    {score.score}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      {scores.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={openAddModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color={colors.primaryForeground} />
        </TouchableOpacity>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        onClose={closeModal}
        title={editingScore ? t('profileEdit.editScore') : t('profile.addScore')}
        footer={
          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={closeModal} style={styles.modalButton}>
              {t('common.cancel')}
            </Button>
            <Button onPress={handleSave} style={styles.modalButton} disabled={isSaving}>
              {isSaving ? t('common.loading') : t('common.save')}
            </Button>
          </View>
        }
      >
        <View style={styles.formContainer}>
          <Select
            label={t('profileEdit.testTypeLabel')}
            placeholder={t('profileEdit.selectTestType')}
            options={testTypeOptions}
            value={testType}
            onChange={(val) => {
              setTestType(val);
              setSubject('');
              setSubScores({});
            }}
          />

          {NEEDS_SUBJECT.includes(testType) && SUBJECT_MAP[testType] && (
            <Select
              label={t('profileEdit.subjectLabel')}
              placeholder={t('profileEdit.selectSubject')}
              options={SUBJECT_MAP[testType].map((s) => ({ value: s, label: s }))}
              value={subject}
              onChange={setSubject}
            />
          )}

          <Input
            label={t('profileEdit.scoreLabel')}
            placeholder={t('profileEdit.enterScore')}
            value={totalScore}
            onChangeText={setTotalScore}
            keyboardType="numeric"
          />

          {NEEDS_SUBSCORES[testType] && (
            <View style={styles.subScoresContainer}>
              <Text style={[styles.subScoresTitle, { color: colors.foregroundMuted }]}>
                {t('profileEdit.subScoresLabel')}
              </Text>
              {NEEDS_SUBSCORES[testType].map((key) => (
                <Input
                  key={key}
                  label={t(`profileEdit.subScore.${key}`, key)}
                  placeholder={t('profileEdit.enterScore')}
                  value={subScores[key] || ''}
                  onChangeText={(val) => setSubScores((prev) => ({ ...prev, [key]: val }))}
                  keyboardType="numeric"
                />
              ))}
            </View>
          )}

          <Input
            label={t('profileEdit.testDateLabel')}
            placeholder="YYYY-MM-DD"
            value={testDate}
            onChangeText={setTestDate}
          />
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('profileEdit.deleteConfirmTitle')}
        message={t('profileEdit.deleteScoreConfirm')}
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  listContainer: {
    gap: spacing.md,
  },
  scoreCard: {
    marginBottom: 0,
  },
  scoreCardContent: {
    padding: spacing.lg,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  scoreTypeContainer: {
    flex: 1,
  },
  scoreTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  scoreTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  scoreSubject: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  scoreDate: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  scoreActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.xs,
  },
  scoreValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  fab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  formContainer: {
    paddingBottom: spacing.md,
  },
  subScoresContainer: {
    gap: spacing.xs,
  },
  subScoresTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
