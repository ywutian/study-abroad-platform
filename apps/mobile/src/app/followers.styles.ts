import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
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
