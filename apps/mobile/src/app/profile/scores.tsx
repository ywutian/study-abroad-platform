import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
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
  Badge,
  Card,
  CardContent,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Profile, TestScore } from '@/types';

const TEST_TYPES = ['SAT', 'ACT', 'TOEFL', 'IELTS', 'AP', 'IB'];

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

  const {
    data: profile,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<Profile>('/profile'),
  });

  const saveMutation = useMutation({
    mutationFn: (updatedScores: Partial<TestScore>[]) =>
      apiClient.put<Profile>('/profile', { testScores: updatedScores }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profileEdit.saveSuccess'));
      closeModal();
    },
    onError: () => {
      toast.error(t('profileEdit.saveFailed'));
    },
  });

  const testTypeOptions = TEST_TYPES.map((type) => ({
    value: type,
    label: t(`profile.testTypes.${type.toLowerCase()}`, type),
  }));

  const resetForm = useCallback(() => {
    setTestType('');
    setTotalScore('');
    setTestDate('');
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
    setTestType(score.testType);
    setTotalScore(score.totalScore?.toString() || '');
    setTestDate(score.testDate || '');
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!testType) {
      toast.warning(t('profileEdit.selectTestType'));
      return;
    }
    if (!totalScore || isNaN(Number(totalScore))) {
      toast.warning(t('profileEdit.enterValidScore'));
      return;
    }

    const currentScores = profile?.testScores || [];
    const newScore: Partial<TestScore> = {
      testType,
      totalScore: Number(totalScore),
      testDate: testDate || undefined,
    };

    let updatedScores: Partial<TestScore>[];

    if (editingScore) {
      updatedScores = currentScores.map((s) =>
        s.id === editingScore.id ? { ...s, ...newScore } : s
      );
    } else {
      updatedScores = [...currentScores, newScore];
    }

    saveMutation.mutate(updatedScores);
  }, [testType, totalScore, testDate, editingScore, profile, saveMutation, toast, t]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;

    const currentScores = profile?.testScores || [];
    const updatedScores = currentScores.filter((s) => s.id !== deleteTarget.id);

    saveMutation.mutate(updatedScores);
    setDeleteTarget(null);
  }, [deleteTarget, profile, saveMutation]);

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

  const scores = profile?.testScores || [];

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
                          { backgroundColor: getScoreColor(score.testType) + '20' },
                        ]}
                      >
                        <Text
                          style={[styles.scoreTypeText, { color: getScoreColor(score.testType) }]}
                        >
                          {t(`profile.testTypes.${score.testType.toLowerCase()}`, score.testType)}
                        </Text>
                      </View>
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
                    {score.totalScore}
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
            <Button
              onPress={handleSave}
              style={styles.modalButton}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? t('common.loading') : t('common.save')}
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
            onChange={setTestType}
          />

          <Input
            label={t('profileEdit.scoreLabel')}
            placeholder={t('profileEdit.enterScore')}
            value={totalScore}
            onChangeText={setTotalScore}
            keyboardType="numeric"
          />

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
        loading={saveMutation.isPending}
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
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
