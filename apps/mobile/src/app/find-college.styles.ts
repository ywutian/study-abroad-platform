import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  skeletonMarginTop: { marginTop: 8 },
  skeletonMarginTopSmall: { marginTop: 6 },
  container: {
    flex: 1,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flex: 1,
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },

  // Filter Chips
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: spacing.xs,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Active Filter Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  tagCloseIcon: {
    marginLeft: spacing.xs,
  },

  // Results count
  resultCountContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  resultCountText: {
    fontSize: fontSize.sm,
  },

  // List
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaStack: {
    width: 92,
    height: 64,
    justifyContent: 'center',
  },
  coverThumb: {
    width: 92,
    height: 64,
    borderRadius: borderRadius.md,
  },
  logoOverlay: {
    position: 'absolute',
    left: 6,
    bottom: 6,
  },
  schoolInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  schoolNameZh: {
    fontSize: fontSize.sm,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: fontSize.xs,
  },
  heartButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },

  // Loading / Footer
  loadingContainer: {
    flex: 1,
  },
  skeletonCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },

  // Filter Modal
  filterSectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rangeInputWrapper: {
    flex: 1,
  },
  rangeInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    minHeight: 44,
  },
  rangeSeparator: {
    marginHorizontal: spacing.sm,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  filterActionButton: {
    flex: 1,
  },
});
