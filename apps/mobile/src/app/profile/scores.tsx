import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Loading,
  Modal,
  Select,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import type { TestScore } from '@/types';
import { fontFamily, useColors, withOpacity } from '@/utils/theme';
import { profileRoutes } from '@study-abroad/shared';
import { styles } from './scores.styles';

import { NEEDS_SUBJECT, NEEDS_SUBSCORES, SUBJECT_MAP, TEST_TYPES } from './scores.constants';

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
    queryFn: () => apiClient.get<TestScore[]>(profileRoutes.testScores()),
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
    }) => apiClient.post<TestScore>(profileRoutes.testScores(), data),
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
    }) => apiClient.put<TestScore>(profileRoutes.testScore(id), data),
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
    mutationFn: (id: string) => apiClient.delete(profileRoutes.testScore(id)),
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
        return colors.primary;
      case 'ACT':
        return colors.pink;
      case 'TOEFL':
        return colors.warning;
      case 'IELTS':
        return colors.success;
      case 'DUOLINGO':
        return colors.warning;
      case 'AP':
        return colors.info;
      case 'IB':
        return colors.violet;
      case 'A_LEVEL':
        return colors.success;
      case 'IGCSE':
        return colors.info;
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
                          { backgroundColor: withOpacity(getScoreColor(score.type), 0.125) },
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
                        <Text
                          style={[
                            styles.scoreDate,
                            { color: colors.foregroundMuted, fontFamily: fontFamily.mono },
                          ]}
                        >
                          {score.testDate}
                        </Text>
                      )}
                    </View>
                    <View style={styles.scoreActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal(score)}
                        style={styles.actionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('profileEdit.editScore')}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteTarget(score)}
                        style={styles.actionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.scoreValue,
                      { color: colors.foreground, fontFamily: fontFamily.mono },
                    ]}
                  >
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
          style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.shadow }]}
          onPress={openAddModal}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('profile.addScore')}
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
