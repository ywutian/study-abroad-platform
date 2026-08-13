import { borderRadius, fontFamily, fontSize, fontWeight, spacing } from '@/utils/theme';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  pinnedCard: { borderLeftWidth: 3 },
  teamBadgeText: { fontSize: fontSize.xs, marginLeft: 2 },
  contentInput: { minHeight: 120, textAlignVertical: 'top' },
  tagInput: { flex: 1, marginBottom: 0 },
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
    fontFamily: fontFamily.mono,
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
    fontFamily: fontFamily.mono,
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
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.18,
    elevation: 2,
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
});
