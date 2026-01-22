/**
 * 文书管理页面
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  Tabs,
  ConfirmDialog,
  StatusBadge,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';

type EssayStatus = 'draft' | 'in_progress' | 'review' | 'completed';
type EssayType = 'personal_statement' | 'supplemental' | 'why_school' | 'activity' | 'other';

interface Essay {
  id: string;
  title: string;
  type: EssayType;
  status: EssayStatus;
  schoolName?: string;
  wordCount: number;
  wordLimit?: number;
  content?: string;
  updatedAt: string;
  createdAt: string;
}

const getEssayTypes = (t: any): { value: EssayType; label: string; icon: string }[] => [
  { value: 'personal_statement', label: t('essays.types.personal_statement'), icon: 'person' },
  { value: 'supplemental', label: t('essays.types.supplemental'), icon: 'add-circle' },
  { value: 'why_school', label: t('essays.types.why_school'), icon: 'school' },
  { value: 'activity', label: t('essays.types.activity'), icon: 'trophy' },
  { value: 'other', label: t('essays.types.other'), icon: 'document-text' },
];

const getStatusConfig = (
  t: any
): Record<EssayStatus, { label: string; variant: 'warning' | 'info' | 'primary' | 'success' }> => ({
  draft: { label: t('essays.status.draft'), variant: 'warning' },
  in_progress: { label: t('essays.status.in_progress'), variant: 'info' },
  review: { label: t('essays.status.review'), variant: 'primary' },
  completed: { label: t('essays.status.completed'), variant: 'success' },
});

export default function EssaysScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'all' | EssayStatus>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 获取文书列表
  const {
    data: essays,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['essays'],
    queryFn: () => apiClient.get<Essay[]>('/profile/essays'),
    enabled: isAuthenticated,
  });

  // 删除文书
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profile/essays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('essays.toast.deleted') });
    },
    onError: () => {
      toast.show({ type: 'error', message: t('essays.toast.deleteFailed') });
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  // 过滤文书
  const filteredEssays =
    essays?.filter((essay) => activeTab === 'all' || essay.status === activeTab) || [];

  // 统计
  const stats = {
    total: essays?.length || 0,
    draft: essays?.filter((e) => e.status === 'draft').length || 0,
    inProgress: essays?.filter((e) => e.status === 'in_progress').length || 0,
    completed: essays?.filter((e) => e.status === 'completed').length || 0,
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title={t('essays.empty.title')}
          description={t('essays.empty.loginRequiredDesc')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.statsContainer}>
            <StatCard
              label={t('essays.stats.all')}
              value={stats.total}
              icon="document-text"
              color={colors.primary}
              active={activeTab === 'all'}
              onPress={() => setActiveTab('all')}
            />
            <StatCard
              label={t('essays.stats.draft')}
              value={stats.draft}
              icon="create"
              color={colors.warning}
              active={activeTab === 'draft'}
              onPress={() => setActiveTab('draft')}
            />
            <StatCard
              label={t('essays.stats.inProgress')}
              value={stats.inProgress}
              icon="pencil"
              color={colors.info}
              active={activeTab === 'in_progress'}
              onPress={() => setActiveTab('in_progress')}
            />
            <StatCard
              label={t('essays.stats.completed')}
              value={stats.completed}
              icon="checkmark-circle"
              color={colors.success}
              active={activeTab === 'completed'}
              onPress={() => setActiveTab('completed')}
            />
          </View>
        </Animated.View>

        {/* Essay List */}
        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t('essays.title')}
          </Text>

          {isLoading ? (
            <Loading />
          ) : filteredEssays.length > 0 ? (
            filteredEssays.map((essay, index) => (
              <Animated.View
                key={essay.id}
                entering={FadeInUp.delay(index * 80).springify()}
                layout={Layout.springify()}
              >
                <EssayCard
                  essay={essay}
                  colors={colors}
                  onPress={() => router.push(`/essay/${essay.id}`)}
                  onDelete={() => handleDelete(essay.id)}
                  onAIReview={() => {
                    router.push({
                      pathname: '/(tabs)/ai',
                      params: { prompt: `${t('essays.aiReviewPrompt')}${essay.title}` },
                    });
                  }}
                />
              </Animated.View>
            ))
          ) : (
            <EmptyState
              icon="document-text-outline"
              title={t('essays.empty.title')}
              description={t('essays.empty.description')}
            />
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Animated.View
        entering={FadeInUp.delay(500).springify()}
        style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
      >
        <AnimatedButton
          onPress={() => router.push('/essay/new')}
          style={styles.fabButton}
          leftIcon={<Ionicons name="add" size={24} color="#fff" />}
        >
          {t('essays.newEssay')}
        </AnimatedButton>
      </Animated.View>

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title={t('essays.deleteDialog.title')}
        message={t('essays.deleteDialog.message')}
        confirmText={t('essays.deleteDialog.confirm')}
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </View>
  );
}

// Stat Card
function StatCard({
  label,
  value,
  icon,
  color,
  active,
  onPress,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.statCard,
        { backgroundColor: active ? color + '20' : colors.card },
        active && { borderColor: color, borderWidth: 2 },
      ]}
    >
      <Ionicons name={icon as any} size={20} color={active ? color : colors.foregroundMuted} />
      <Text style={[styles.statValue, { color: active ? color : colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.foregroundMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Essay Card
function EssayCard({
  essay,
  colors,
  onPress,
  onDelete,
  onAIReview,
}: {
  essay: Essay;
  colors: any;
  onPress: () => void;
  onDelete: () => void;
  onAIReview: () => void;
}) {
  const { t } = useTranslation();
  const essayTypes = getEssayTypes(t);
  const statusConfig = getStatusConfig(t);
  const typeInfo = essayTypes.find((type) => type.value === essay.type);
  const statusInfo = statusConfig[essay.status];
  const progress = essay.wordLimit ? Math.min((essay.wordCount / essay.wordLimit) * 100, 100) : 0;

  return (
    <AnimatedCard style={styles.essayCard}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <CardContent>
          <View style={styles.essayHeader}>
            <View style={[styles.typeIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons
                name={(typeInfo?.icon as any) || 'document'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.essayInfo}>
              <Text style={[styles.essayTitle, { color: colors.foreground }]} numberOfLines={1}>
                {essay.title}
              </Text>
              <Text style={[styles.essayMeta, { color: colors.foregroundMuted }]}>
                {typeInfo?.label} {essay.schoolName && `· ${essay.schoolName}`}
              </Text>
            </View>
            <StatusBadge status={essay.status as any} size="sm" />
          </View>

          {/* Word Count Progress */}
          {essay.wordLimit && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress}%`,
                      backgroundColor: progress >= 100 ? colors.success : colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.wordCount, { color: colors.foregroundMuted }]}>
                {essay.wordCount} / {essay.wordLimit}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onAIReview}
              style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
            >
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('essays.aiReview')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDelete}
              style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </CardContent>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
  },
  listSection: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  essayCard: {
    marginBottom: spacing.md,
  },
  essayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  essayInfo: {
    flex: 1,
  },
  essayTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  essayMeta: {
    fontSize: fontSize.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  wordCount: {
    fontSize: fontSize.xs,
    minWidth: 80,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  fab: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  fabButton: {
    width: '100%',
  },
});
