import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton, Badge, EmptyState, Loading, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { API_ROUTES, hallRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import type { HallList, HallListDetail, CreateListDto } from './types';
import { LIST_CATEGORIES } from './types';
import { ListItemCard } from './ListItemCard';

export function ListsTab() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [createListVisible, setCreateListVisible] = useState(false);
  const [listDetailId, setListDetailId] = useState<string | null>(null);
  const [listDetailVisible, setListDetailVisible] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCategory, setNewListCategory] = useState<string>('tier');
  const [newListItems, setNewListItems] = useState('');

  const {
    data: listsData,
    isLoading,
    refetch,
  } = useQuery<HallList[]>({
    queryKey: ['hall-lists'],
    queryFn: () => apiClient.get<HallList[]>(hallRoutes.lists()),
    staleTime: 2 * 60_000,
  });

  const { data: listDetail, isLoading: listDetailLoading } = useQuery<HallListDetail>({
    queryKey: ['hall-list-detail', listDetailId],
    queryFn: () => apiClient.get<HallListDetail>(`${API_ROUTES.HALLS}/lists/${listDetailId}`),
    enabled: !!listDetailId,
  });

  const createListMutation = useMutation<HallList, Error, CreateListDto>({
    mutationFn: (dto) => apiClient.post<HallList>(hallRoutes.lists(), dto),
    onSuccess: () => {
      toast.show({ type: 'success', message: t('hallOfFame.lists.created') });
      queryClient.invalidateQueries({ queryKey: ['hall-lists'] });
      closeCreateList();
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  const voteMutation = useMutation<void, Error, { listId: string; direction: 'up' | 'down' }>({
    mutationFn: ({ listId, direction }) =>
      apiClient.post(hallRoutes.listVote(listId), { direction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-lists'] });
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const categoryLabel = useCallback(
    (cat: string): string => {
      const map: Record<string, string> = {
        tier: t('hallOfFame.lists.categories.tier'),
        major: t('hallOfFame.lists.categories.major'),
        location: t('hallOfFame.lists.categories.location'),
        value: t('hallOfFame.lists.categories.value'),
        other: t('hallOfFame.lists.categories.other'),
      };
      return map[cat] || cat;
    },
    [t]
  );

  const openListDetail = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListDetailId(id);
    setListDetailVisible(true);
  }, []);

  const closeListDetail = useCallback(() => {
    setListDetailVisible(false);
    setListDetailId(null);
  }, []);

  const openCreateList = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewListTitle('');
    setNewListDesc('');
    setNewListCategory('tier');
    setNewListItems('');
    setCreateListVisible(true);
  }, []);

  const closeCreateList = useCallback(() => {
    setCreateListVisible(false);
  }, []);

  const submitList = useCallback(() => {
    if (!newListTitle.trim()) {
      toast.show({
        type: 'error',
        message: t('hallOfFame.lists.titleRequired'),
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const items = newListItems
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    createListMutation.mutate({
      title: newListTitle.trim(),
      description: newListDesc.trim() || undefined,
      category: newListCategory,
      items,
    });
  }, [newListTitle, newListDesc, newListCategory, newListItems, createListMutation, t, toast]);

  const handleVote = useCallback(
    (listId: string, direction: 'up' | 'down') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      voteMutation.mutate({ listId, direction });
    },
    [voteMutation]
  );

  const renderListCard = useCallback(
    ({ item }: { item: HallList }) => (
      <ListItemCard
        item={item}
        colors={c}
        onOpenDetail={openListDetail}
        onVote={handleVote}
        categoryLabel={categoryLabel}
      />
    ),
    [c, openListDetail, handleVote, categoryLabel]
  );

  if (isLoading) return <Loading text={t('hallOfFame.loading')} />;

  const lists = listsData || [];

  return (
    <View style={{ flex: 1 }}>
      <Animated.View entering={FadeInDown.duration(300)} style={S.listControlsRow}>
        <Text style={[S.sectionTitle, { color: c.foreground }]}>{t('hallOfFame.lists.title')}</Text>
        <AnimatedButton
          size="sm"
          onPress={openCreateList}
          leftIcon={<Ionicons name="add-outline" size={16} color={c.primaryForeground} />}
        >
          {t('hallOfFame.lists.create')}
        </AnimatedButton>
      </Animated.View>

      {lists.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={t('hallOfFame.lists.empty')}
          description={t('hallOfFame.lists.emptyDesc')}
          action={{ label: t('hallOfFame.lists.create'), onPress: openCreateList }}
        />
      ) : (
        <FlashList
          data={lists}
          renderItem={renderListCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Create List Modal */}
      <Modal
        visible={createListVisible}
        onClose={closeCreateList}
        title={t('hallOfFame.lists.createTitle')}
        footer={
          <View style={S.modalFooter}>
            <AnimatedButton variant="outline" onPress={closeCreateList}>
              {t('hallOfFame.cancel')}
            </AnimatedButton>
            <AnimatedButton onPress={submitList} loading={createListMutation.isPending}>
              {t('hallOfFame.lists.submit')}
            </AnimatedButton>
          </View>
        }
      >
        <View style={S.modalBody}>
          <View style={S.inputGroup}>
            <Text style={[S.inputLabel, { color: c.foreground }]}>
              {t('hallOfFame.lists.titleLabel')}
            </Text>
            <TextInput
              style={[
                S.textInput,
                { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
              ]}
              value={newListTitle}
              onChangeText={setNewListTitle}
              placeholder={t('hallOfFame.lists.titlePlaceholder')}
              placeholderTextColor={c.placeholder}
            />
          </View>

          <View style={S.inputGroup}>
            <Text style={[S.inputLabel, { color: c.foreground }]}>
              {t('hallOfFame.lists.descLabel')}
            </Text>
            <TextInput
              style={[
                S.textInput,
                S.textAreaSmall,
                { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
              ]}
              value={newListDesc}
              onChangeText={setNewListDesc}
              placeholder={t('hallOfFame.lists.descPlaceholder')}
              placeholderTextColor={c.placeholder}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={S.inputGroup}>
            <Text style={[S.inputLabel, { color: c.foreground }]}>
              {t('hallOfFame.lists.categoryLabel')}
            </Text>
            <View style={S.categoryRow}>
              {LIST_CATEGORIES.map((cat) => {
                const active = newListCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setNewListCategory(cat)}
                    style={[S.categoryPill, { backgroundColor: active ? c.primary : c.muted }]}
                  >
                    <Text
                      style={[
                        S.categoryPillText,
                        { color: active ? c.primaryForeground : c.foreground },
                      ]}
                    >
                      {categoryLabel(cat)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={S.inputGroup}>
            <Text style={[S.inputLabel, { color: c.foreground }]}>
              {t('hallOfFame.lists.itemsLabel')}
            </Text>
            <TextInput
              style={[
                S.textInput,
                S.textArea,
                { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
              ]}
              value={newListItems}
              onChangeText={setNewListItems}
              placeholder={t('hallOfFame.lists.itemsPlaceholder')}
              placeholderTextColor={c.placeholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        </View>
      </Modal>

      {/* List Detail Modal */}
      <Modal
        visible={listDetailVisible}
        onClose={closeListDetail}
        title={listDetail?.title || t('hallOfFame.lists.detail')}
      >
        {listDetailLoading || !listDetail ? (
          <View style={S.detailLoading}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        ) : (
          <View style={S.modalBody}>
            {listDetail.description ? (
              <Text style={[S.listDetailDesc, { color: c.foregroundSecondary }]}>
                {listDetail.description}
              </Text>
            ) : null}

            <View style={S.listDetailMeta}>
              <Badge variant="secondary">{categoryLabel(listDetail.category)}</Badge>
              <View style={S.listDetailVotes}>
                <Ionicons name="arrow-up" size={14} color={c.success} />
                <Text style={[S.listDetailVoteText, { color: c.foreground }]}>
                  {listDetail.voteCount}
                </Text>
              </View>
            </View>

            {listDetail.items.map((entry, idx) => (
              <Animated.View
                key={idx}
                entering={FadeInUp.delay(idx * 40).springify()}
                style={[S.listDetailItem, { borderBottomColor: c.border }]}
              >
                <View style={[S.listDetailRank, { backgroundColor: c.muted }]}>
                  <Text style={[S.listDetailRankText, { color: c.foreground }]}>{entry.rank}</Text>
                </View>
                <Text style={[S.listDetailName, { color: c.foreground }]}>{entry.name}</Text>
                {entry.value ? (
                  <Text style={[S.listDetailValue, { color: c.foregroundMuted }]}>
                    {entry.value}
                  </Text>
                ) : null}
              </Animated.View>
            ))}
          </View>
        )}
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  listControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  modalBody: {
    paddingBottom: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    minHeight: 48,
  },
  textArea: {
    minHeight: 120,
  },
  textAreaSmall: {
    minHeight: 72,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  categoryPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  detailLoading: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  listDetailDesc: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing.md,
  },
  listDetailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  listDetailVotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  listDetailVoteText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  listDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  listDetailRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDetailRankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  listDetailName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  listDetailValue: {
    fontSize: fontSize.sm,
  },
});
