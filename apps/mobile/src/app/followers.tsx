/**
 * Followers / Following / Blocked page
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  AnimatedButton,
  AnimatedCard,
  Avatar,
  Badge,
  EmptyState,
  Loading,
  Segment,
  SearchBar,
  ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';

// ==================== Types ====================

interface UserProfile {
  nickname?: string;
  avatarUrl?: string;
  grade?: string;
  targetMajor?: string;
}

interface UserWithProfile {
  id: string;
  email: string;
  profile?: UserProfile;
}

interface Conversation {
  id: string;
}

type TabKey = 'followers' | 'following' | 'blocked';

// ==================== Main Component ====================

export default function FollowersPage() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('followers');
  const [searchText, setSearchText] = useState('');
  const [recommendationsCollapsed, setRecommendationsCollapsed] = useState(false);
  const [blockTarget, setBlockTarget] = useState<UserWithProfile | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<UserWithProfile | null>(null);

  // ==================== Queries ====================

  const {
    data: followers,
    isLoading: followersLoading,
    refetch: refetchFollowers,
  } = useQuery({
    queryKey: ['chat', 'followers'],
    queryFn: () => apiClient.get<UserWithProfile[]>('/chat/followers'),
  });

  const {
    data: following,
    isLoading: followingLoading,
    refetch: refetchFollowing,
  } = useQuery({
    queryKey: ['chat', 'following'],
    queryFn: () => apiClient.get<UserWithProfile[]>('/chat/following'),
  });

  const {
    data: blocked,
    isLoading: blockedLoading,
    refetch: refetchBlocked,
  } = useQuery({
    queryKey: ['chat', 'blocked'],
    queryFn: () => apiClient.get<UserWithProfile[]>('/chat/blocked'),
  });

  const { data: recommendations } = useQuery({
    queryKey: ['chat', 'recommendations'],
    queryFn: () =>
      apiClient.get<UserWithProfile[]>('/chat/recommendations', { params: { limit: 5 } }),
  });

  // ==================== Mutations ====================

  const followMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chat/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'following'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'followers'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'recommendations'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('followers.toast.followed') });
    },
    onError: () => {
      toast.show({ type: 'error', message: t('followers.toast.followFailed') });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chat/follow/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'following'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'followers'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('followers.toast.unfollowed') });
    },
    onError: () => {
      toast.show({ type: 'error', message: t('followers.toast.unfollowFailed') });
    },
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chat/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'blocked'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'followers'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'following'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('followers.toast.blocked') });
      setBlockTarget(null);
    },
    onError: () => {
      toast.show({ type: 'error', message: t('followers.toast.blockFailed') });
      setBlockTarget(null);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/chat/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'blocked'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ type: 'success', message: t('followers.toast.unblocked') });
      setUnblockTarget(null);
    },
    onError: () => {
      toast.show({ type: 'error', message: t('followers.toast.unblockFailed') });
      setUnblockTarget(null);
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post<Conversation>('/chat/conversations', { userId }),
    onSuccess: (data) => {
      router.push(`/chat/${data.id}`);
    },
    onError: () => {
      toast.show({ type: 'error', message: t('followers.toast.chatFailed') });
    },
  });

  // ==================== Helpers ====================

  const followingIds = useMemo(() => new Set(following?.map((u) => u.id) ?? []), [following]);

  const isFollowing = useCallback((userId: string) => followingIds.has(userId), [followingIds]);

  const getDisplayName = (user: UserWithProfile): string =>
    user.profile?.nickname || user.email.split('@')[0];

  const getSubtitle = (user: UserWithProfile): string => {
    const parts: string[] = [];
    if (user.profile?.grade) parts.push(user.profile.grade);
    if (user.profile?.targetMajor) parts.push(user.profile.targetMajor);
    return parts.length > 0 ? parts.join(' · ') : user.email;
  };

  const filterUsers = useCallback(
    (users: UserWithProfile[] | undefined) => {
      if (!users) return [];
      if (!searchText.trim()) return users;
      const query = searchText.toLowerCase();
      return users.filter(
        (u) =>
          getDisplayName(u).toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.profile?.targetMajor?.toLowerCase().includes(query)
      );
    },
    [searchText]
  );

  const handleUserPress = (user: UserWithProfile) => {
    startConversationMutation.mutate(user.id);
  };

  // ==================== Refresh ====================

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const refetchMap: Record<TabKey, () => Promise<unknown>> = {
      followers: refetchFollowers,
      following: refetchFollowing,
      blocked: refetchBlocked,
    };
    await refetchMap[activeTab]();
    setRefreshing(false);
  }, [activeTab, refetchFollowers, refetchFollowing, refetchBlocked]);

  // ==================== Data ====================

  const currentData = useMemo(() => {
    const dataMap: Record<TabKey, UserWithProfile[] | undefined> = {
      followers,
      following,
      blocked,
    };
    return filterUsers(dataMap[activeTab]);
  }, [activeTab, followers, following, blocked, filterUsers]);

  const isLoading =
    (activeTab === 'followers' && followersLoading) ||
    (activeTab === 'following' && followingLoading) ||
    (activeTab === 'blocked' && blockedLoading);

  const counts = {
    followers: followers?.length ?? 0,
    following: following?.length ?? 0,
    blocked: blocked?.length ?? 0,
  };

  // ==================== Segments ====================

  const segments = useMemo(
    () => [
      {
        key: 'followers',
        label: `${t('followers.tabs.followers')} (${counts.followers})`,
      },
      {
        key: 'following',
        label: `${t('followers.tabs.following')} (${counts.following})`,
      },
      {
        key: 'blocked',
        label: `${t('followers.tabs.blocked')} (${counts.blocked})`,
      },
    ],
    [t, counts.followers, counts.following, counts.blocked]
  );

  // ==================== Empty State Config ====================

  const emptyConfig: Record<
    TabKey,
    { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }
  > = {
    followers: {
      icon: 'people-outline',
      title: t('followers.empty.followers.title'),
      description: t('followers.empty.followers.description'),
    },
    following: {
      icon: 'person-add-outline',
      title: t('followers.empty.following.title'),
      description: t('followers.empty.following.description'),
    },
    blocked: {
      icon: 'shield-checkmark-outline',
      title: t('followers.empty.blocked.title'),
      description: t('followers.empty.blocked.description'),
    },
  };

  // ==================== Render Helpers ====================

  const renderRecommendations = () => {
    if (!recommendations || recommendations.length === 0) return null;

    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.recommendationsSection}>
        <TouchableOpacity
          onPress={() => setRecommendationsCollapsed((prev) => !prev)}
          activeOpacity={0.7}
          style={styles.recommendationsHeader}
        >
          <View style={styles.recommendationsHeaderLeft}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={[styles.recommendationsTitle, { color: colors.foreground }]}>
              {t('followers.recommendations.title')}
            </Text>
          </View>
          <Ionicons
            name={recommendationsCollapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={colors.foregroundMuted}
          />
        </TouchableOpacity>

        {!recommendationsCollapsed && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <FlatList
              data={recommendations}
              keyExtractor={(item) => `rec-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendationsList}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
                  <RecommendationCard
                    user={item}
                    colors={colors}
                    isFollowing={isFollowing(item.id)}
                    onFollow={() => followMutation.mutate(item.id)}
                    onUnfollow={() => unfollowMutation.mutate(item.id)}
                    onPress={() => handleUserPress(item)}
                    getDisplayName={getDisplayName}
                    getSubtitle={getSubtitle}
                    t={t}
                    followLoading={followMutation.isPending}
                    unfollowLoading={unfollowMutation.isPending}
                  />
                </Animated.View>
              )}
            />
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  const renderUserCard = ({ item, index }: { item: UserWithProfile; index: number }) => {
    if (activeTab === 'blocked') {
      return (
        <Animated.View entering={FadeInUp.delay(index * 60).duration(300)}>
          <BlockedUserCard
            user={item}
            colors={colors}
            onUnblock={() => setUnblockTarget(item)}
            getDisplayName={getDisplayName}
            getSubtitle={getSubtitle}
            t={t}
            loading={unblockMutation.isPending}
          />
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInUp.delay(index * 60).duration(300)}>
        <UserCard
          user={item}
          colors={colors}
          isFollowing={isFollowing(item.id)}
          showFollowStatus={activeTab === 'followers'}
          onFollow={() => followMutation.mutate(item.id)}
          onUnfollow={() => unfollowMutation.mutate(item.id)}
          onBlock={() => setBlockTarget(item)}
          onPress={() => handleUserPress(item)}
          getDisplayName={getDisplayName}
          getSubtitle={getSubtitle}
          t={t}
          followLoading={followMutation.isPending}
          unfollowLoading={unfollowMutation.isPending}
        />
      </Animated.View>
    );
  };

  // ==================== Render ====================

  return (
    <>
      <Stack.Screen options={{ title: t('followers.title') }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('followers.searchPlaceholder')}
          />
        </View>

        {/* Segment Tabs */}
        <View style={styles.segmentContainer}>
          <Segment
            segments={segments}
            value={activeTab}
            onChange={(key) => {
              setActiveTab(key as TabKey);
              setSearchText('');
            }}
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <Loading fullScreen />
        ) : (
          <FlashList
            data={currentData}
            keyExtractor={(item) => item.id}
            renderItem={renderUserCard}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + spacing.xl },
              currentData.length === 0 && styles.listContentEmpty,
            ]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={activeTab !== 'blocked' ? renderRecommendations : null}
            ListEmptyComponent={
              <EmptyState
                icon={emptyConfig[activeTab].icon}
                title={emptyConfig[activeTab].title}
                description={emptyConfig[activeTab].description}
              />
            }
          />
        )}

        {/* Block Confirmation */}
        <ConfirmDialog
          visible={!!blockTarget}
          onClose={() => setBlockTarget(null)}
          onConfirm={() => blockTarget && blockMutation.mutate(blockTarget.id)}
          title={t('followers.blockDialog.title')}
          message={t('followers.blockDialog.message', {
            name: blockTarget ? getDisplayName(blockTarget) : '',
          })}
          confirmText={t('followers.blockDialog.confirm')}
          variant="destructive"
          loading={blockMutation.isPending}
          icon="ban"
        />

        {/* Unblock Confirmation */}
        <ConfirmDialog
          visible={!!unblockTarget}
          onClose={() => setUnblockTarget(null)}
          onConfirm={() => unblockTarget && unblockMutation.mutate(unblockTarget.id)}
          title={t('followers.unblockDialog.title')}
          message={t('followers.unblockDialog.message', {
            name: unblockTarget ? getDisplayName(unblockTarget) : '',
          })}
          confirmText={t('followers.unblockDialog.confirm')}
          loading={unblockMutation.isPending}
        />
      </View>
    </>
  );
}

