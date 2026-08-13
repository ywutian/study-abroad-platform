import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing['4xl'],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
  },
  avatar: {
    marginBottom: spacing.md,
  },
  email: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  roleBadge: {
    marginBottom: spacing.lg,
  },
  completionCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  completionCopy: {
    flex: 1,
    minHeight: 96,
    justifyContent: 'center',
  },
  completionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  completionSummary: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  missingFields: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  completeButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  verifyText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  analysisTitleBlock: {
    flex: 1,
  },
  analysisSubtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  analysisBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  analysisVerdict: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  analysisBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  analysisStats: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisStatBlock: {
    flex: 1,
  },
  analysisStatLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  analysisStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  analysisStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
  },
  footer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  version: {
    fontSize: fontSize.sm,
  },
});
