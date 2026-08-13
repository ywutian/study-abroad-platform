import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  checkIcon: { marginLeft: 4 },
  // Profile Banner
  profileBanner: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  profileBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileBannerTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  profileSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryChipLabel: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  summaryChipValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  missingFieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  missingFieldsLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  missingFieldsText: {
    fontSize: fontSize.sm,
    flex: 1,
  },

  // Form
  formSection: {
    marginBottom: spacing.xl,
  },
  formLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.sm,
  },

  // Budget
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  budgetText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // School Count
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  countBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  countBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  schoolCountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  countOptionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },

  // Generate Button
  generateButtonContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  generateButton: {
    width: '100%',
  },
  cannotGenerateText: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    fontWeight: fontWeight.medium,
  },

  // Loading
  loadingContainer: {
    marginTop: spacing.lg,
  },
  loadingCard: {
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
  },
  loadingIcon: {
    marginBottom: spacing.lg,
  },
  loadingTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  loadingSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: fontSize.sm * 1.5,
  },
  loadingProgressContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  loadingPercent: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },

  // Summary Card
  summaryCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  summaryText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.6,
    marginBottom: spacing.lg,
  },
  summaryHint: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  tierCountsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tierCount: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierCountLabel: {
    fontSize: fontSize.xs,
  },
  tierCountValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  // School List Section
  schoolListSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },

  // Analysis
  analysisSection: {
    marginBottom: spacing.lg,
  },
  analysisCard: {
    marginBottom: spacing.sm,
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  analysisLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  analysisBullet: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    width: 16,
    textAlign: 'center',
  },
  analysisItemText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },

  // Reset
  resetContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  resetButton: {
    width: '100%',
  },
});
