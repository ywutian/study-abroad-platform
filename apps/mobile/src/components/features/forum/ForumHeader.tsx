import React, { memo, useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedCard, AnimatedCounter, CardContent, SearchBar, Segment } from '@/components/ui';
import { useColors, spacing } from '@/utils/theme';
import { styles } from '@/app/forum.styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryDto {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  color: string;
  postCount: number;
}

export interface PostAuthor {
  id: string;
  name?: string;
  avatar?: string;
  isVerified?: boolean;
  email?: string;
  profile?: {
    nickname?: string;
    avatarUrl?: string;
  };
}

export interface PostDto {
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

export interface ForumStats {
  postCount?: number;
  userCount?: number;
  teamingCount?: number;
  activeToday?: number;
  totalPosts?: number;
  totalComments?: number;
  totalUsers?: number;
  todayPosts?: number;
}

export interface PostsResponse {
  posts: PostDto[];
  total: number;
  hasMore: boolean;
}

export enum PostSortBy {
  latest = 'latest',
  popular = 'popular',
  comments = 'comments',
  recommended = 'recommended',
}

export interface CreatePostDto {
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

export const PAGE_SIZE = 15;

export const SORT_OPTIONS: { key: PostSortBy; labelKey: string }[] = [
  { key: PostSortBy.latest, labelKey: 'forum.sort.latest' },
  { key: PostSortBy.popular, labelKey: 'forum.sort.popular' },
  { key: PostSortBy.comments, labelKey: 'forum.sort.comments' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const timeAgo = (
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string => {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.time.justNow');
  if (mins < 60) return t('common.time.minutesShort', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.time.hoursShort', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('common.time.daysShort', { count: days });
  const months = Math.floor(days / 30);
  return t('common.time.monthsShort', { count: months });
};

export const getAuthorName = (author: PostAuthor): string => {
  return author.name || author.profile?.nickname || author.email?.split('@')[0] || 'User';
};

// ---------------------------------------------------------------------------
// Memoized header for FlashList ListHeaderComponent
// ---------------------------------------------------------------------------

export interface ForumHeaderProps {
  stats: ForumStats | undefined;
  search: string;
  onSearchChange: (text: string) => void;
  categories: CategoryDto[] | undefined;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  sortBy: PostSortBy;
  onSortChange: (key: PostSortBy) => void;
  postsTotal: number | undefined;
  isFetching: boolean;
  isLoading: boolean;
  colors: ReturnType<typeof useColors>;
  isZh: boolean;
}

export const ForumHeader = memo(function ForumHeader({
  stats,
  search,
  onSearchChange,
  categories,
  selectedCategoryId,
  onSelectCategory,
  sortBy,
  onSortChange,
  postsTotal,
  isFetching,
  isLoading,
  colors: c,
  isZh,
}: ForumHeaderProps) {
  const { t } = useTranslation();

  const categoryLabel = (cat: CategoryDto) => (isZh ? cat.nameZh || cat.name : cat.name);

  const statItems = useMemo(() => {
    if (!stats) return [];
    return [
      {
        value: stats.postCount ?? stats.totalPosts ?? 0,
        label: t('forum.stats.posts'),
        color: c.primary,
      },
      {
        value: stats.userCount ?? stats.totalUsers ?? 0,
        label: t('forum.stats.users'),
        color: c.info,
      },
      {
        value: stats.teamingCount ?? stats.totalComments ?? 0,
        label: t('forum.stats.teaming'),
        color: c.success,
      },
      {
        value: stats.activeToday ?? stats.todayPosts ?? 0,
        label: t('forum.stats.activeToday'),
        color: c.warning,
      },
    ];
  }, [stats, t, c.primary, c.info, c.success, c.warning]);

  return (
    <View>
      {/* Stats */}
      {stats && (
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <AnimatedCard style={styles.statsCard}>
            <CardContent>
              <View style={styles.statsRow}>
                {statItems.map((stat) => (
                  <View key={stat.label} style={styles.statItem}>
                    <AnimatedCounter
                      value={stat.value}
                      style={[styles.statValue, { color: stat.color }]}
                    />
                    <Text style={[styles.statLabel, { color: c.foregroundMuted }]}>
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>
            </CardContent>
          </AnimatedCard>
        </Animated.View>
      )}

      {/* Search */}
      <SearchBar
        value={search}
        onChangeText={onSearchChange}
        placeholder={t('forum.searchPlaceholder')}
        style={styles.searchBar}
      />

      {/* Category filters */}
      {categories && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            onPress={() => onSelectCategory(null)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedCategoryId === null }}
            accessibilityLabel={t('forum.allCategories')}
            style={[
              styles.categoryChip,
              { backgroundColor: selectedCategoryId === null ? c.primary : c.muted },
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
                onPress={() => onSelectCategory(isActive ? null : cat.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={categoryLabel(cat)}
                style={[
                  styles.categoryChip,
                  { backgroundColor: isActive ? cat.color || c.primary : c.muted },
                ]}
              >
                {cat.icon ? <Text style={styles.categoryIcon}>{cat.icon}</Text> : null}
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: isActive ? c.onGradient : c.foreground },
                  ]}
                >
                  {categoryLabel(cat)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Sort */}
      <Segment
        segments={SORT_OPTIONS.map((opt) => ({ key: opt.key, label: t(opt.labelKey) }))}
        value={sortBy}
        onChange={(key) => onSortChange(key as PostSortBy)}
        style={styles.sortSegment}
      />

      {/* Results count */}
      {postsTotal != null && (
        <View style={styles.resultsRow}>
          <Text style={[styles.resultsCount, { color: c.foregroundMuted }]}>
            {t('forum.resultsCount', { count: postsTotal })}
          </Text>
          {isFetching && !isLoading && (
            <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: spacing.sm }} />
          )}
        </View>
      )}
    </View>
  );
});
