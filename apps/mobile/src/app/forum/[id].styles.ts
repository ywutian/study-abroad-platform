import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  badgeContent: { flexDirection: 'row', alignItems: 'center', gap: 2 },
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
