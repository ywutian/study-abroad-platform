/**
 * Forum Page - Community discussion board with categories, search, and post creation.
 */
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedButton,
  AnimatedCard,
  Badge,
  CardContent,
  EmptyState,
  Loading,
  Modal,
} from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { cachePolicy, qk } from '@/lib/query';
import { spacing, useColors, withOpacity } from '@/utils/theme';
import { API_ROUTES, forumRoutes } from '@study-abroad/shared';
import { styles } from './forum.styles';

import {
  ForumHeader,
  PAGE_SIZE,
  PostSortBy,
  getAuthorName,
  timeAgo,
  type CategoryDto,
  type CreatePostDto,
  type ForumStats,
  type PostDto,
  type PostsResponse,
} from '@/components/features/forum/ForumHeader';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ForumPage() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isZh = i18n.language?.startsWith('zh');

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<PostSortBy>(PostSortBy.latest);
  const [refreshing, setRefreshing] = useState(false);

  // Create post modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPost, setNewPost] = useState<CreatePostDto>({
    categoryId: '',
    title: '',
    content: '',
    tags: [],
    isTeamPost: false,
    teamSize: undefined,
    requirements: undefined,
  });
  const [tagInput, setTagInput] = useState('');

  // Debounced search
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 400);
  }, []);

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: PAGE_SIZE,
      offset: 0,
      sortBy,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedCategoryId) params.categoryId = selectedCategoryId;
    return params;
  }, [debouncedSearch, selectedCategoryId, sortBy]);

  // ---- Queries ----

  const { data: categories } = useQuery<CategoryDto[]>({
    queryKey: qk.forum.categories(),
    queryFn: () => apiClient.get<CategoryDto[]>(`${API_ROUTES.FORUMS}/categories`),
    // Categories rarely change within a session.
    ...cachePolicy.static,
  });

  const { data: stats } = useQuery<ForumStats>({
    queryKey: qk.forum.stats(),
    queryFn: () => apiClient.get<ForumStats>(`${API_ROUTES.FORUMS}/stats`),
    ...cachePolicy.standard,
  });

  const {
    data: postsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<PostsResponse>({
    queryKey: qk.forum.posts(queryParams),
    queryFn: () => apiClient.get<PostsResponse>(forumRoutes.posts(), { params: queryParams }),
    // User-mutable feed → fresh tier; keepPreviousData so the list doesn't blank on
    // search/category/sort change.
    ...cachePolicy.fresh,
    placeholderData: keepPreviousData,
  });

  // ---- Mutations ----

  const createPost = useMutation<PostDto, Error, CreatePostDto>({
    mutationFn: (dto) => apiClient.post<PostDto>(forumRoutes.posts(), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.forum.all });
      setCreateModalVisible(false);
      resetNewPost();
      toast.success(t('forum.postCreated'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ---- Handlers ----

  const resetNewPost = () => {
    setNewPost({
      categoryId: '',
      title: '',
      content: '',
      tags: [],
      isTeamPost: false,
      teamSize: undefined,
      requirements: undefined,
    });
    setTagInput('');
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !newPost.tags.includes(trimmed) && newPost.tags.length < 5) {
      setNewPost((p) => ({ ...p, tags: [...p.tags, trimmed] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setNewPost((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  };

  const handleCreatePost = () => {
    if (!newPost.categoryId || !newPost.title.trim() || !newPost.content.trim()) return;
    createPost.mutate({
      ...newPost,
      title: newPost.title.trim(),
      content: newPost.content.trim(),
      teamSize: newPost.isTeamPost ? newPost.teamSize : undefined,
      requirements: newPost.isTeamPost ? newPost.requirements : undefined,
    });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const categoryLabel = useCallback(
    (cat: CategoryDto) => (isZh ? cat.nameZh || cat.name : cat.name),
    [isZh]
  );

  const handleSelectCategory = useCallback((id: string | null) => {
    setSelectedCategoryId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSortChange = useCallback((sort: PostSortBy) => {
    setSortBy(sort);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ---- Sub-Renders ----

  // Post card
  const renderPostCard = useCallback(
    ({ item }: { item: PostDto }) => {
      const authorName = getAuthorName(item.author);
      const catLabel = item.category ? categoryLabel(item.category) : '';

      return (
        <Animated.View entering={FadeInUp.springify()}>
          <AnimatedCard
            onPress={() => {
              router.push(`/forum/${item.id}`);
            }}
            accessibilityLabel={`${item.title}, ${authorName}`}
            style={[
              styles.postCard,
              item.isPinned && [styles.pinnedCard, { borderLeftColor: c.warning }],
            ]}
          >
            <CardContent>
              {/* Pinned indicator */}
              {item.isPinned && (
                <View style={styles.pinnedRow}>
                  <Ionicons name="pin" size={12} color={c.warning} />
                  <Text style={[styles.pinnedText, { color: c.warning }]}>{t('forum.pinned')}</Text>
                </View>
              )}

              {/* Title */}
              <Text style={[styles.postTitle, { color: c.foreground }]} numberOfLines={2}>
                {item.title}
              </Text>

              {/* Badges row: category + team + tags */}
              <View style={styles.badgeRow}>
                {catLabel ? (
                  <Badge
                    variant="secondary"
                    style={
                      item.category?.color
                        ? { backgroundColor: withOpacity(item.category.color, 0.125) }
                        : undefined
                    }
                  >
                    {catLabel}
                  </Badge>
                ) : null}
                {item.isTeamPost && (
                  <Badge variant="default">
                    <View style={styles.teamBadgeContent}>
                      <Ionicons name="people" size={10} color={c.primaryForeground} />
                      <Text style={[styles.teamBadgeText, { color: c.primaryForeground }]}>
                        {t('forum.team')}
                      </Text>
                    </View>
                  </Badge>
                )}
                {item.tags.slice(0, 2).map((tag) => (
                  <View key={tag} style={[styles.tagChip, { backgroundColor: c.muted }]}>
                    <Text style={[styles.tagText, { color: c.foregroundMuted }]}>#{tag}</Text>
                  </View>
                ))}
              </View>

              {/* Team info snippet */}
              {item.isTeamPost && item.teamSize && (
                <View
                  style={[styles.teamInfoRow, { backgroundColor: withOpacity(c.primary, 0.03) }]}
                >
                  <Ionicons name="people-outline" size={14} color={c.primary} />
                  <Text style={[styles.teamInfoText, { color: c.primary }]}>
                    {item.currentSize ?? 0}/{item.teamSize} {t('forum.members')}
                  </Text>
                  {item.teamStatus === 'OPEN' && (
                    <Badge variant="success">{t('forum.teamOpen')}</Badge>
                  )}
                  {item.teamStatus === 'CLOSED' && (
                    <Badge variant="error">{t('forum.teamClosed')}</Badge>
                  )}
                </View>
              )}

              {/* Footer: author, time, stats */}
              <View style={styles.postFooter}>
                <View style={styles.authorRow}>
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      { backgroundColor: withOpacity(c.primary, 0.125) },
                    ]}
                  >
                    <Text style={[styles.avatarInitial, { color: c.primary }]}>
                      {authorName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[styles.authorName, { color: c.foregroundSecondary }]}
                    numberOfLines={1}
                  >
                    {authorName}
                  </Text>
                  <Text style={[styles.timeSeparator, { color: c.foregroundMuted }]}>
                    {' '}
                    &middot;{' '}
                  </Text>
                  <Text style={[styles.timeText, { color: c.foregroundMuted }]}>
                    {timeAgo(item.createdAt, t)}
                  </Text>
                </View>
                <View style={styles.statsRow2}>
                  <View style={styles.statIconRow}>
                    <Ionicons
                      name={item.isLiked ? 'heart' : 'heart-outline'}
                      size={14}
                      color={item.isLiked ? c.error : c.foregroundMuted}
                    />
                    <Text style={[styles.statText, { color: c.foregroundMuted }]}>
                      {item.likeCount}
                    </Text>
                  </View>
                  <View style={styles.statIconRow}>
                    <Ionicons name="chatbubble-outline" size={14} color={c.foregroundMuted} />
                    <Text style={[styles.statText, { color: c.foregroundMuted }]}>
                      {item.commentCount}
                    </Text>
                  </View>
                  <View style={styles.statIconRow}>
                    <Ionicons name="eye-outline" size={14} color={c.foregroundMuted} />
                    <Text style={[styles.statText, { color: c.foregroundMuted }]}>
                      {item.viewCount}
                    </Text>
                  </View>
                </View>
              </View>
            </CardContent>
          </AnimatedCard>
        </Animated.View>
      );
    },
    [
      c.foreground,
      c.foregroundMuted,
      c.foregroundSecondary,
      c.warning,
      c.primary,
      c.primaryForeground,
      c.muted,
      c.error,
      t,
      categoryLabel,
    ]
  );

  // List header (memoized component — isolates re-renders from the post list)
  const listHeader = useMemo(
    () => (
      <ForumHeader
        stats={stats}
        search={search}
        onSearchChange={handleSearchChange}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        postsTotal={postsData?.total}
        isFetching={isFetching}
        isLoading={isLoading}
        colors={c}
        isZh={!!isZh}
      />
    ),
    [
      stats,
      search,
      handleSearchChange,
      categories,
      selectedCategoryId,
      handleSelectCategory,
      sortBy,
      handleSortChange,
      postsData?.total,
      isFetching,
      isLoading,
      c,
      isZh,
    ]
  );

  // ---- Create Post Modal ----

  const categoryOptions = useMemo(
    () =>
      (categories || []).map((cat) => ({
        value: cat.id,
        label: categoryLabel(cat),
      })),
    [categories, categoryLabel]
  );

  const renderCreatePostModal = () => (
    <Modal
      visible={createModalVisible}
      onClose={() => {
        setCreateModalVisible(false);
        resetNewPost();
      }}
      title={t('forum.createPost')}
      fullScreen
      footer={
        <AnimatedButton
          onPress={handleCreatePost}
          disabled={
            !newPost.categoryId ||
            !newPost.title.trim() ||
            !newPost.content.trim() ||
            createPost.isPending
          }
          loading={createPost.isPending}
        >
          {t('forum.publish')}
        </AnimatedButton>
      }
    >
      <Select
        options={categoryOptions}
        value={newPost.categoryId}
        onChange={(val) => setNewPost((p) => ({ ...p, categoryId: val }))}
        label={t('forum.category')}
        placeholder={t('forum.selectCategory')}
      />

      <Input
        label={t('forum.postTitle')}
        placeholder={t('forum.titlePlaceholder')}
        value={newPost.title}
        onChangeText={(val) => setNewPost((p) => ({ ...p, title: val }))}
        maxLength={100}
      />

      <Input
        label={t('forum.postContent')}
        placeholder={t('forum.contentPlaceholder')}
        value={newPost.content}
        onChangeText={(val) => setNewPost((p) => ({ ...p, content: val }))}
        multiline
        numberOfLines={6}
        style={styles.contentInput}
      />

      {/* Tags input */}
      <View style={styles.tagsSection}>
        <Text style={[styles.inputLabel, { color: c.foreground }]}>{t('forum.tags')}</Text>
        <View style={styles.tagsInputRow}>
          <Input
            placeholder={t('forum.tagPlaceholder')}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={addTag}
            containerStyle={styles.tagInput}
            returnKeyType="done"
          />
          <AnimatedButton
            variant="outline"
            size="sm"
            onPress={addTag}
            disabled={!tagInput.trim() || newPost.tags.length >= 5}
            style={{ marginLeft: spacing.sm }}
          >
            {t('forum.addTag')}
          </AnimatedButton>
        </View>
        {newPost.tags.length > 0 && (
          <View style={styles.tagsList}>
            {newPost.tags.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => removeTag(tag)}
                style={[styles.tagRemovable, { backgroundColor: withOpacity(c.primary, 0.08) }]}
              >
                <Text style={[styles.tagRemovableText, { color: c.primary }]}>#{tag}</Text>
                <Ionicons name="close" size={14} color={c.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Team post toggle */}
      <View style={styles.teamSection}>
        <Text style={[styles.inputLabel, { color: c.foreground }]}>
          {i18n.language?.startsWith('zh')
            ? '论坛组队帖已切为只读，请到 /teams 使用新的比赛组队匹配。'
            : 'Legacy forum team posts are read-only now. Use /teams for live competition matching.'}
        </Text>
      </View>
    </Modal>
  );

  // ---- Main Render ----

  return (
    <>
      <Stack.Screen options={{ title: t('forum.title') }} />

      <View style={[styles.container, { backgroundColor: c.background }]}>
        {isLoading ? (
          <Loading text={t('forum.loading')} />
        ) : !postsData || postsData.posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            {listHeader}
            <EmptyState
              icon="chatbubbles-outline"
              title={t('forum.noPosts')}
              description={t('forum.noPostsDesc')}
              action={{
                label: t('forum.createPost'),
                onPress: () => setCreateModalVisible(true),
              }}
            />
          </View>
        ) : (
          <FlashList
            data={postsData.posts}
            renderItem={renderPostCard}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={listHeader}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + spacing['3xl'] + 60 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        )}

        {/* FAB */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={[
            styles.fab,
            {
              backgroundColor: c.primary,
              bottom: insets.bottom + spacing.xl,
            },
          ]}
        >
          <AnimatedButton
            size="icon"
            onPress={() => {
              setCreateModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            accessibilityLabel={t('forum.createPost')}
            style={[styles.fabInner, { backgroundColor: c.primary }]}
          >
            <Ionicons name="add" size={28} color={c.primaryForeground} />
          </AnimatedButton>
        </Animated.View>
      </View>

      {renderCreatePostModal()}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
