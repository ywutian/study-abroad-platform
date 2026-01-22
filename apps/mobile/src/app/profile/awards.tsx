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
  Badge,
  Card,
  CardContent,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Profile, Award } from '@/types';

const AWARD_LEVELS = ['school', 'regional', 'national', 'international'];

export default function AwardsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAward, setEditingAward] = useState<Award | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Award | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

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
    mutationFn: (updatedAwards: Partial<Award>[]) =>
      apiClient.put<Profile>('/profile', { awards: updatedAwards }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profileEdit.saveSuccess'));
      closeModal();
    },
    onError: () => {
      toast.error(t('profileEdit.saveFailed'));
    },
  });

  const levelOptions = AWARD_LEVELS.map((lvl) => ({
    value: lvl,
    label: t(`profileEdit.awardLevels.${lvl}`),
  }));

  const resetForm = useCallback(() => {
    setName('');
    setLevel('');
    setDate('');
    setDescription('');
    setEditingAward(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    resetForm();
  }, [resetForm]);

  const openAddModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEditModal = useCallback((award: Award) => {
    setEditingAward(award);
    setName(award.name || '');
    setLevel(award.level || '');
    setDate(award.date || '');
    setDescription(award.description || '');
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      toast.warning(t('profileEdit.enterAwardName'));
      return;
    }
    if (!level) {
      toast.warning(t('profileEdit.selectAwardLevel'));
      return;
    }

    const currentAwards = profile?.awards || [];
    const newAward: Partial<Award> = {
      name: name.trim(),
      level,
      date: date || undefined,
      description: description.trim() || undefined,
    };

    let updatedAwards: Partial<Award>[];

    if (editingAward) {
      updatedAwards = currentAwards.map((a) =>
        a.id === editingAward.id ? { ...a, ...newAward } : a
      );
    } else {
      updatedAwards = [...currentAwards, newAward];
    }

    saveMutation.mutate(updatedAwards);
  }, [name, level, date, description, editingAward, profile, saveMutation, toast, t]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;

    const currentAwards = profile?.awards || [];
    const updatedAwards = currentAwards.filter((a) => a.id !== deleteTarget.id);

    saveMutation.mutate(updatedAwards);
    setDeleteTarget(null);
  }, [deleteTarget, profile, saveMutation]);

  const getLevelConfig = (awardLevel: string) => {
    switch (awardLevel?.toLowerCase()) {
      case 'international':
        return {
          color: '#f59e0b',
          icon: 'globe-outline' as const,
          label: t('profileEdit.awardLevels.international'),
        };
      case 'national':
        return {
          color: '#ef4444',
          icon: 'flag-outline' as const,
          label: t('profileEdit.awardLevels.national'),
        };
      case 'regional':
        return {
          color: '#3b82f6',
          icon: 'map-outline' as const,
          label: t('profileEdit.awardLevels.regional'),
        };
      case 'school':
        return {
          color: '#10b981',
          icon: 'school-outline' as const,
          label: t('profileEdit.awardLevels.school'),
        };
      default:
        return {
          color: colors.foregroundMuted,
          icon: 'ribbon-outline' as const,
          label: awardLevel,
        };
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  const awards = profile?.awards || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {awards.length === 0 ? (
          <EmptyState
            icon="medal-outline"
            title={t('profile.noAwards')}
            description={t('profileEdit.noAwardsDesc')}
            action={{
              label: t('profile.addAward'),
              onPress: openAddModal,
            }}
          />
        ) : (
          <View style={styles.listContainer}>
            {awards.map((award) => {
              const levelConfig = getLevelConfig(award.level);
              return (
                <Card key={award.id} style={styles.itemCard}>
                  <CardContent style={styles.itemCardContent}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemInfo}>
                        <View
                          style={[styles.iconBadge, { backgroundColor: levelConfig.color + '20' }]}
                        >
                          <Ionicons name={levelConfig.icon} size={18} color={levelConfig.color} />
                        </View>
                        <View style={styles.itemTextContainer}>
                          <Text
                            style={[styles.itemName, { color: colors.foreground }]}
                            numberOfLines={2}
                          >
                            {award.name}
                          </Text>
                          <View style={styles.levelRow}>
                            <View
                              style={[
                                styles.levelBadge,
                                { backgroundColor: levelConfig.color + '15' },
                              ]}
                            >
                              <Text style={[styles.levelText, { color: levelConfig.color }]}>
                                {levelConfig.label}
                              </Text>
                            </View>
                            {award.date && (
                              <Text style={[styles.dateText, { color: colors.foregroundMuted }]}>
                                {award.date}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          onPress={() => openEditModal(award)}
                          style={styles.actionButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setDeleteTarget(award)}
                          style={styles.actionButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {award.description && (
                      <Text
                        style={[styles.itemDescription, { color: colors.foregroundSecondary }]}
                        numberOfLines={2}
                      >
                        {award.description}
                      </Text>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      {awards.length > 0 && (
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
        title={editingAward ? t('profileEdit.editAward') : t('profile.addAward')}
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
            label={t('profileEdit.awardName')}
            placeholder={t('profileEdit.enterAwardName')}
            value={name}
            onChangeText={setName}
          />

          <Select
            label={t('profileEdit.awardLevel')}
            placeholder={t('profileEdit.selectAwardLevel')}
            options={levelOptions}
            value={level}
            onChange={setLevel}
          />

          <Input
            label={t('profileEdit.awardDate')}
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
          />

          <Input
            label={t('profileEdit.descriptionLabel')}
            placeholder={t('profileEdit.enterDescription')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('profileEdit.deleteConfirmTitle')}
        message={t('profileEdit.deleteAwardConfirm')}
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
    marginBottom: spacing.xs,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  levelText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  dateText: {
    fontSize: fontSize.xs,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.xs,
  },
  itemDescription: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
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
