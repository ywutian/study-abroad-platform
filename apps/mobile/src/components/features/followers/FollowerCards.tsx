import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedButton, AnimatedCard, Avatar, Badge } from '@/components/ui';
import { useColors, withOpacity } from '@/utils/theme';
import { styles } from '@/app/followers.styles';
import type { UserWithProfile } from '@/app/followers';
// ==================== Sub-components ====================

export const RecommendationCard = React.memo(function RecommendationCard({
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
      accessibilityLabel={`${t('chat.startChat')}: ${getDisplayName(user)}`}
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
});

export const UserCard = React.memo(function UserCard({
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
    <AnimatedCard
      style={styles.userCard}
      onPress={onPress}
      accessibilityLabel={`${t('chat.startChat')}: ${getDisplayName(user)}`}
    >
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
            style={[styles.blockButton, { backgroundColor: withOpacity(colors.error, 0.0625) }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('chat.block')}
          >
            <Ionicons name="ban-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedCard>
  );
});

export const BlockedUserCard = React.memo(function BlockedUserCard({
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
          <View
            style={[styles.blockedOverlay, { backgroundColor: withOpacity(colors.error, 0.19) }]}
          >
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
});

// ==================== Styles ====================
