/**
 * Forum Page - Community discussion board with categories, search, and post creation.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  SearchBar,
  Segment,
  AnimatedButton,
  Modal,
  Checkbox,
  AnimatedCounter,
} from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryDto {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  color: string;
  postCount: number;
}

interface PostAuthor {
  id: string;
  email: string;
  profile?: {
    nickname: string;
    avatarUrl: string;
  };
}

interface PostDto {
  id: string;
  categoryId: string;
  category: CategoryDto;
  author: PostAuthor;
  title: string;
  content: string;
  tags: string[];
  isTeamPost: boolean;
  teamSize: number | null;
  currentSize: number | null;
  requirements: string | null;
  teamDeadline: string | null;
  teamStatus: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ForumStats {
  totalPosts: number;
  totalComments: number;
  totalUsers: number;
  todayPosts: number;
}

interface PostsResponse {
  items: PostDto[];
  total: number;
}

enum PostSortBy {
  latest = 'latest',
  popular = 'popular',
  comments = 'comments',
  recommended = 'recommended',
}

interface CreatePostDto {
  categoryId: string;
  title: string;
  content: string;
  tags: string[];
  isTeamPost: boolean;
  teamSize?: number;
  requirements?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

const SORT_OPTIONS: { key: PostSortBy; labelKey: string }[] = [
  { key: PostSortBy.latest, labelKey: 'forum.sort.latest' },
  { key: PostSortBy.popular, labelKey: 'forum.sort.popular' },
  { key: PostSortBy.comments, labelKey: 'forum.sort.comments' },
];

const keys = {
  categories: ['forum', 'categories'] as const,
  stats: ['forum', 'stats'] as const,
  posts: (params: Record<string, unknown>) => ['forum', 'posts', params] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const timeAgo = (dateStr: string): string => {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
};

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
    queryKey: keys.categories,
    queryFn: () => apiClient.get<CategoryDto[]>('/forums/categories'),
  });

  const { data: stats } = useQuery<ForumStats>({
    queryKey: keys.stats,
    queryFn: () => apiClient.get<ForumStats>('/forums/stats'),
  });

  const {
    data: postsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<PostsResponse>({
    queryKey: keys.posts(queryParams),
    queryFn: () => apiClient.get<PostsResponse>('/forums/posts', { params: queryParams }),
  });

  // ---- Mutations ----

  const createPost = useMutation<PostDto, Error, CreatePostDto>({
    mutationFn: (dto) => apiClient.post<PostDto>('/forums/posts', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum'] });
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

  // ---- Sub-Renders ----

  // Stats header card
  const renderStatsHeader = () => {
    if (!stats) return null;
    return (
      <Animated.View entering={FadeInDown.duration(400).springify()}>
        <AnimatedCard style={styles.statsCard}>
          <CardContent>
            <View style={styles.statsRow}>
              {[
                { value: stats.totalPosts, label: t('forum.stats.posts'), color: c.primary },
                { value: stats.totalComments, label: t('forum.stats.comments'), color: c.info },
                { value: stats.totalUsers, label: t('forum.stats.users'), color: c.success },
                { value: stats.todayPosts, label: t('forum.stats.today'), color: c.warning },
              ].map((stat) => (
                <View key={stat.label} style={styles.statItem}>
                  <AnimatedCounter
                    value={stat.value}
                    style={[styles.statValue, { color: stat.color }]}
                  />
                  <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  // Category filter chips
  const renderCategoryFilters = () => {
    if (!categories?.length) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        <TouchableOpacity
          onPress={() => {
            setSelectedCategoryId(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[
            styles.categoryChip,
            {
              backgroundColor: selectedCategoryId === null ? c.primary : c.muted,
            },
          ]}
        >
          <Text
            style={[
              styles.categoryChipText,
              { color: selectedCategoryId === null ? c.primaryForeground : c.foreground },
            ]}
          >
            {t('forum.allCategories')}
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => {
          const isActive = selectedCategoryId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => {
                setSelectedCategoryId(isActive ? null : cat.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isActive ? cat.color || c.primary : c.muted,
                },
              ]}
            >
              {cat.icon ? <Text style={styles.categoryIcon}>{cat.icon}</Text> : null}
              <Text
                style={[styles.categoryChipText, { color: isActive ? '#ffffff' : c.foreground }]}
              >
                {categoryLabel(cat)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Sort segment
  const renderSortSegment = () => (
    <Segment
      segments={SORT_OPTIONS.map((opt) => ({ key: opt.key, label: t(opt.labelKey) }))}
      value={sortBy}
      onChange={(key) => {
        setSortBy(key as PostSortBy);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={styles.sortSegment}
    />
  );

  // Results count
  const renderResultsInfo = () => {
    if (!postsData) return null;
    return (
      <View style={styles.resultsRow}>
        <Text style={[styles.resultsCount, { color: c.foregroundMuted }]}>
          {t('forum.resultsCount', { count: postsData.total })}
        </Text>
        {isFetching && !isLoading && (
          <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: spacing.sm }} />
        )}
      </View>
    );
  };

  // Post card
  const renderPostCard = ({ item }: { item: PostDto }) => {
    const authorName = item.author.profile?.nickname || item.author.email.split('@')[0];
    const catLabel = item.category ? categoryLabel(item.category) : '';

    return (
      <Animated.View entering={FadeInUp.springify()}>
        <AnimatedCard
          onPress={() => {
            router.push(`/forum/${item.id}`);
          }}
          style={[
            styles.postCard,
            item.isPinned && { borderLeftWidth: 3, borderLeftColor: c.warning },
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
                      ? { backgroundColor: item.category.color + '20' }
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
                    <Text
                      style={{ color: c.primaryForeground, fontSize: fontSize.xs, marginLeft: 2 }}
                    >
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
              <View style={[styles.teamInfoRow, { backgroundColor: c.primary + '08' }]}>
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
                <View style={[styles.avatarPlaceholder, { backgroundColor: c.primary + '20' }]}>
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
                <Text style={[styles.timeSeparator, { color: c.foregroundMuted }]}> &middot; </Text>
                <Text style={[styles.timeText, { color: c.foregroundMuted }]}>
                  {timeAgo(item.createdAt)}
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
  };

  // List header (assembled)
  const listHeader = useMemo(
    () => (
      <View>
        {renderStatsHeader()}
        <SearchBar
          value={search}
          onChangeText={handleSearchChange}
          placeholder={t('forum.searchPlaceholder')}
          style={styles.searchBar}
        />
        {renderCategoryFilters()}
        {renderSortSegment()}
        {renderResultsInfo()}
      </View>
    ),
    [search, selectedCategoryId, sortBy, categories, stats, postsData, isFetching, isLoading, c, t]
  );

  // ---- Create Post Modal ----

  const categoryOptions = useMemo(
    () =>
      (categories || []).map((cat) => ({
        value: cat.id,
        label: categoryLabel(cat),
      })),
    [categories, isZh]
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
        style={{ minHeight: 120, textAlignVertical: 'top' }}
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
            containerStyle={{ flex: 1, marginBottom: 0 }}
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
                style={[styles.tagRemovable, { backgroundColor: c.primary + '15' }]}
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
        <Checkbox
          checked={newPost.isTeamPost}
          onPress={() => setNewPost((p) => ({ ...p, isTeamPost: !p.isTeamPost }))}
          label={t('forum.isTeamPost')}
          description={t('forum.teamPostDesc')}
        />

        {newPost.isTeamPost && (
          <View style={styles.teamFields}>
            <Input
              label={t('forum.teamSize')}
              placeholder={t('forum.teamSizePlaceholder')}
              value={newPost.teamSize?.toString() || ''}
              onChangeText={(val) => {
                const num = parseInt(val, 10);
                setNewPost((p) => ({ ...p, teamSize: isNaN(num) ? undefined : num }));
              }}
              keyboardType="number-pad"
            />
            <Input
              label={t('forum.requirements')}
              placeholder={t('forum.requirementsPlaceholder')}
              value={newPost.requirements || ''}
              onChangeText={(val) => setNewPost((p) => ({ ...p, requirements: val }))}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>
        )}
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
        ) : !postsData || postsData.items.length === 0 ? (
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
            data={postsData.items}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Stats
  statsCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  // Search
  searchBar: {
    marginBottom: spacing.md,
  },

  // Category filters
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterScrollContent: {
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  categoryIcon: {
    fontSize: fontSize.sm,
  },
  categoryChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // Sort
  sortSegment: {
    marginBottom: spacing.md,
  },

  // Results
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resultsCount: {
    fontSize: fontSize.sm,
  },

  // Post card
  postCard: {
    marginBottom: spacing.md,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pinnedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  postTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.base * 1.4,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  teamBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: 10,
  },
  teamInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  teamInfoText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  authorName: {
    fontSize: fontSize.xs,
    marginLeft: spacing.xs,
    maxWidth: 80,
  },
  timeSeparator: {
    fontSize: fontSize.xs,
  },
  timeText: {
    fontSize: fontSize.xs,
  },
  statsRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: fontSize.xs,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    shadowOpacity: 0.2,
    elevation: 5,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  // Create post modal
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  tagsSection: {
    marginBottom: spacing.lg,
  },
  tagsInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tagRemovable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  tagRemovableText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  teamSection: {
    marginBottom: spacing.lg,
  },
  teamFields: {
    marginTop: spacing.md,
    paddingLeft: spacing.xl + spacing.md,
  },
});
