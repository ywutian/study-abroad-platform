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
import type { Profile, Activity } from '@/types';

const ACTIVITY_CATEGORIES = [
  'academic',
  'sports',
  'arts',
  'community',
  'leadership',
  'work',
  'other',
];

export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [weeksPerYear, setWeeksPerYear] = useState('');

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
    mutationFn: (updatedActivities: Partial<Activity>[]) =>
      apiClient.put<Profile>('/profile', { activities: updatedActivities }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profileEdit.saveSuccess'));
      closeModal();
    },
    onError: () => {
      toast.error(t('profileEdit.saveFailed'));
    },
  });

  const categoryOptions = ACTIVITY_CATEGORIES.map((cat) => ({
    value: cat,
    label: t(`profileEdit.activityCategories.${cat}`),
  }));

  const resetForm = useCallback(() => {
    setName('');
    setRole('');
    setOrganization('');
    setDescription('');
    setCategory('');
    setHoursPerWeek('');
    setWeeksPerYear('');
    setEditingActivity(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    resetForm();
  }, [resetForm]);

  const openAddModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openEditModal = useCallback((activity: Activity) => {
    setEditingActivity(activity);
    setName(activity.name || '');
    setRole(activity.role || '');
    setOrganization(activity.organization || '');
    setDescription(activity.description || '');
    // The Activity type doesn't have a category field, but we use role as a proxy
    // or we store category in the role field for now
    setCategory('');
    setHoursPerWeek(activity.hoursPerWeek?.toString() || '');
    setWeeksPerYear(activity.weeksPerYear?.toString() || '');
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      toast.warning(t('profileEdit.enterActivityName'));
      return;
    }

    const currentActivities = profile?.activities || [];
    const newActivity: Partial<Activity> = {
      name: name.trim(),
      role: role.trim() || undefined,
      organization: organization.trim() || undefined,
      description: description.trim() || undefined,
      hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
      weeksPerYear: weeksPerYear ? Number(weeksPerYear) : undefined,
    };

    let updatedActivities: Partial<Activity>[];

    if (editingActivity) {
      updatedActivities = currentActivities.map((a) =>
        a.id === editingActivity.id ? { ...a, ...newActivity } : a
      );
    } else {
      updatedActivities = [...currentActivities, newActivity];
    }

    saveMutation.mutate(updatedActivities);
  }, [
    name,
    role,
    organization,
    description,
    hoursPerWeek,
    weeksPerYear,
    editingActivity,
    profile,
    saveMutation,
    toast,
    t,
  ]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;

    const currentActivities = profile?.activities || [];
    const updatedActivities = currentActivities.filter((a) => a.id !== deleteTarget.id);

    saveMutation.mutate(updatedActivities);
    setDeleteTarget(null);
  }, [deleteTarget, profile, saveMutation]);

  const getCategoryIcon = (activityRole: string): keyof typeof Ionicons.glyphMap => {
    const lower = activityRole?.toLowerCase() || '';
    if (lower.includes('academic') || lower.includes('research')) return 'book-outline';
    if (lower.includes('sport') || lower.includes('athlete')) return 'fitness-outline';
    if (lower.includes('art') || lower.includes('music')) return 'color-palette-outline';
    if (lower.includes('community') || lower.includes('volunteer')) return 'heart-outline';
    if (lower.includes('leader') || lower.includes('president')) return 'flag-outline';
    if (lower.includes('work') || lower.includes('intern')) return 'briefcase-outline';
    return 'ellipse-outline';
  };

  const getCategoryColor = (activityRole: string) => {
    const lower = activityRole?.toLowerCase() || '';
    if (lower.includes('academic') || lower.includes('research')) return '#6366f1';
    if (lower.includes('sport') || lower.includes('athlete')) return '#ef4444';
    if (lower.includes('art') || lower.includes('music')) return '#ec4899';
    if (lower.includes('community') || lower.includes('volunteer')) return '#10b981';
    if (lower.includes('leader') || lower.includes('president')) return '#f59e0b';
    if (lower.includes('work') || lower.includes('intern')) return '#3b82f6';
    return colors.foregroundMuted;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Loading fullScreen />
      </View>
    );
  }

  const activities = profile?.activities || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {activities.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title={t('profile.noActivities')}
            description={t('profileEdit.noActivitiesDesc')}
            action={{
              label: t('profile.addActivity'),
              onPress: openAddModal,
            }}
          />
        ) : (
          <View style={styles.listContainer}>
            {activities.map((activity) => (
              <Card key={activity.id} style={styles.itemCard}>
                <CardContent style={styles.itemCardContent}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemInfo}>
                      <View
                        style={[
                          styles.iconBadge,
                          { backgroundColor: getCategoryColor(activity.role) + '20' },
                        ]}
                      >
                        <Ionicons
                          name={getCategoryIcon(activity.role)}
                          size={18}
                          color={getCategoryColor(activity.role)}
                        />
                      </View>
                      <View style={styles.itemTextContainer}>
                        <Text
                          style={[styles.itemName, { color: colors.foreground }]}
                          numberOfLines={1}
                        >
                          {activity.name}
                        </Text>
                        {activity.role && (
                          <Text
                            style={[styles.itemSubtitle, { color: colors.foregroundMuted }]}
                            numberOfLines={1}
                          >
                            {activity.role}
                            {activity.organization ? ` @ ${activity.organization}` : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal(activity)}
                        style={styles.actionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteTarget(activity)}
                        style={styles.actionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {activity.description && (
                    <Text
                      style={[styles.itemDescription, { color: colors.foregroundSecondary }]}
                      numberOfLines={2}
                    >
                      {activity.description}
                    </Text>
                  )}
                  {(activity.hoursPerWeek || activity.weeksPerYear) && (
                    <View style={styles.timeInfo}>
                      {activity.hoursPerWeek && (
                        <Text style={[styles.timeText, { color: colors.foregroundMuted }]}>
                          {activity.hoursPerWeek} {t('profileEdit.hoursPerWeek')}
                        </Text>
                      )}
                      {activity.weeksPerYear && (
                        <Text style={[styles.timeText, { color: colors.foregroundMuted }]}>
                          {activity.weeksPerYear} {t('profileEdit.weeksPerYear')}
                        </Text>
                      )}
                    </View>
                  )}
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      {activities.length > 0 && (
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
        title={editingActivity ? t('profileEdit.editActivity') : t('profile.addActivity')}
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
            label={t('profileEdit.activityName')}
            placeholder={t('profileEdit.enterActivityName')}
            value={name}
            onChangeText={setName}
          />

          <Input
            label={t('profileEdit.activityRole')}
            placeholder={t('profileEdit.enterRole')}
            value={role}
            onChangeText={setRole}
          />

          <Input
            label={t('profileEdit.organization')}
            placeholder={t('profileEdit.enterOrganization')}
            value={organization}
            onChangeText={setOrganization}
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

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Input
                label={t('profileEdit.hoursPerWeek')}
                placeholder="0"
                value={hoursPerWeek}
                onChangeText={setHoursPerWeek}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label={t('profileEdit.weeksPerYear')}
                placeholder="0"
                value={weeksPerYear}
                onChangeText={setWeeksPerYear}
                keyboardType="numeric"
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
        message={t('profileEdit.deleteActivityConfirm')}
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
    alignItems: 'center',
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
  },
  itemTextContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  itemSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
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
  timeInfo: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  timeText: {
    fontSize: fontSize.xs,
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