// ==================== Sub-components ====================

function RecommendationCard({
  user,
  colors,
  isFollowing: alreadyFollowing,
  onFollow,
  onUnfollow,
  onPress,
  getDisplayName,
  getSubtitle,
  t,
  followLoading,
  unfollowLoading,
}: {
  user: UserWithProfile;
  colors: ReturnType<typeof useColors>;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onPress: () => void;
  getDisplayName: (u: UserWithProfile) => string;
  getSubtitle: (u: UserWithProfile) => string;
  t: (key: string) => string;
  followLoading: boolean;
  unfollowLoading: boolean;
}) {
  return (
    <AnimatedCard
      style={[styles.recommendationCard, { borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.recommendationContent}>
        <Avatar source={user.profile?.avatarUrl} name={getDisplayName(user)} size="lg" />
        <Text style={[styles.recommendationName, { color: colors.foreground }]} numberOfLines={1}>
          {getDisplayName(user)}
        </Text>
        <Text
          style={[styles.recommendationSubtitle, { color: colors.foregroundMuted }]}
          numberOfLines={1}
        >
          {getSubtitle(user)}
        </Text>
        <AnimatedButton
          size="sm"
          variant={alreadyFollowing ? 'outline' : 'default'}
          onPress={alreadyFollowing ? onUnfollow : onFollow}
          loading={alreadyFollowing ? unfollowLoading : followLoading}
          style={styles.recommendationButton}
        >
          {alreadyFollowing ? t('followers.actions.unfollow') : t('followers.actions.follow')}
        </AnimatedButton>
      </View>
    </AnimatedCard>
  );
}

function UserCard({
  user,
  colors,
  isFollowing: alreadyFollowing,
  showFollowStatus,
  onFollow,
  onUnfollow,
  onBlock,
  onPress,
  getDisplayName,
  getSubtitle,
  t,
  followLoading,
  unfollowLoading,
}: {
  user: UserWithProfile;
  colors: ReturnType<typeof useColors>;
  isFollowing: boolean;
  showFollowStatus: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onBlock: () => void;
  onPress: () => void;
  getDisplayName: (u: UserWithProfile) => string;
  getSubtitle: (u: UserWithProfile) => string;
  t: (key: string) => string;
  followLoading: boolean;
  unfollowLoading: boolean;
}) {
  return (
    <AnimatedCard style={styles.userCard} onPress={onPress}>
      <View style={styles.userCardInner}>
        {/* Left: Avatar */}
        <Avatar source={user.profile?.avatarUrl} name={getDisplayName(user)} size="default" />

        {/* Middle: Info */}
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
              {getDisplayName(user)}
            </Text>
            {showFollowStatus && alreadyFollowing && (
              <Badge variant="success">{t('followers.badge.mutual')}</Badge>
            )}
          </View>
          <Text style={[styles.userSubtitle, { color: colors.foregroundMuted }]} numberOfLines={1}>
            {getSubtitle(user)}
          </Text>
        </View>

        {/* Right: Actions */}
        <View style={styles.userActions}>
          <AnimatedButton
            size="sm"
            variant={alreadyFollowing ? 'outline' : 'default'}
            onPress={alreadyFollowing ? onUnfollow : onFollow}
            loading={alreadyFollowing ? unfollowLoading : followLoading}
          >
            {alreadyFollowing ? t('followers.actions.unfollow') : t('followers.actions.follow')}
          </AnimatedButton>
          <TouchableOpacity
            onPress={onBlock}
            style={[styles.blockButton, { backgroundColor: colors.error + '10' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ban-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedCard>
  );
}

function BlockedUserCard({
  user,
  colors,
  onUnblock,
  getDisplayName,
  getSubtitle,
  t,
  loading,
}: {
  user: UserWithProfile;
  colors: ReturnType<typeof useColors>;
  onUnblock: () => void;
  getDisplayName: (u: UserWithProfile) => string;
  getSubtitle: (u: UserWithProfile) => string;
  t: (key: string) => string;
  loading: boolean;
}) {
  return (
    <AnimatedCard style={styles.userCard}>
      <View style={styles.userCardInner}>
        {/* Left: Avatar */}
        <View style={styles.blockedAvatarContainer}>
          <Avatar source={user.profile?.avatarUrl} name={getDisplayName(user)} size="default" />
          <View style={[styles.blockedOverlay, { backgroundColor: colors.error + '30' }]}>
            <Ionicons name="ban" size={16} color={colors.error} />
          </View>
        </View>

        {/* Middle: Info */}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foregroundMuted }]} numberOfLines={1}>
            {getDisplayName(user)}
          </Text>
          <Text style={[styles.userSubtitle, { color: colors.foregroundMuted }]} numberOfLines={1}>
            {getSubtitle(user)}
          </Text>
        </View>

        {/* Right: Unblock */}
        <AnimatedButton size="sm" variant="outline" onPress={onUnblock} loading={loading}>
          {t('followers.actions.unblock')}
        </AnimatedButton>
      </View>
    </AnimatedCard>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  segmentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  // Recommendations
  recommendationsSection: {
    marginBottom: spacing.lg,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  recommendationsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recommendationsTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  recommendationsList: {
    gap: spacing.md,
  },
  recommendationCard: {
    width: 140,
  },
  recommendationContent: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  recommendationName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    maxWidth: 120,
  },
  recommendationSubtitle: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    maxWidth: 120,
  },
  recommendationButton: {
    marginTop: spacing.xs,
    width: '100%',
  },

  // User card
  userCard: {
    marginBottom: spacing.md,
  },
  userCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  userInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    flexShrink: 1,
  },
  userSubtitle: {
    fontSize: fontSize.sm,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  blockButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Blocked avatar
  blockedAvatarContainer: {
    position: 'relative',
  },
  blockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
