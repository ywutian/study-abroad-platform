import { borderRadius, fontSize, fontWeight, spacing } from '@/utils/theme';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 24,
    borderRadius: 4,
  },
  stepContent: {
    paddingBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  schoolSearchContainer: {
    position: 'relative',
    zIndex: 10,
  },
  schoolDropdown: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    maxHeight: 200,
    zIndex: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  schoolOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  schoolOptionName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  schoolOptionNameZh: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  noSchoolResults: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
