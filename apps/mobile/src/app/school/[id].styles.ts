import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  sourceLabel: { fontSize: fontSize.xs - 2, marginTop: 2 },
  rankingDivider: { borderTopWidth: 1 },
  headerAction: { paddingLeft: 8 },
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    overflow: 'hidden',
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  coverImage: {
    width: '100%',
    height: 180,
    marginTop: -spacing['2xl'],
    marginBottom: spacing.md,
  },
  logo: {
    marginBottom: spacing.lg,
  },
  logoOnCover: {
    marginTop: -44,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  nameZh: {
    fontSize: fontSize.base,
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: fontSize.sm,
    marginLeft: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  tabsContainer: {
    padding: spacing.lg,
  },
  tabContent: {
    paddingTop: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fontSize.base,
    lineHeight: 24,
  },
  rankingListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rankingListInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  rankSource: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  rankValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  rankLabel: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  websiteButton: {
    marginTop: spacing.md,
  },
  deadlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadlineInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  deadlineType: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  deadlineNotes: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  essayPrompt: {
    fontSize: fontSize.base,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  essayMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  caseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caseInfo: {
    flex: 1,
  },
  caseMajor: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  caseYear: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    padding: spacing.xl,
    fontSize: fontSize.base,
  },
});
