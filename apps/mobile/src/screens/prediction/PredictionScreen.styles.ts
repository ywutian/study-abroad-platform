import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
  },
  progressSection: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: fontSize.sm,
  },
  progressValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  progressBar: {
    height: 6,
  },
  progressHint: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  explanationCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  analysisCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  analysisCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  analysisCardTitleBlock: {
    flex: 1,
  },
  analysisCardTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  analysisCardSubtitle: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  analysisCardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  analysisCardVerdict: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  analysisCardBody: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
  },
  analysisCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  analysisCardLink: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  explanationText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  predictionCard: {
    marginBottom: spacing.md,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  predictionInfo: {
    flex: 1,
    gap: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  rateContainer: {
    alignItems: 'flex-end',
  },
  tierVerdict: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  rateLabel: {
    fontSize: fontSize.xs,
  },
  benchmarkLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  benchmarkDelta: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
    textAlign: 'right',
  },
  benchmarkBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  insightPanel: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  insightTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  insightBody: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  signalBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  uncertaintyText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  updatedText: {
    fontSize: fontSize.xs,
  },
  factors: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  explanationBox: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  explanationTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  suggestions: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  factorCopy: { flex: 1 },
  factorDetail: { fontSize: fontSize.xs, marginTop: 2 },
  factorLabel: {
    fontSize: fontSize.xs,
  },
  factorValue: {
    width: 24,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  confidence: {
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  addButtonContainer: {
    padding: spacing.lg,
  },
  addButton: {
    width: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  reportButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  reportContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  reportLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  resultOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
  },
  resultOptionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  roundOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roundOption: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roundOptionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  notesInput: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    textAlignVertical: 'top',
  },
  reportSubmitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
