/**
 * Forum Post Detail Page - View post content, comments, likes, team info, and reporting.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
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
  AnimatedButton,
  ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';

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

interface CommentDto {
  id: string;
  postId: string;
  author: PostAuthor;
  content: string;
  parentId: string | null;
  children?: CommentDto[];
  createdAt: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

export default function ForumPostDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isZh = i18n.language?.startsWith('zh');

  // State
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Queries ----

  const {
    data: post,
    isLoading: postLoading,
    refetch: refetchPost,
  } = useQuery<PostDto>({
    queryKey: ['forum', 'post', id],
    queryFn: () => apiClient.get<PostDto>(`/forum/posts/${id}`),
    enabled: !!id,
  });

  const {
    data: comments,
    isLoading: commentsLoading,
    refetch: refetchComments,
  } = useQuery<CommentDto[]>({
    queryKey: ['forum', 'comments', id],
    queryFn: () => apiClient.get<CommentDto[]>(`/forum/posts/${id}/comments`),
    enabled: !!id,
  });

  // ---- Mutations ----

  const likeMutation = useMutation<{ liked: boolean; likeCount: number }, Error, void>({
    mutationFn: () => apiClient.post(`/forum/posts/${id}/like`),
    onSuccess: (data) => {
      queryClient.setQueryData(['forum', 'post', id], (prev: PostDto | undefined) => {
        if (!prev) return prev;
        return { ...prev, isLiked: data.liked, likeCount: data.likeCount };
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (err) => toast.error(err.message),
  });

  const commentMutation = useMutation<CommentDto, Error, { content: string; parentId?: string }>({
    mutationFn: (dto) => apiClient.post<CommentDto>(`/forum/posts/${id}/comments`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'comments', id] });
      queryClient.invalidateQueries({ queryKey: ['forum', 'post', id] });
      setCommentText('');
      setReplyTo(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => toast.error(err.message),
  });

  const applyMutation = useMutation<void, Error, void>({
    mutationFn: () => apiClient.post(`/forum/posts/${id}/apply`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'post', id] });
      toast.success(t('forum.applied'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => toast.error(err.message),
  });

  const reportMutation = useMutation<void, Error, void>({
    mutationFn: () => apiClient.post(`/forum/posts/${id}/report`),
    onSuccess: () => {
      toast.success(t('forum.reported'));
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation<void, Error, void>({
    mutationFn: () => apiClient.delete(`/forum/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum'] });
      toast.success(t('forum.postDeleted'));
      router.back();
    },
    onError: (err) => toast.error(err.message),
  });

  // ---- Handlers ----

  const handleComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    commentMutation.mutate({
      content: trimmed,
      parentId: replyTo?.id,
    });
  };

  const handleReport = () => {
    Alert.alert(t('forum.reportTitle'), t('forum.reportMessage'), [
      { text: t('forum.cancel'), style: 'cancel' },
      {
        text: t('forum.confirm'),
        style: 'destructive',
        onPress: () => reportMutation.mutate(),
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPost(), refetchComments()]);
    setRefreshing(false);
  }, [refetchPost, refetchComments]);

  const isOwnPost = post?.author.id === user?.id;

  const categoryLabel = useCallback(
    (cat: CategoryDto) => (isZh ? cat.nameZh || cat.name : cat.name),
    [isZh]
  );

  // ---- Build nested comments ----

  const nestedComments = useMemo(() => {
    if (!comments) return [];
    const map = new Map<string, CommentDto & { children: CommentDto[] }>();
    const roots: (CommentDto & { children: CommentDto[] })[] = [];

    // First pass: create entries
    for (const c of comments) {
      map.set(c.id, { ...c, children: [] });
    }
    // Second pass: build tree
    for (const c of comments) {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }, [comments]);

  // ---- Sub-Renders ----

  const renderAuthorAvatar = (author: PostAuthor, size: number = 32) => {
    const name = author.profile?.nickname || author.email.split('@')[0];
    return (
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c.primary + '20',
          },
        ]}
      >
        <Text style={[styles.avatarText, { color: c.primary, fontSize: size * 0.4 }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  // Post header with author info
  const renderPostHeader = () => {
    if (!post) return null;
    const authorName = post.author.profile?.nickname || post.author.email.split('@')[0];

    return (
      <Animated.View entering={FadeInDown.duration(400)}>
        {/* Author row */}
        <View style={styles.postAuthorRow}>
          {renderAuthorAvatar(post.author, 40)}
          <View style={styles.authorInfo}>
            <Text style={[styles.authorNameLg, { color: c.foreground }]}>{authorName}</Text>
            <Text style={[styles.postDate, { color: c.foregroundMuted }]}>
              {fmtDate(post.createdAt)}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.headerActions}>
            {isOwnPost && (
              <TouchableOpacity
                onPress={() => setDeleteDialogVisible(true)}
                style={styles.headerActionBtn}
              >
                <Ionicons name="trash-outline" size={20} color={c.error} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleReport} style={styles.headerActionBtn}>
              <Ionicons name="flag-outline" size={20} color={c.foregroundMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category + tags */}
        <View style={styles.metaRow}>
          {post.category && (
            <Badge
              variant="secondary"
              style={
                post.category.color ? { backgroundColor: post.category.color + '20' } : undefined
              }
            >
              {post.category.icon ? `${post.category.icon} ` : ''}
              {categoryLabel(post.category)}
            </Badge>
          )}
          {post.isPinned && (
            <Badge variant="warning">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="pin" size={10} color={c.warning} />
                <Text style={{ color: c.warning, fontSize: fontSize.xs }}>{t('forum.pinned')}</Text>
              </View>
            </Badge>
          )}
          {post.isLocked && (
            <Badge variant="secondary">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="lock-closed" size={10} color={c.foregroundMuted} />
                <Text style={{ color: c.foregroundMuted, fontSize: fontSize.xs }}>
                  {t('forum.locked')}
                </Text>
              </View>
            </Badge>
          )}
          {post.tags.map((tag) => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: c.muted }]}>
              <Text style={[styles.tagText, { color: c.foregroundMuted }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  // Post content
  const renderPostContent = () => {
    if (!post) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Text style={[styles.postTitleLg, { color: c.foreground }]}>{post.title}</Text>
        <Text style={[styles.postContentText, { color: c.foreground }]}>{post.content}</Text>
      </Animated.View>
    );
  };

  // Like + stats row
  const renderStatsBar = () => {
    if (!post) return null;
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <View style={[styles.statsBar, { borderColor: c.border }]}>
          <TouchableOpacity
            onPress={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
            style={styles.likeButton}
          >
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={post.isLiked ? c.error : c.foregroundMuted}
            />
            <Text style={[styles.likeCount, { color: post.isLiked ? c.error : c.foregroundMuted }]}>
              {post.likeCount}
            </Text>
          </TouchableOpacity>

          <View style={styles.statsBarRight}>
            <View style={styles.statIconRow}>
              <Ionicons name="chatbubble-outline" size={18} color={c.foregroundMuted} />
              <Text style={[styles.statBarText, { color: c.foregroundMuted }]}>
                {post.commentCount}
              </Text>
            </View>
            <View style={styles.statIconRow}>
              <Ionicons name="eye-outline" size={18} color={c.foregroundMuted} />
              <Text style={[styles.statBarText, { color: c.foregroundMuted }]}>
                {post.viewCount}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Team post info section
  const renderTeamSection = () => {
    if (!post?.isTeamPost) return null;
    const progress = post.teamSize
      ? Math.round(((post.currentSize ?? 0) / post.teamSize) * 100)
      : 0;

    return (
      <Animated.View entering={FadeInDown.delay(250).duration(400)}>
        <AnimatedCard style={styles.teamCard}>
          <CardContent>
            <View style={styles.teamHeader}>
              <Ionicons name="people" size={20} color={c.primary} />
              <Text style={[styles.teamTitle, { color: c.foreground }]}>{t('forum.teamInfo')}</Text>
              {post.teamStatus === 'OPEN' && <Badge variant="success">{t('forum.teamOpen')}</Badge>}
              {post.teamStatus === 'CLOSED' && (
                <Badge variant="error">{t('forum.teamClosed')}</Badge>
              )}
            </View>

            {/* Members progress */}
            {post.teamSize && (
              <View style={styles.teamProgress}>
                <View style={styles.teamProgressLabels}>
                  <Text style={[styles.teamProgressText, { color: c.foregroundSecondary }]}>
                    {t('forum.teamMembers')}
                  </Text>
                  <Text style={[styles.teamProgressValue, { color: c.foreground }]}>
                    {post.currentSize ?? 0} / {post.teamSize}
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: c.muted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: c.primary,
                        width: `${Math.min(progress, 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Deadline */}
            {post.teamDeadline && (
              <View style={styles.teamRow}>
                <Ionicons name="calendar-outline" size={16} color={c.foregroundMuted} />
                <Text style={[styles.teamRowText, { color: c.foregroundSecondary }]}>
                  {t('forum.teamDeadline')}: {fmtDate(post.teamDeadline)}
                </Text>
              </View>
            )}

            {/* Requirements */}
            {post.requirements && (
              <View style={styles.requirementsSection}>
                <Text style={[styles.requirementsLabel, { color: c.foregroundMuted }]}>
                  {t('forum.requirements')}
                </Text>
                <Text style={[styles.requirementsText, { color: c.foreground }]}>
                  {post.requirements}
                </Text>
              </View>
            )}

            {/* Apply button */}
            {post.teamStatus === 'OPEN' && !isOwnPost && (
              <AnimatedButton
                onPress={() => applyMutation.mutate()}
                loading={applyMutation.isPending}
                disabled={applyMutation.isPending}
                style={styles.applyButton}
                leftIcon={
                  <Ionicons name="hand-left-outline" size={18} color={c.primaryForeground} />
                }
              >
                {t('forum.applyToJoin')}
              </AnimatedButton>
            )}
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  // Single comment component
  const renderComment = (comment: CommentDto & { children?: CommentDto[] }, depth: number = 0) => {
    const authorName = comment.author.profile?.nickname || comment.author.email.split('@')[0];
    const isNested = depth > 0;

    return (
      <View key={comment.id} style={[styles.commentItem, isNested && styles.nestedComment]}>
        <View style={styles.commentRow}>
          {renderAuthorAvatar(comment.author, 28)}
          <View style={styles.commentBody}>
            <View style={styles.commentMeta}>
              <Text style={[styles.commentAuthor, { color: c.foreground }]}>{authorName}</Text>
              <Text style={[styles.commentTime, { color: c.foregroundMuted }]}>
                {timeAgo(comment.createdAt)}
              </Text>
            </View>
            <Text style={[styles.commentContent, { color: c.foreground }]}>{comment.content}</Text>
            {!post?.isLocked && (
              <TouchableOpacity
                onPress={() => {
                  setReplyTo({ id: comment.id, authorName });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.replyBtn}
              >
                <Ionicons name="arrow-undo-outline" size={14} color={c.primary} />
                <Text style={[styles.replyBtnText, { color: c.primary }]}>{t('forum.reply')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Nested replies */}
        {comment.children && comment.children.length > 0 && (
          <View style={[styles.repliesContainer, { borderLeftColor: c.border }]}>
            {comment.children.map((child) => renderComment(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  // Comments section
  const renderComments = () => {
    return (
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <View style={styles.commentsHeader}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>
            {t('forum.comments')} ({post?.commentCount ?? 0})
          </Text>
        </View>

        {commentsLoading ? (
          <Loading size="small" />
        ) : !nestedComments.length ? (
          <View style={styles.noCommentsContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={c.foregroundMuted} />
            <Text style={[styles.noCommentsText, { color: c.foregroundMuted }]}>
              {t('forum.noComments')}
            </Text>
          </View>
        ) : (
          nestedComments.map((comment) => renderComment(comment))
        )}
      </Animated.View>
    );
  };

  // Comment input bar
  const renderCommentInput = () => {
    if (post?.isLocked) {
      return (
        <View
          style={[
            styles.commentInputBar,
            {
              backgroundColor: c.card,
              borderTopColor: c.border,
              paddingBottom: insets.bottom || spacing.md,
            },
          ]}
        >
          <View style={styles.lockedRow}>
            <Ionicons name="lock-closed-outline" size={16} color={c.foregroundMuted} />
            <Text style={[styles.lockedText, { color: c.foregroundMuted }]}>
              {t('forum.postLocked')}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.commentInputBar,
          {
            backgroundColor: c.card,
            borderTopColor: c.border,
            paddingBottom: insets.bottom || spacing.md,
          },
        ]}
      >
        {/* Reply indicator */}
        {replyTo && (
          <View style={[styles.replyIndicator, { backgroundColor: c.primary + '10' }]}>
            <Text style={[styles.replyIndicatorText, { color: c.primary }]}>
              {t('forum.replyingTo', { name: replyTo.authorName })}
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close-circle" size={18} color={c.primary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.commentInputRow}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder={replyTo ? t('forum.replyPlaceholder') : t('forum.commentPlaceholder')}
            placeholderTextColor={c.placeholder}
            style={[
              styles.commentInput,
              {
                backgroundColor: c.input,
                color: c.foreground,
                borderColor: c.inputBorder,
              },
            ]}
            multiline
            maxLength={500}
          />
          <AnimatedButton
            size="icon"
            onPress={handleComment}
            disabled={!commentText.trim() || commentMutation.isPending}
            loading={commentMutation.isPending}
            style={styles.sendButton}
          >
            <Ionicons name="send" size={20} color={c.primaryForeground} />
          </AnimatedButton>
        </View>
      </View>
    );
  };

  // ---- Loading / Error States ----

  if (postLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <Loading text={t('forum.loading')} fullScreen />
      </>
    );
  }

  if (!post) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('forum.postNotFound')}
          action={{ label: t('forum.goBack'), onPress: () => router.back() }}
        />
      </>
    );
  }

  // ---- Main Render ----

  return (
    <>
      <Stack.Screen
        options={{
          title: post.title.length > 30 ? post.title.slice(0, 30) + '...' : post.title,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: c.background }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing['3xl'] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {renderPostHeader()}
          {renderPostContent()}
          {renderStatsBar()}
          {renderTeamSection()}
          {renderComments()}
        </ScrollView>

        {renderCommentInput()}
      </KeyboardAvoidingView>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={deleteDialogVisible}
        onClose={() => setDeleteDialogVisible(false)}
        onConfirm={() => {
          setDeleteDialogVisible(false);
          deleteMutation.mutate();
        }}
        title={t('forum.deletePostTitle')}
        message={t('forum.deletePostMessage')}
        variant="destructive"
        loading={deleteMutation.isPending}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Author header
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: fontWeight.semibold,
  },
  authorInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  authorNameLg: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  postDate: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerActionBtn: {
    padding: spacing.sm,
  },

  // Meta row (category, tags)
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: fontSize.xs,
  },

  // Post content
  postTitleLg: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.xl * 1.4,
    marginBottom: spacing.lg,
  },
  postContentText: {
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.75,
    marginBottom: spacing.lg,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: spacing.lg,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  likeCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  statsBarRight: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statBarText: {
    fontSize: fontSize.sm,
  },

  // Team section
  teamCard: {
    marginBottom: spacing.lg,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  teamTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  teamProgress: {
    marginBottom: spacing.md,
  },
  teamProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  teamProgressText: {
    fontSize: fontSize.sm,
  },
  teamProgressValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  teamRowText: {
    fontSize: fontSize.sm,
  },
  requirementsSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  requirementsLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  requirementsText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
  },
  applyButton: {
    marginTop: spacing.sm,
  },

  // Comments
  commentsHeader: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  noCommentsContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  noCommentsText: {
    fontSize: fontSize.sm,
  },
  commentItem: {
    marginBottom: spacing.lg,
  },
  nestedComment: {
    marginBottom: spacing.md,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  commentAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  commentTime: {
    fontSize: fontSize.xs,
  },
  commentContent: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  replyBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  repliesContainer: {
    marginLeft: spacing.xl + spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 2,
    paddingLeft: spacing.md,
  },

  // Comment input bar
  commentInputBar: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  replyIndicatorText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    maxHeight: 100,
  },
  sendButton: {
    marginBottom: 2,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  lockedText: {
    fontSize: fontSize.sm,
  },
});
