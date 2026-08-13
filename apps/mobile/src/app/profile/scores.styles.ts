import { borderRadius, fontSize, fontWeight, spacing } from '@/utils/theme';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  listContainer: {
    gap: spacing.md,
  },
  scoreCard: {
    marginBottom: 0,
  },
  scoreCardContent: {
    padding: spacing.lg,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  scoreTypeContainer: {
    flex: 1,
  },
  scoreTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  scoreTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  scoreSubject: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  scoreDate: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  scoreActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.xs,
  },
  scoreValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  fab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  formContainer: {
    paddingBottom: spacing.md,
  },
  subScoresContainer: {
    gap: spacing.xs,
  },
  subScoresTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
