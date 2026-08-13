import { StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

export const styles = StyleSheet.create({
  assistantBubble: { borderWidth: 1 },
  container: {
    flex: 1,
  },
  modeSelector: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeSelectorSegment: {
    flex: 1,
  },
  newChatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  welcomeIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  welcomeSubtitle: {
    fontSize: fontSize.base,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  suggestions: {
    width: '100%',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  suggestionText: {
    flex: 1,
    fontSize: fontSize.base,
    marginLeft: spacing.md,
  },
  messagesList: {
    padding: spacing.lg,
  },
  messageContainer: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  assistantMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  messageText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  toolCall: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  toolCallText: {
    fontSize: fontSize.sm,
    marginLeft: spacing.xs,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingText: {
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
  },
  inputContainer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  input: {
    flex: 1,
    fontSize: fontSize.base,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authHintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  authHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  authHintLink: {
    fontWeight: fontWeight.semibold,
  },
});
