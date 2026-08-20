import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  assistantBubble: { borderWidth: 1 },
  container: {
    flex: 1,
  },

  // ---- Application dashboard ---------------------------------------------
  dashboardCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dashboardEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  dashboardTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  dashboardSummary: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metricTile: {
    width: '48%',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  metricLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  dashboardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dashboardButton: {
    flex: 1,
    minWidth: 150,
    minHeight: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dashboardButtonSecondary: {
    borderWidth: 1,
  },
  dashboardButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  taskList: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  taskRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },

  // ---- Quota header --------------------------------------------------------
  quotaCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  quotaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quotaTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  quotaBody: {
    gap: spacing.xs,
  },
  quotaText: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },

  // ---- Agent chips ---------------------------------------------------------
  agentChipContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  agentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  agentChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // ---- Quick actions -------------------------------------------------------
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickActionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  quickActionCard: {
    width: 160,
  },
  quickActionContent: {
    alignItems: 'flex-start',
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  quickActionDesc: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  // ---- Welcome section -----------------------------------------------------
  welcomeScroll: {
    flex: 1,
  },
  welcomeContent: {
    paddingBottom: spacing.xl,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
  },
  welcomeIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  welcomeSubtitle: {
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ---- Chat header (compact) -----------------------------------------------
  chatHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs,
  },
  chatHeaderTop: {},

  // ---- Message list --------------------------------------------------------
  messageList: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  bubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  userText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },

  // ---- Tool indicator ------------------------------------------------------
  toolIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  toolIndicatorText: {
    fontSize: fontSize.xs,
    flex: 1,
  },

  // ---- Agent badge ---------------------------------------------------------
  agentBadgeRow: {
    marginBottom: spacing.sm,
  },
  agentBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // ---- Typing indicator ----------------------------------------------------
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typingText: {
    fontSize: fontSize.sm,
  },

  // ---- Input bar -----------------------------------------------------------
  inputBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  approvalCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.base,
    maxHeight: 120,
    paddingVertical: spacing.sm,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
