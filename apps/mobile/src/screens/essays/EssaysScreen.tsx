/**
 * 文书管理页面
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import type { ComponentProps } from 'react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  ConfirmDialog,
  EmptyState,
  Loading,
  StatusBadge,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import { fontFamily, spacing, useColors, withOpacity, type Colors } from '@/utils/theme';
import { profileRoutes } from '@study-abroad/shared';
import { styles } from './EssaysScreen.styles';

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

const getEssayTypes = (t: TFunction): { value: EssayType; label: string; icon: string }[] => [
  { value: 'personal_statement', label: t('essays.types.personal_statement'), icon: 'person' },
  { value: 'supplemental', label: t('essays.types.supplemental'), icon: 'add-circle' },
  { value: 'why_school', label: t('essays.types.why_school'), icon: 'school' },
  { value: 'activity', label: t('essays.types.activity'), icon: 'trophy' },
  { value: 'other', label: t('essays.types.other'), icon: 'document-text' },
];

const getStatusConfig = (
  t: TFunction
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
    isRefetching,
  } = useQuery({
    queryKey: qk.essays.all,
    queryFn: () => apiClient.get<Essay[]>(`${profileRoutes.me()}/essays`),
    enabled: isAuthenticated,
  });

  // 删除文书
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${profileRoutes.me()}/essays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.essays.all });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('essays.toast.deleted') });
      setDeleteId(null);
    },
    onError: () => {
      toast.show({ type: 'error', message: t('essays.toast.deleteFailed') });
    },
  });

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  // 过滤文书
  const filteredEssays =
    essays?.filter((essay) => activeTab === 'all' || essay.status === activeTab) || [];

  // 统计
  const stats = useMemo(
    () => ({
      total: essays?.length || 0,
      draft: essays?.filter((e) => e.status === 'draft').length || 0,
      inProgress: essays?.filter((e) => e.status === 'in_progress').length || 0,
      completed: essays?.filter((e) => e.status === 'completed').length || 0,
    }),
    [essays]
  );

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
      <FlatList
        data={isLoading ? [] : filteredEssays}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInUp.delay(Math.min(index, 10) * 80).springify()}
            layout={Layout.springify()}
          >
            <EssayCard
              essay={item}
              colors={colors}
              onPress={() => router.push(`/essay/${item.id}`)}
              onDelete={() => handleDelete(item.id)}
              onAIReview={() => {
                router.push({
                  pathname: '/(tabs)/ai',
                  params: { prompt: `${t('essays.aiReviewPrompt')}${item.title}` },
                });
              }}
            />
          </Animated.View>
        )}
        ListHeaderComponent={
          <>
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

            {/* Section Title */}
            <View style={styles.listSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('essays.title')}
              </Text>
            </View>

            {isLoading && <Loading />}
          </>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.listSection}>
              <EmptyState
                icon="document-text-outline"
                title={t('essays.empty.title')}
                description={t('essays.empty.description')}
              />
            </View>
          )
        }
      />

      {/* FAB */}
      <Animated.View
        entering={FadeInUp.delay(500).springify()}
        style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
      >
        <AnimatedButton
          onPress={() => router.push('/essay/new')}
          style={styles.fabButton}
          leftIcon={<Ionicons name="add" size={24} color={colors.primaryForeground} />}
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${value}`}
      style={[
        styles.statCard,
        {
          backgroundColor: active ? withOpacity(color, 0.125) : colors.card,
          borderColor: active ? color : colors.border,
        },
      ]}
    >
      <Ionicons
        name={icon as ComponentProps<typeof Ionicons>['name']}
        size={20}
        color={active ? color : colors.foregroundMuted}
      />
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
  colors: Colors;
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
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${essay.title}, ${typeInfo?.label ?? ''}, ${statusInfo?.label ?? ''}`}
      >
        <CardContent>
          <View style={styles.essayHeader}>
            <View
              style={[styles.typeIcon, { backgroundColor: withOpacity(colors.primary, 0.0625) }]}
            >
              <Ionicons
                name={(typeInfo?.icon || 'document') as ComponentProps<typeof Ionicons>['name']}
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
            <StatusBadge status={essay.status} size="sm" />
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
              <Text
                style={[
                  styles.wordCount,
                  { color: colors.foregroundMuted, fontFamily: fontFamily.mono },
                ]}
              >
                {essay.wordCount} / {essay.wordLimit}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onAIReview}
              accessibilityRole="button"
              accessibilityLabel={t('essays.aiReview')}
              style={[
                styles.actionButton,
                { backgroundColor: withOpacity(colors.primary, 0.0625) },
              ]}
            >
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('essays.aiReview')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={t('essays.deleteDialog.title')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.actionButton, { backgroundColor: withOpacity(colors.error, 0.0625) }]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </CardContent>
      </TouchableOpacity>
    </AnimatedCard>
  );
}
