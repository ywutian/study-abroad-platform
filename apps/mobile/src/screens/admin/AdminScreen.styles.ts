import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  headerRight: {
    width: 40,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  statCardWrapper: {
    width: '50%',
    padding: spacing.xs,
  },
  statCard: {
    height: 120,
  },
  statCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  // Reports
  reportCard: {
    marginBottom: spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reportReason: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  reportDetail: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  reportMeta: {
    fontSize: fontSize.xs,
  },

  // Users
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    paddingVertical: spacing.xs,
  },
  userCard: {
    marginBottom: spacing.sm,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Loading
  loadingContainer: {
    marginTop: spacing.md,
  },

  // Modal
  modalContent: {
    paddingTop: spacing.md,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  modalValue: {
    fontSize: fontSize.sm,
    flex: 2,
    textAlign: 'right',
  },
  modalActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  modalButton: {
    width: '100%',
  },

  // User Modal
  userModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  userModalEmail: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  userModalBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  userModalStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  userModalStat: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  userModalStatValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  userModalStatLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  userModalStatDivider: {
    width: 1,
    height: 40,
  },
});
