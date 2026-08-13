import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  fieldContainer: { marginBottom: spacing.md },
  multilineInput: { minHeight: 100 },
  singleLineInput: { minHeight: 48 },
  content: {
    gap: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  section: {
    gap: spacing.md,
  },
  panel: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  cardKicker: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  cardMeta: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  highlights: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  highlightBlock: {
    gap: spacing.xs,
  },
  highlightTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  highlightChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  highlightChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  experienceText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  emptyHighlights: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  roleGroup: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  roleLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  coordination: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  coordinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coordinationTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  coordinationBody: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  listText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  helperText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  primaryButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
