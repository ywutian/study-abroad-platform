import { borderRadius, fontSize, fontWeight, spacing } from '@/utils/theme';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
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
  itemCard: {
    marginBottom: 0,
  },
  itemCardContent: {
    padding: spacing.lg,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  itemSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.xs,
  },
  itemDescription: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  timeInfo: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timeText: {
    fontSize: fontSize.xs,
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
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
