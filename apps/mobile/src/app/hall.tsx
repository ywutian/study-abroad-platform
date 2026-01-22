/**
 * Hall of Fame Page
 *
 * 4 tabs: Reviews (锐评) | Ranking (竞争力排名) | Lists (排行榜) | Verified (认证排名)
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  Segment,
  Modal,
  ProgressBar,
  Avatar,
} from '@/components/ui';
import { Slider } from '@/components/ui/Slider';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewUser {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
}

interface Review {
  id: string;
  profileUser: ReviewUser;
  reviewer: ReviewUser;
  academicScore: number;
  testScore: number;
  activityScore: number;
  awardScore: number;
  overallScore: number;
  comment?: string;
  tags?: string[];
  helpfulCount: number;
  insightfulCount: number;
  myReaction?: 'helpful' | 'insightful' | null;
  createdAt: string;
}

interface ReviewsResponse {
  items: Review[];
  total: number;
}

interface CreateReviewDto {
  profileUserId: string;
  academicScore: number;
  testScore: number;
  activityScore: number;
  awardScore: number;
  overallScore: number;
  comment?: string;
  tags?: string[];
}

interface RankingResult {
  schoolId: string;
  schoolName: string;
  totalApplicants: number;
  yourRank: number;
  yourScore: number;
  percentile: number;
  breakdown: Record<string, number>;
  competitivePosition: string;
}

interface HallList {
  id: string;
  title: string;
  description?: string;
  category: string;
  voteCount: number;
  myVote?: 'up' | 'down' | null;
  creator: {
    id: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  itemCount: number;
  createdAt: string;
}

interface HallListDetail {
  id: string;
  title: string;
  description?: string;
  category: string;
  voteCount: number;
  myVote?: 'up' | 'down' | null;
  creator: {
    id: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  items: { rank: number; name: string; value?: string }[];
}

interface CreateListDto {
  title: string;
  description?: string;
  category: string;
  items: { name: string; value?: string }[];
}

interface VerifiedUserDto {
  rank: number;
  userId: string;
  email: string;
  nickname: string;
  avatarUrl?: string | null;
  school: string;
  schoolNameZh?: string;
  major?: string;
  year?: number;
  result: string;
  gpa?: number;
  sat?: number;
  act?: number;
  pointsTotal: number;
}

interface VerifiedRankingResponse {
  items: VerifiedUserDto[];
  total: number;
  stats?: {
    totalVerified: number;
    avgGpa: number;
    admittedCount: number;
  };
}

type TabKey = 'reviews' | 'ranking' | 'lists' | 'verified';
type RankingFilter = 'all' | 'admitted' | 'top20' | 'ivy';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCORE_LABELS = ['academic', 'test', 'activity', 'award', 'overall'] as const;

const PERCENTILE_COLORS = {
  top10: '#10b981',
  top25: '#3b82f6',
  top50: '#f59e0b',
  bottom: '#ef4444',
};

const RANKING_FILTERS: RankingFilter[] = ['all', 'admitted', 'top20', 'ivy'];

const RESULT_BADGE_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'secondary'> = {
  ADMITTED: 'success',
  REJECTED: 'error',
  WAITLISTED: 'warning',
  DEFERRED: 'secondary',
};

const LIST_CATEGORIES = ['tier', 'major', 'location', 'value', 'other'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPercentileColor(percentile: number): string {
  if (percentile >= 90) return PERCENTILE_COLORS.top10;
  if (percentile >= 75) return PERCENTILE_COLORS.top25;
  if (percentile >= 50) return PERCENTILE_COLORS.top50;
  return PERCENTILE_COLORS.bottom;
}

function averageScore(r: Review): number {
  return (
    Math.round(
      ((r.academicScore + r.testScore + r.activityScore + r.awardScore + r.overallScore) / 5) * 10
    ) / 10
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function HallOfFamePage() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Global state
  const [activeTab, setActiveTab] = useState<TabKey>('reviews');
  const [refreshing, setRefreshing] = useState(false);

  // -----------------------------------------------------------------------
  // Reviews state
  // -----------------------------------------------------------------------
  const [reviewMode, setReviewMode] = useState<'popular' | 'mine'>('popular');
  const [writeReviewVisible, setWriteReviewVisible] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState('');
  const [reviewTargetName, setReviewTargetName] = useState('');
  const [reviewScores, setReviewScores] = useState({
    academicScore: 5,
    testScore: 5,
    activityScore: 5,
    awardScore: 5,
    overallScore: 5,
  });
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState('');

  // -----------------------------------------------------------------------
  // Ranking state
  // -----------------------------------------------------------------------
  // (no extra local state needed, data fetched via query)

  // -----------------------------------------------------------------------
  // Lists state
  // -----------------------------------------------------------------------
  const [createListVisible, setCreateListVisible] = useState(false);
  const [listDetailId, setListDetailId] = useState<string | null>(null);
  const [listDetailVisible, setListDetailVisible] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCategory, setNewListCategory] = useState<string>('tier');
  const [newListItems, setNewListItems] = useState('');

  // -----------------------------------------------------------------------
  // Verified state
  // -----------------------------------------------------------------------
  const [verifiedFilter, setVerifiedFilter] = useState<RankingFilter>('all');

  // -----------------------------------------------------------------------
  // Segment config
  // -----------------------------------------------------------------------
  const segments = useMemo(
    () => [
      { key: 'reviews', label: t('hallOfFame.tabs.reviews', 'Reviews') },
      { key: 'ranking', label: t('hallOfFame.tabs.ranking', 'Ranking') },
      { key: 'lists', label: t('hallOfFame.tabs.lists', 'Lists') },
      { key: 'verified', label: t('hallOfFame.tabs.verified', 'Verified') },
    ],
    [t]
  );

  // -----------------------------------------------------------------------
  // API: Reviews
  // -----------------------------------------------------------------------
  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    refetch: refetchReviews,
  } = useQuery<ReviewsResponse>({
    queryKey: ['hall-reviews', reviewMode],
    queryFn: () =>
      reviewMode === 'mine'
        ? apiClient.get<ReviewsResponse>('/hall/reviews/me')
        : apiClient.get<ReviewsResponse>('/hall/reviews/popular'),
    staleTime: 2 * 60_000,
  });

  const createReviewMutation = useMutation<Review, Error, CreateReviewDto>({
    mutationFn: (dto) => apiClient.post<Review>('/hall/reviews', dto),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: t('hallOfFame.reviews.created', 'Review submitted!'),
      });
      queryClient.invalidateQueries({ queryKey: ['hall-reviews'] });
      closeWriteReview();
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  const reactMutation = useMutation<
    void,
    Error,
    { reviewId: string; type: 'helpful' | 'insightful' }
  >({
    mutationFn: ({ reviewId, type }) => apiClient.post(`/hall/reviews/${reviewId}/react`, { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-reviews'] });
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  // -----------------------------------------------------------------------
  // API: Ranking
  // -----------------------------------------------------------------------
  const {
    data: rankingData,
    isLoading: rankingLoading,
    refetch: refetchRanking,
  } = useQuery<RankingResult[]>({
    queryKey: ['hall-target-ranking'],
    queryFn: () => apiClient.get<RankingResult[]>('/hall/target-ranking'),
    enabled: activeTab === 'ranking',
    staleTime: 5 * 60_000,
  });

  // -----------------------------------------------------------------------
  // API: Lists
  // -----------------------------------------------------------------------
  const {
    data: listsData,
    isLoading: listsLoading,
    refetch: refetchLists,
  } = useQuery<HallList[]>({
    queryKey: ['hall-lists'],
    queryFn: () => apiClient.get<HallList[]>('/hall/lists'),
    enabled: activeTab === 'lists',
    staleTime: 2 * 60_000,
  });

  const { data: listDetail, isLoading: listDetailLoading } = useQuery<HallListDetail>({
    queryKey: ['hall-list-detail', listDetailId],
    queryFn: () => apiClient.get<HallListDetail>(`/hall/lists/${listDetailId}`),
    enabled: !!listDetailId,
  });

  const createListMutation = useMutation<HallList, Error, CreateListDto>({
    mutationFn: (dto) => apiClient.post<HallList>('/hall/lists', dto),
    onSuccess: () => {
      toast.show({ type: 'success', message: t('hallOfFame.lists.created', 'List created!') });
      queryClient.invalidateQueries({ queryKey: ['hall-lists'] });
      closeCreateList();
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  const voteMutation = useMutation<void, Error, { listId: string; direction: 'up' | 'down' }>({
    mutationFn: ({ listId, direction }) =>
      apiClient.post(`/hall/lists/${listId}/vote`, { direction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall-lists'] });
    },
    onError: (err) => {
      toast.show({ type: 'error', message: err.message });
    },
  });

  // -----------------------------------------------------------------------
  // API: Verified
  // -----------------------------------------------------------------------
  const {
    data: verifiedData,
    isLoading: verifiedLoading,
    refetch: refetchVerified,
  } = useQuery<VerifiedRankingResponse>({
    queryKey: ['hall-verified', verifiedFilter],
    queryFn: () =>
      apiClient.get<VerifiedRankingResponse>('/hall/verified-ranking', {
        params: { filter: verifiedFilter, limit: 50 },
      }),
    enabled: activeTab === 'verified',
    staleTime: 5 * 60_000,
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'reviews') await refetchReviews();
      else if (activeTab === 'ranking') await refetchRanking();
      else if (activeTab === 'lists') await refetchLists();
      else if (activeTab === 'verified') await refetchVerified();
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, refetchReviews, refetchRanking, refetchLists, refetchVerified]);

  const openWriteReview = useCallback((userId: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReviewTargetId(userId);
    setReviewTargetName(name);
    setReviewScores({
      academicScore: 5,
      testScore: 5,
      activityScore: 5,
      awardScore: 5,
      overallScore: 5,
    });
    setReviewComment('');
    setReviewTags('');
    setWriteReviewVisible(true);
  }, []);

  const closeWriteReview = useCallback(() => {
    setWriteReviewVisible(false);
    setReviewTargetId('');
    setReviewTargetName('');
  }, []);

  const submitReview = useCallback(() => {
    if (!reviewTargetId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const tags = reviewTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    createReviewMutation.mutate({
      profileUserId: reviewTargetId,
      ...reviewScores,
      comment: reviewComment || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  }, [reviewTargetId, reviewScores, reviewComment, reviewTags, createReviewMutation]);

  const handleReact = useCallback(
    (reviewId: string, type: 'helpful' | 'insightful') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      reactMutation.mutate({ reviewId, type });
    },
    [reactMutation]
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
        message: t('hallOfFame.lists.titleRequired', 'Title is required'),
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

  // -----------------------------------------------------------------------
  // Score label helper
  // -----------------------------------------------------------------------
  const scoreLabel = useCallback(
    (key: string): string => {
      const map: Record<string, string> = {
        academic: t('hallOfFame.reviews.scores.academic', 'Academic'),
        test: t('hallOfFame.reviews.scores.test', 'Test'),
        activity: t('hallOfFame.reviews.scores.activity', 'Activity'),
        award: t('hallOfFame.reviews.scores.award', 'Award'),
        overall: t('hallOfFame.reviews.scores.overall', 'Overall'),
      };
      return map[key] || key;
    },
    [t]
  );

  const filterLabel = useCallback(
    (filter: RankingFilter): string => {
      const map: Record<RankingFilter, string> = {
        all: t('hallOfFame.verified.filters.all', 'All'),
        admitted: t('hallOfFame.verified.filters.admitted', 'Admitted'),
        top20: t('hallOfFame.verified.filters.top20', 'Top 20'),
        ivy: t('hallOfFame.verified.filters.ivy', 'Ivy'),
      };
      return map[filter];
    },
    [t]
  );

  const categoryLabel = useCallback(
    (cat: string): string => {
      const map: Record<string, string> = {
        tier: t('hallOfFame.lists.categories.tier', 'Tier'),
        major: t('hallOfFame.lists.categories.major', 'Major'),
        location: t('hallOfFame.lists.categories.location', 'Location'),
        value: t('hallOfFame.lists.categories.value', 'Value'),
        other: t('hallOfFame.lists.categories.other', 'Other'),
      };
      return map[cat] || cat;
    },
    [t]
  );

  // =======================================================================
  //  TAB 1: Reviews
  // =======================================================================

  const renderScoreBar = (label: string, value: number, color: string) => (
    <View style={S.scoreBarRow} key={label}>
      <Text style={[S.scoreBarLabel, { color: c.foregroundMuted }]}>{label}</Text>
      <View style={[S.scoreBarTrack, { backgroundColor: c.muted }]}>
        <View
          style={[S.scoreBarFill, { width: `${(value / 10) * 100}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={[S.scoreBarValue, { color: c.foreground }]}>{value}</Text>
    </View>
  );

  const getScoreColor = (score: number): string => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#3b82f6';
    if (score >= 4) return '#f59e0b';
    return '#ef4444';
  };

  const renderReviewCard = ({ item, index }: { item: Review; index: number }) => {
    const avg = averageScore(item);
    const avgColor = getScoreColor(avg);

    return (
      <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
        <AnimatedCard style={S.reviewCard}>
          <CardContent>
            {/* Header: reviewer avatar + name + avg score */}
            <View style={S.reviewHeader}>
              <View style={S.reviewerRow}>
                <Avatar source={item.reviewer.avatarUrl} name={item.reviewer.nickname} size="sm" />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[S.reviewerName, { color: c.foreground }]}>
                    {item.reviewer.nickname}
                  </Text>
                  <Text style={[S.reviewDate, { color: c.foregroundMuted }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <View style={[S.avgBadge, { backgroundColor: avgColor + '18' }]}>
                <Text style={[S.avgBadgeText, { color: avgColor }]}>{avg}</Text>
              </View>
            </View>

            {/* Reviewing label */}
            <View style={S.reviewForRow}>
              <Ionicons name="person-outline" size={14} color={c.foregroundMuted} />
              <Text style={[S.reviewForText, { color: c.foregroundMuted }]}>
                {t('hallOfFame.reviews.reviewFor', 'Review for')}{' '}
                <Text style={{ color: c.primary, fontWeight: fontWeight.semibold }}>
                  {item.profileUser.nickname}
                </Text>
              </Text>
            </View>

            {/* Score bars */}
            <View style={S.scoreBarsContainer}>
              {renderScoreBar(
                scoreLabel('academic'),
                item.academicScore,
                getScoreColor(item.academicScore)
              )}
              {renderScoreBar(scoreLabel('test'), item.testScore, getScoreColor(item.testScore))}
              {renderScoreBar(
                scoreLabel('activity'),
                item.activityScore,
                getScoreColor(item.activityScore)
              )}
              {renderScoreBar(scoreLabel('award'), item.awardScore, getScoreColor(item.awardScore))}
              {renderScoreBar(
                scoreLabel('overall'),
                item.overallScore,
                getScoreColor(item.overallScore)
              )}
            </View>

            {/* Comment */}
            {item.comment ? (
              <Text style={[S.reviewComment, { color: c.foregroundSecondary }]} numberOfLines={4}>
                {item.comment}
              </Text>
            ) : null}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <View style={S.tagsRow}>
                {item.tags.map((tag) => (
                  <View key={tag} style={[S.tagChip, { backgroundColor: c.muted }]}>
                    <Text style={[S.tagChipText, { color: c.foregroundMuted }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Reactions */}
            <View style={S.reactionsRow}>
              <TouchableOpacity
                onPress={() => handleReact(item.id, 'helpful')}
                style={[
                  S.reactionBtn,
                  {
                    backgroundColor: item.myReaction === 'helpful' ? c.primary + '15' : c.muted,
                  },
                ]}
              >
                <Ionicons
                  name="thumbs-up-outline"
                  size={14}
                  color={item.myReaction === 'helpful' ? c.primary : c.foregroundMuted}
                />
                <Text
                  style={[
                    S.reactionText,
                    { color: item.myReaction === 'helpful' ? c.primary : c.foregroundMuted },
                  ]}
                >
                  {t('hallOfFame.reviews.helpful', 'Helpful')}{' '}
                  {item.helpfulCount > 0 ? item.helpfulCount : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleReact(item.id, 'insightful')}
                style={[
                  S.reactionBtn,
                  {
                    backgroundColor: item.myReaction === 'insightful' ? c.info + '15' : c.muted,
                  },
                ]}
              >
                <Ionicons
                  name="bulb-outline"
                  size={14}
                  color={item.myReaction === 'insightful' ? c.info : c.foregroundMuted}
                />
                <Text
                  style={[
                    S.reactionText,
                    { color: item.myReaction === 'insightful' ? c.info : c.foregroundMuted },
                  ]}
                >
                  {t('hallOfFame.reviews.insightful', 'Insightful')}{' '}
                  {item.insightfulCount > 0 ? item.insightfulCount : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  const renderReviewsTab = () => {
    if (reviewsLoading) return <Loading text={t('hallOfFame.loading', 'Loading...')} />;

    const reviews = reviewsData?.items || [];

    return (
      <View style={{ flex: 1 }}>
        {/* Mode toggle + Write button */}
        <Animated.View entering={FadeInDown.duration(300)} style={S.reviewControls}>
          <Segment
            segments={[
              { key: 'popular', label: t('hallOfFame.reviews.popular', 'Popular') },
              { key: 'mine', label: t('hallOfFame.reviews.mine', 'My Reviews') },
            ]}
            value={reviewMode}
            onChange={(key) => setReviewMode(key as 'popular' | 'mine')}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <AnimatedButton
            size="sm"
            onPress={() => openWriteReview('', '')}
            leftIcon={<Ionicons name="create-outline" size={16} color={c.primaryForeground} />}
          >
            {t('hallOfFame.reviews.write', 'Write')}
          </AnimatedButton>
        </Animated.View>

        {reviews.length === 0 ? (
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title={t('hallOfFame.reviews.empty', 'No reviews yet')}
            description={t('hallOfFame.reviews.emptyDesc', 'Be the first to write a review!')}
          />
        ) : (
          <FlashList
            data={reviews}
            renderItem={renderReviewCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  // =======================================================================
  //  TAB 2: Ranking
  // =======================================================================

  const renderRankingCard = ({ item, index }: { item: RankingResult; index: number }) => {
    const pColor = getPercentileColor(item.percentile);
    const breakdownKeys = item.breakdown ? Object.keys(item.breakdown) : [];

    return (
      <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
        <AnimatedCard style={S.rankingCard}>
          <CardContent>
            {/* Header: school name + percentile badge */}
            <View style={S.rankingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[S.rankingSchoolName, { color: c.foreground }]} numberOfLines={1}>
                  {item.schoolName}
                </Text>
                <Text style={[S.rankingApplicants, { color: c.foregroundMuted }]}>
                  {t('hallOfFame.ranking.applicants', '{{count}} applicants', {
                    count: item.totalApplicants,
                  })}
                </Text>
              </View>
              <View style={[S.percentileBadge, { backgroundColor: pColor + '15' }]}>
                <Text style={[S.percentileText, { color: pColor }]}>
                  {t('hallOfFame.ranking.top', 'Top')} {Math.round(100 - item.percentile)}%
                </Text>
              </View>
            </View>

            {/* Rank + Score row */}
            <View style={S.rankScoreRow}>
              <View style={S.rankBox}>
                <Text style={[S.rankLabel, { color: c.foregroundMuted }]}>
                  {t('hallOfFame.ranking.yourRank', 'Your Rank')}
                </Text>
                <Text style={[S.rankValue, { color: pColor }]}>#{item.yourRank}</Text>
              </View>
              <View style={[S.rankDivider, { backgroundColor: c.border }]} />
              <View style={S.rankBox}>
                <Text style={[S.rankLabel, { color: c.foregroundMuted }]}>
                  {t('hallOfFame.ranking.score', 'Score')}
                </Text>
                <Text style={[S.rankValue, { color: c.foreground }]}>{item.yourScore}</Text>
              </View>
              <View style={[S.rankDivider, { backgroundColor: c.border }]} />
              <View style={S.rankBox}>
                <Text style={[S.rankLabel, { color: c.foregroundMuted }]}>
                  {t('hallOfFame.ranking.position', 'Position')}
                </Text>
                <Text style={[S.positionText, { color: pColor }]}>{item.competitivePosition}</Text>
              </View>
            </View>

            {/* Breakdown bars */}
            {breakdownKeys.length > 0 && (
              <View style={S.breakdownContainer}>
                <Text style={[S.breakdownTitle, { color: c.foregroundMuted }]}>
                  {t('hallOfFame.ranking.breakdown', 'Score Breakdown')}
                </Text>
                {breakdownKeys.map((key) => (
                  <ProgressBar
                    key={key}
                    label={key}
                    value={item.breakdown[key]}
                    max={100}
                    size="sm"
                    color={pColor}
                    style={{ marginBottom: spacing.xs }}
                  />
                ))}
              </View>
            )}
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  const renderRankingTab = () => {
    if (rankingLoading) return <Loading text={t('hallOfFame.loading', 'Loading...')} />;

    const rankings = rankingData || [];

    if (rankings.length === 0) {
      return (
        <EmptyState
          icon="bar-chart-outline"
          title={t('hallOfFame.ranking.empty', 'No ranking data')}
          description={t(
            'hallOfFame.ranking.emptyDesc',
            'Add target schools to see your competitive ranking.'
          )}
        />
      );
    }

    return (
      <FlashList
        data={rankings}
        renderItem={renderRankingCard}
        keyExtractor={(item) => item.schoolId}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // =======================================================================
  //  TAB 3: Lists
  // =======================================================================

  const renderListCard = ({ item, index }: { item: HallList; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <AnimatedCard style={S.listCard} onPress={() => openListDetail(item.id)}>
        <CardContent>
          <View style={S.listCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[S.listTitle, { color: c.foreground }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.description ? (
                <Text style={[S.listDesc, { color: c.foregroundMuted }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
          </View>

          <View style={S.listCardFooter}>
            {/* Creator */}
            <View style={S.listCreator}>
              <Avatar source={item.creator.avatarUrl} name={item.creator.nickname} size="sm" />
              <Text style={[S.listCreatorName, { color: c.foregroundMuted }]}>
                {item.creator.nickname}
              </Text>
            </View>

            {/* Items count */}
            <View style={S.listMeta}>
              <Ionicons name="list-outline" size={14} color={c.foregroundMuted} />
              <Text style={[S.listMetaText, { color: c.foregroundMuted }]}>{item.itemCount}</Text>
            </View>

            {/* Vote */}
            <View style={S.voteContainer}>
              <TouchableOpacity
                onPress={() => handleVote(item.id, 'up')}
                style={[
                  S.voteBtn,
                  { backgroundColor: item.myVote === 'up' ? c.success + '15' : 'transparent' },
                ]}
              >
                <Ionicons
                  name={item.myVote === 'up' ? 'caret-up' : 'caret-up-outline'}
                  size={18}
                  color={item.myVote === 'up' ? c.success : c.foregroundMuted}
                />
              </TouchableOpacity>
              <Text
                style={[
                  S.voteCount,
                  {
                    color:
                      item.voteCount > 0
                        ? c.success
                        : item.voteCount < 0
                          ? c.error
                          : c.foregroundMuted,
                  },
                ]}
              >
                {item.voteCount}
              </Text>
              <TouchableOpacity
                onPress={() => handleVote(item.id, 'down')}
                style={[
                  S.voteBtn,
                  { backgroundColor: item.myVote === 'down' ? c.error + '15' : 'transparent' },
                ]}
              >
                <Ionicons
                  name={item.myVote === 'down' ? 'caret-down' : 'caret-down-outline'}
                  size={18}
                  color={item.myVote === 'down' ? c.error : c.foregroundMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        </CardContent>
      </AnimatedCard>
    </Animated.View>
  );

  const renderListsTab = () => {
    if (listsLoading) return <Loading text={t('hallOfFame.loading', 'Loading...')} />;

    const lists = listsData || [];

    return (
      <View style={{ flex: 1 }}>
        <Animated.View entering={FadeInDown.duration(300)} style={S.listControlsRow}>
          <Text style={[S.sectionTitle, { color: c.foreground }]}>
            {t('hallOfFame.lists.title', 'Public Lists')}
          </Text>
          <AnimatedButton
            size="sm"
            onPress={openCreateList}
            leftIcon={<Ionicons name="add-outline" size={16} color={c.primaryForeground} />}
          >
            {t('hallOfFame.lists.create', 'Create')}
          </AnimatedButton>
        </Animated.View>

        {lists.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title={t('hallOfFame.lists.empty', 'No lists yet')}
            description={t('hallOfFame.lists.emptyDesc', 'Create the first list!')}
            action={{ label: t('hallOfFame.lists.create', 'Create'), onPress: openCreateList }}
          />
        ) : (
          <FlashList
            data={lists}
            renderItem={renderListCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  // =======================================================================
  //  TAB 4: Verified
  // =======================================================================

  const renderVerifiedStats = () => {
    const stats = verifiedData?.stats;
    if (!stats) return null;

    return (
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[S.verifiedStatsRow, { borderBottomColor: c.border }]}
      >
        <View style={S.vStatItem}>
          <Text style={[S.vStatValue, { color: c.primary }]}>{stats.totalVerified}</Text>
          <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
            {t('hallOfFame.verified.stats.total', 'Verified')}
          </Text>
        </View>
        <View style={[S.vStatDivider, { backgroundColor: c.border }]} />
        <View style={S.vStatItem}>
          <Text style={[S.vStatValue, { color: c.success }]}>{stats.admittedCount}</Text>
          <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
            {t('hallOfFame.verified.stats.admitted', 'Admitted')}
          </Text>
        </View>
        <View style={[S.vStatDivider, { backgroundColor: c.border }]} />
        <View style={S.vStatItem}>
          <Text style={[S.vStatValue, { color: c.info }]}>{stats.avgGpa.toFixed(2)}</Text>
          <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
            {t('hallOfFame.verified.stats.avgGpa', 'Avg GPA')}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderVerifiedUserCard = ({ item, index }: { item: VerifiedUserDto; index: number }) => {
    const isTop3 = item.rank <= 3;
    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    const medalColor = isTop3 ? medalColors[item.rank - 1] : undefined;
    const resultVariant = RESULT_BADGE_VARIANT[item.result] || ('secondary' as const);

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
        <AnimatedCard style={S.verifiedCard}>
          <CardContent>
            <View style={S.verifiedRow}>
              {/* Rank */}
              <View style={[S.verifiedRank, isTop3 && { backgroundColor: medalColor + '20' }]}>
                {isTop3 ? (
                  <Ionicons name="trophy" size={18} color={medalColor} />
                ) : (
                  <Text style={[S.verifiedRankText, { color: c.foregroundMuted }]}>
                    {item.rank}
                  </Text>
                )}
              </View>

              {/* User info */}
              <Avatar source={item.avatarUrl} name={item.nickname} size="default" />
              <View style={S.verifiedInfo}>
                <View style={S.verifiedNameRow}>
                  <Text style={[S.verifiedName, { color: c.foreground }]} numberOfLines={1}>
                    {item.nickname}
                  </Text>
                  <Ionicons name="checkmark-circle" size={16} color={c.success} />
                </View>
                <Text style={[S.verifiedSchool, { color: c.foregroundMuted }]} numberOfLines={1}>
                  {item.schoolNameZh || item.school}
                  {item.major ? ` - ${item.major}` : ''}
                </Text>
                <View style={S.verifiedBadges}>
                  <Badge variant={resultVariant}>{item.result}</Badge>
                  {item.gpa != null && (
                    <View style={[S.gpaBadge, { backgroundColor: c.info + '15' }]}>
                      <Text style={[S.gpaBadgeText, { color: c.info }]}>GPA {item.gpa}</Text>
                    </View>
                  )}
                  {item.sat != null && (
                    <View style={[S.gpaBadge, { backgroundColor: c.warning + '15' }]}>
                      <Text style={[S.gpaBadgeText, { color: c.warning }]}>SAT {item.sat}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Points */}
              <View style={S.pointsBox}>
                <Text style={[S.pointsValue, { color: c.primary }]}>{item.pointsTotal}</Text>
                <Text style={[S.pointsLabel, { color: c.foregroundMuted }]}>
                  {t('hallOfFame.verified.points', 'pts')}
                </Text>
              </View>
            </View>
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  const renderVerifiedTab = () => {
    if (verifiedLoading) return <Loading text={t('hallOfFame.loading', 'Loading...')} />;

    const users = verifiedData?.items || [];

    return (
      <View style={{ flex: 1 }}>
        {/* Stats summary */}
        {renderVerifiedStats()}

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={S.filterScroll}
          contentContainerStyle={S.filterScrollContent}
        >
          {RANKING_FILTERS.map((filter) => {
            const active = verifiedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setVerifiedFilter(filter)}
                style={[S.filterChip, { backgroundColor: active ? c.primary : c.muted }]}
              >
                <Text
                  style={[S.filterChipText, { color: active ? c.primaryForeground : c.foreground }]}
                >
                  {filterLabel(filter)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {users.length === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title={t('hallOfFame.verified.empty', 'No verified users')}
          />
        ) : (
          <FlashList
            data={users}
            renderItem={renderVerifiedUserCard}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  // =======================================================================
  //  Modals
  // =======================================================================

  const renderWriteReviewModal = () => (
    <Modal
      visible={writeReviewVisible}
      onClose={closeWriteReview}
      title={t('hallOfFame.reviews.writeReview', 'Write a Review')}
      footer={
        <View style={S.modalFooter}>
          <AnimatedButton variant="outline" onPress={closeWriteReview}>
            {t('hallOfFame.cancel', 'Cancel')}
          </AnimatedButton>
          <AnimatedButton onPress={submitReview} loading={createReviewMutation.isPending}>
            {t('hallOfFame.reviews.submit', 'Submit')}
          </AnimatedButton>
        </View>
      }
    >
      <View style={S.modalBody}>
        {/* Target user ID input */}
        <View style={S.inputGroup}>
          <Text style={[S.inputLabel, { color: c.foreground }]}>
            {t('hallOfFame.reviews.targetUser', 'User ID to Review')}
          </Text>
          <TextInput
            style={[
              S.textInput,
              { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
            ]}
            value={reviewTargetId}
            onChangeText={setReviewTargetId}
            placeholder={t('hallOfFame.reviews.targetPlaceholder', 'Enter user ID...')}
            placeholderTextColor={c.placeholder}
          />
        </View>

        {/* Score sliders */}
        {SCORE_LABELS.map((key) => (
          <Slider
            key={key}
            label={scoreLabel(key)}
            value={reviewScores[`${key}Score` as keyof typeof reviewScores]}
            onValueChange={(val) =>
              setReviewScores((prev) => ({ ...prev, [`${key}Score`]: Math.round(val) }))
            }
            minimumValue={1}
            maximumValue={10}
            step={1}
          />
        ))}

        {/* Comment */}
        <View style={S.inputGroup}>
          <Text style={[S.inputLabel, { color: c.foreground }]}>
            {t('hallOfFame.reviews.comment', 'Comment')}
          </Text>
          <TextInput
            style={[
              S.textInput,
              S.textArea,
              { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
            ]}
            value={reviewComment}
            onChangeText={setReviewComment}
            placeholder={t('hallOfFame.reviews.commentPlaceholder', 'Share your thoughts...')}
            placeholderTextColor={c.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Tags */}
        <View style={S.inputGroup}>
          <Text style={[S.inputLabel, { color: c.foreground }]}>
            {t('hallOfFame.reviews.tags', 'Tags (comma-separated)')}
          </Text>
          <TextInput
            style={[
              S.textInput,
              { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
            ]}
            value={reviewTags}
            onChangeText={setReviewTags}
            placeholder={t('hallOfFame.reviews.tagsPlaceholder', 'e.g. strong-essays, competitive')}
            placeholderTextColor={c.placeholder}
          />
        </View>
      </View>
    </Modal>
  );

  const renderCreateListModal = () => (
    <Modal
      visible={createListVisible}
      onClose={closeCreateList}
      title={t('hallOfFame.lists.createTitle', 'Create a List')}
      footer={
        <View style={S.modalFooter}>
          <AnimatedButton variant="outline" onPress={closeCreateList}>
            {t('hallOfFame.cancel', 'Cancel')}
          </AnimatedButton>
          <AnimatedButton onPress={submitList} loading={createListMutation.isPending}>
            {t('hallOfFame.lists.submit', 'Create')}
          </AnimatedButton>
        </View>
      }
    >
      <View style={S.modalBody}>
        {/* Title */}
        <View style={S.inputGroup}>
          <Text style={[S.inputLabel, { color: c.foreground }]}>
            {t('hallOfFame.lists.titleLabel', 'Title')}
          </Text>
          <TextInput
            style={[
              S.textInput,
              { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
            ]}
            value={newListTitle}
            onChangeText={setNewListTitle}
            placeholder={t('hallOfFame.lists.titlePlaceholder', 'e.g. Top CS Programs')}
            placeholderTextColor={c.placeholder}
          />
        </View>

        {/* Description */}
        <View style={S.inputGroup}>
          <Text style={[S.inputLabel, { color: c.foreground }]}>
            {t('hallOfFame.lists.descLabel', 'Description')}
          </Text>
          <TextInput
            style={[
              S.textInput,
              S.textAreaSmall,
              { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
            ]}
            value={newListDesc}
            onChangeText={setNewListDesc}
            placeholder={t('hallOfFame.lists.descPlaceholder', 'Optional description...')}
            placeholderTextColor={c.placeholder}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Category pills */}
        <View style={S.inputGroup}>
          <Text style={[S.inputLabel, { color: c.foreground }]}>
            {t('hallOfFame.lists.categoryLabel', 'Category')}
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

        {/* Items */}
        <View style={S.inputGroup}>
          <Text style={[S.inputLabel, { color: c.foreground }]}>
            {t('hallOfFame.lists.itemsLabel', 'Items (one per line)')}
          </Text>
          <TextInput
            style={[
              S.textInput,
              S.textArea,
              { color: c.foreground, backgroundColor: c.input, borderColor: c.inputBorder },
            ]}
            value={newListItems}
            onChangeText={setNewListItems}
            placeholder={t('hallOfFame.lists.itemsPlaceholder', 'MIT\nStanford\nCMU\n...')}
            placeholderTextColor={c.placeholder}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>
      </View>
    </Modal>
  );

  const renderListDetailModal = () => (
    <Modal
      visible={listDetailVisible}
      onClose={closeListDetail}
      title={listDetail?.title || t('hallOfFame.lists.detail', 'List Detail')}
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
                <Text style={[S.listDetailValue, { color: c.foregroundMuted }]}>{entry.value}</Text>
              ) : null}
            </Animated.View>
          ))}
        </View>
      )}
    </Modal>
  );

  // =======================================================================
  //  Main Render
  // =======================================================================

  return (
    <>
      <Stack.Screen options={{ title: t('hallOfFame.title', 'Hall of Fame') }} />

      <View style={[S.container, { backgroundColor: c.background }]}>
        {/* Tab selector */}
        <View style={S.segmentWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Segment
              segments={segments}
              value={activeTab}
              onChange={(key) => setActiveTab(key as TabKey)}
            />
          </ScrollView>
        </View>

        {/* Tab content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[S.content, { paddingBottom: insets.bottom + spacing['3xl'] }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {activeTab === 'reviews' && renderReviewsTab()}
          {activeTab === 'ranking' && renderRankingTab()}
          {activeTab === 'lists' && renderListsTab()}
          {activeTab === 'verified' && renderVerifiedTab()}
        </ScrollView>
      </View>

      {/* Modals */}
      {renderWriteReviewModal()}
      {renderCreateListModal()}
      {renderListDetailModal()}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },

  // ── Reviews ─────────────────────────────────────────────
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  reviewCard: {
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  reviewDate: {
    fontSize: fontSize.xs,
  },
  avgBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avgBadgeText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  reviewForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  reviewForText: {
    fontSize: fontSize.xs,
  },
  scoreBarsContainer: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  scoreBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreBarLabel: {
    width: 60,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  scoreBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreBarValue: {
    width: 24,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: 'right',
  },
  reviewComment: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  tagChipText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  reactionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // ── Ranking ─────────────────────────────────────────────
  rankingCard: {
    marginBottom: spacing.md,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rankingSchoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  rankingApplicants: {
    fontSize: fontSize.xs,
  },
  percentileBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  percentileText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  rankScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rankBox: {
    flex: 1,
    alignItems: 'center',
  },
  rankLabel: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  rankValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  rankDivider: {
    width: 1,
    height: 32,
  },
  positionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  breakdownContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: spacing.md,
  },
  breakdownTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },

  // ── Lists ───────────────────────────────────────────────
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
  listCard: {
    marginBottom: spacing.md,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  listTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  listDesc: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  listCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listCreator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  listCreatorName: {
    fontSize: fontSize.xs,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listMetaText: {
    fontSize: fontSize.xs,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  voteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  voteCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    minWidth: 20,
    textAlign: 'center',
  },

  // ── Verified ────────────────────────────────────────────
  verifiedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  vStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  vStatValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  vStatLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  vStatDivider: {
    width: 1,
    height: 32,
  },
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterScrollContent: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  filterChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  verifiedCard: {
    marginBottom: spacing.sm,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  verifiedRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedRankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  verifiedInfo: {
    flex: 1,
  },
  verifiedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  verifiedName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  verifiedSchool: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  verifiedBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  gpaBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  gpaBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  pointsBox: {
    alignItems: 'center',
    minWidth: 44,
  },
  pointsValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  pointsLabel: {
    fontSize: 10,
  },

  // ── Modals ──────────────────────────────────────────────
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
