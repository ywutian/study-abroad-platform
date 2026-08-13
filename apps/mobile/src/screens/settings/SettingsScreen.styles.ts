import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    margin: spacing.lg,
    marginBottom: 0,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionContent: {
    padding: 0,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fontSize.base,
  },
  settingValue: {
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  // Delete account password dialog
  passwordOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 100,
  },
  passwordDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  deleteTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  deleteMessage: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  passwordInput: {
    width: '100%',
    marginBottom: spacing.md,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  deleteActionButton: {
    flex: 1,
  },
});
