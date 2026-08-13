import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  weightsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  sliderContainer: {
    marginBottom: spacing.lg,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sliderLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  sliderValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  sliderHint: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  calculateButton: {
    marginTop: spacing.sm,
  },
  saveCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
  },
  resultsSection: {
    padding: spacing.lg,
  },
  schoolCard: {
    marginBottom: spacing.sm,
  },
  schoolContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  schoolInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  schoolText: {
    flex: 1,
  },
  schoolName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  schoolNameZh: {
    fontSize: fontSize.xs,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: spacing.sm,
  },
  score: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  scoreLabel: {
    fontSize: fontSize.xs,
    marginLeft: 2,
  },
});
