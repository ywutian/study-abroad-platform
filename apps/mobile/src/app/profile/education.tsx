import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, Input, Modal, Loading, EmptyState, Card, CardContent } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Profile, Education } from '@/types';

export default function EducationScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Education | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Education | null>(null);

  // Form state
  const [schoolName, setSchoolName] = useState('');
  const [degree, setDegree] = useState('');
  const [major, setMajor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gpa, setGpa] = useState('');
  const [gpaScale, setGpaScale] = useState('');

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
    mutationFn: (updatedEducation: Partial<Education>[]) =>
      apiClient.put<Profile>('/profile', { education: updatedEducation }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profileEdit.saveSuccess'));
      closeModal();
    },
    onError: () => {
      toast.error(t('profileEdit.saveFailed'));
    },
  });

  const resetForm = useCallback(() => {
    setSchoolName('');
    setDegree('');
    setMajor('');
    setStartDate('');
    setEndDate('');
    setGpa('');
    setGpaScale('');
    setEditingEducation(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    resetForm();
  }, [resetForm]);

  const openAddModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEditModal = useCallback((edu: Education) => {
    setEditingEducation(edu);
    setSchoolName(edu.schoolName || '');
    setDegree(edu.degree || '');
    setMajor(edu.major || '');
    setStartDate(edu.startDate || '');
    setEndDate(edu.endDate || '');
    setGpa(edu.gpa?.toString() || '');
    setGpaScale(edu.gpaScale?.toString() || '');
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!schoolName.trim()) {
      toast.warning(t('profileEdit.enterSchoolName'));
      return;
    }

    const currentEducation = profile?.education || [];
    const newEducation: Partial<Education> = {
      schoolName: schoolName.trim(),
      degree: degree.trim() || undefined,
      major: major.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      gpa: gpa ? Number(gpa) : undefined,
      gpaScale: gpaScale ? Number(gpaScale) : undefined,
    };

    let updatedEducation: Partial<Education>[];

    if (editingEducation) {
      updatedEducation = currentEducation.map((e) =>
        e.id === editingEducation.id ? { ...e, ...newEducation } : e
      );
    } else {
      updatedEducation = [...currentEducation, newEducation];
    }

    saveMutation.mutate(updatedEducation);
  }, [
    schoolName,
    degree,
    major,
    startDate,
    endDate,
    gpa,
    gpaScale,
    editingEducation,
    profile,
    saveMutation,
    toast,
    t,
  ]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;

    const currentEducation = profile?.education || [];
    const updatedEducation = currentEducation.filter((e) => e.id !== deleteTarget.id);

    saveMutation.mutate(updatedEducation);
    setDeleteTarget(null);
  }, [deleteTarget, profile, saveMutation]);

  const formatDateRange = (start?: string, end?: string) => {
    if (!start && !end) return '';
    if (start && end) return `${start} - ${end}`;
    if (start) return `${start} - ${t('profileEdit.present')}`;
    return end || '';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  const educationList = profile?.education || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {educationList.length === 0 ? (
          <EmptyState
            icon="library-outline"
            title={t('profile.noEducation')}
            description={t('profileEdit.noEducationDesc')}
            action={{
              label: t('profile.addEducation'),
              onPress: openAddModal,
            }}
          />
        ) : (
          <View style={styles.listContainer}>
            {educationList.map((edu, index) => {
              const dateRange = formatDateRange(edu.startDate, edu.endDate);
              return (
                <Card key={edu.id} style={styles.itemCard}>
                  <CardContent style={styles.itemCardContent}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemInfo}>
                        <View
                          style={[styles.iconBadge, { backgroundColor: colors.primary + '20' }]}
                        >
                          <Ionicons name="school-outline" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.itemTextContainer}>
                          <Text
                            style={[styles.itemName, { color: colors.foreground }]}
                            numberOfLines={2}
                          >
                            {edu.schoolName}
                          </Text>
                          {(edu.degree || edu.major) && (
                            <Text
                              style={[styles.itemSubtitle, { color: colors.foregroundSecondary }]}
                              numberOfLines={1}
                            >
                              {[edu.degree, edu.major].filter(Boolean).join(' - ')}
                            </Text>
                          )}
                          {dateRange ? (
                            <Text style={[styles.dateText, { color: colors.foregroundMuted }]}>
                              {dateRange}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          onPress={() => openEditModal(edu)}
                          style={styles.actionButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setDeleteTarget(edu)}
                          style={styles.actionButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {edu.gpa && (
                      <View style={styles.gpaContainer}>
                        <Text style={[styles.gpaLabel, { color: colors.foregroundMuted }]}>
                          GPA
                        </Text>
                        <Text style={[styles.gpaValue, { color: colors.foreground }]}>
                          {edu.gpa}
                          {edu.gpaScale ? ` / ${edu.gpaScale}` : ''}
                        </Text>
                      </View>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      {educationList.length > 0 && (
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
        title={editingEducation ? t('profileEdit.editEducation') : t('profile.addEducation')}
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
          <Input
            label={t('profileEdit.schoolNameLabel')}
            placeholder={t('profileEdit.enterSchoolName')}
            value={schoolName}
            onChangeText={setSchoolName}
          />

          <Input
            label={t('profileEdit.degreeLabel')}
            placeholder={t('profileEdit.enterDegree')}
            value={degree}
            onChangeText={setDegree}
          />

          <Input
            label={t('profileEdit.majorLabel')}
            placeholder={t('profileEdit.enterMajor')}
            value={major}
            onChangeText={setMajor}
          />

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Input
                label={t('profileEdit.startDate')}
                placeholder="YYYY-MM"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label={t('profileEdit.endDate')}
                placeholder="YYYY-MM"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Input
                label="GPA"
                placeholder="0.00"
                value={gpa}
                onChangeText={setGpa}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label={t('profileEdit.gpaScaleLabel')}
                placeholder="4.0"
                value={gpaScale}
                onChangeText={setGpaScale}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('profileEdit.deleteConfirmTitle')}
        message={t('profileEdit.deleteEducationConfirm')}
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
  itemCard: {
    marginBottom: 0,
  },
  itemCardContent: {
    padding: spacing.lg,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: spacing.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: fontSize.sm,
    marginBottom: 2,
  },
  dateText: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.xs,
  },
  gpaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  gpaLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  gpaValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
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
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
