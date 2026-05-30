import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Clipboard,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar, Loading } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { chatRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useColors, spacing, fontSize, borderRadius, fontFamily } from '@/utils/theme';
import type { Conversation, Message } from '@/types';

// Date separator helper
function formatDateSeparator(dateStr: string, t: (key: string) => string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return t('chat.today');
  if (isYesterday(date)) return t('chat.yesterday');
  return format(date, 'MMM d, yyyy');
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const current = new Date(messages[index].createdAt);
  const previous = new Date(messages[index - 1].createdAt);
  return !isSameDay(current, previous);
}

interface MessageBubbleProps {
  item: Message;
  isMe: boolean;
  otherEmail: string | undefined;
  colors: ReturnType<typeof useColors>;
  onLongPress: (message: Message) => void;
  showDateSeparator: boolean;
  dateSeparatorText: string;
}

const MessageBubble = memo(function MessageBubble({
  item,
  isMe,
  otherEmail,
  colors,
  onLongPress,
  showDateSeparator,
  dateSeparatorText,
}: MessageBubbleProps) {
  return (
    <>
      {showDateSeparator && (
        <View style={styles.dateSeparator}>
          <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
          <Text
            style={[
              styles.dateSeparatorText,
              { color: colors.foregroundMuted, backgroundColor: colors.background },
            ]}
          >
            {dateSeparatorText}
          </Text>
          <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
        </View>
      )}
      <TouchableOpacity
        onLongPress={() => onLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
          {!isMe && (
            <Avatar source={null} name={otherEmail} size="sm" style={styles.messageAvatar} />
          )}
          <View
            style={[
              styles.messageBubble,
              {
                backgroundColor: isMe ? colors.primary : colors.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: isMe ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {item.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.messageTime,
                  {
                    color: isMe ? colors.onGradientMuted : colors.foregroundMuted,
                    fontFamily: fontFamily.mono,
                  },
                ]}
              >
                {format(new Date(item.createdAt), 'HH:mm')}
              </Text>
              {isMe && item.read && (
                <Ionicons
                  name="checkmark-done"
                  size={14}
                  color={colors.onGradientMuted}
                  style={styles.readIcon}
                />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </>
  );
});

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const toast = useToast();
  const flatListRef = useRef<FlatList>(null);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebSocket connection
  const {
    isConnected,
    sendMessage,
    joinConversation,
    markRead,
    sendTyping,
    getTypingUsers,
    isUserOnline,
  } = useChatSocket({
    onNewMessage: () => {
      // Scroll to bottom when a new message arrives
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
  });

  // Fetch conversation (initial load only, no polling)
  const {
    data: conversation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => apiClient.get<Conversation>(chatRoutes.conversation(id!)),
    enabled: !!id,
    // No refetchInterval — WebSocket handles real-time updates
  });

  // Join conversation room and mark as read when entering
  useEffect(() => {
    if (id && isConnected) {
      joinConversation(id);
      markRead(id);
    }
  }, [id, isConnected, joinConversation, markRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (conversation?.messages?.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation?.messages?.length]);

  // Send typing indicator with debounce
  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);

      if (id) {
        sendTyping(id, true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing indicator after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          sendTyping(id, false);
        }, 2000);
      }
    },
    [id, sendTyping]
  );

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Stop typing when leaving the screen
      if (id) {
        sendTyping(id, false);
      }
    };
  }, [id, sendTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !id) return;

    setIsSending(true);
    setInput('');

    // Stop typing indicator
    sendTyping(id, false);

    if (isConnected) {
      // Send via WebSocket
      const msg = await sendMessage(id, text);
      if (!msg) {
        // Fallback: send via REST if socket fails
        await apiClient.post<Message>(chatRoutes.conversationMessages(id), { content: text });
        queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      }
    } else {
      // Fallback: send via REST
      await apiClient.post<Message>(chatRoutes.conversationMessages(id), { content: text });
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
    }

    setIsSending(false);
  };

  // Long press message handler
  const handleMessageLongPress = useCallback(
    (message: Message) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const isMe = message.senderId === user?.id;
      const options = [t('chat.copy')];
      if (isMe) {
        const msgAge = Date.now() - new Date(message.createdAt).getTime();
        if (msgAge < 2 * 60 * 1000) options.push(t('chat.recall'));
        options.push(t('chat.delete'));
      }
      options.push(t('common.cancel'));

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: options.length - 1,
            destructiveButtonIndex: isMe ? options.length - 2 : undefined,
          },
          (index) => {
            if (options[index] === t('chat.copy')) {
              Clipboard.setString(message.content);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toast.show({ type: 'success', message: t('chat.copied') });
            } else if (options[index] === t('chat.recall')) {
              apiClient.delete(chatRoutes.message(message.id)).then(() => {
                queryClient.invalidateQueries({ queryKey: ['conversation', id] });
                toast.show({ type: 'success', message: t('chat.recalled') });
              });
            } else if (options[index] === t('chat.delete')) {
              apiClient.delete(chatRoutes.message(message.id)).then(() => {
                queryClient.invalidateQueries({ queryKey: ['conversation', id] });
              });
            }
          }
        );
      } else {
        Alert.alert(t('chat.messageActions'), undefined, [
          {
            text: t('chat.copy'),
            onPress: () => {
              Clipboard.setString(message.content);
              toast.show({ type: 'success', message: t('chat.copied') });
            },
          },
          ...(isMe
            ? [
                {
                  text: t('chat.delete'),
                  style: 'destructive' as const,
                  onPress: () => {
                    apiClient
                      .delete(`/chats/messages/${message.id}`)
                      .then(() =>
                        queryClient.invalidateQueries({ queryKey: ['conversation', id] })
                      );
                  },
                },
              ]
            : []),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]);
      }
    },
    [user?.id, id, t, queryClient, toast]
  );

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollButton(false);
  }, []);

  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
      setShowScrollButton(distanceFromBottom > 200);
    },
    []
  );

  // Get other participant
  const isGroupConversation = conversation?.kind === 'MATCH_GROUP';
  const otherParticipant =
    conversation?.otherUser ?? conversation?.participants.find((p) => p.userId !== user?.id)?.user;
  const otherUserId = otherParticipant?.id;
  const isOtherOnline = !isGroupConversation && otherUserId ? isUserOnline(otherUserId) : false;
  const typingUserIds = id ? getTypingUsers(id) : [];
  const isOtherTyping = isGroupConversation
    ? typingUserIds.length > 0
    : otherUserId
      ? typingUserIds.includes(otherUserId)
      : false;
  const headerTitle =
    conversation?.title ||
    otherParticipant?.profile?.nickname ||
    otherParticipant?.profile?.realName ||
    otherParticipant?.email?.split('@')[0] ||
    t('chat.title');

  const messages = conversation?.messages ?? [];

  const renderMessage = ({ item, index }: { item: Message; index: number }) => (
    <MessageBubble
      item={item}
      isMe={item.senderId === user?.id}
      otherEmail={item.sender?.email || otherParticipant?.email}
      colors={colors}
      onLongPress={handleMessageLongPress}
      showDateSeparator={shouldShowDateSeparator(messages, index)}
      dateSeparatorText={formatDateSeparator(item.createdAt, t)}
    />
  );

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !conversation) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foregroundMuted }}>{t('errors.notFound')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerRight: () => (
            <View style={styles.headerRight}>
              {!isGroupConversation && (
                <View
                  style={[
                    styles.onlineDot,
                    {
                      backgroundColor: isOtherOnline ? colors.success : colors.foregroundMuted,
                    },
                  ]}
                />
              )}
              <TouchableOpacity
                style={styles.headerButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.more')}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Connection status banner */}
        {!isConnected && (
          <View style={[styles.connectionBanner, { backgroundColor: colors.warning }]}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.warningForeground} />
            <Text style={[styles.connectionText, { color: colors.warningForeground }]}>
              {t('chat.connecting')}
            </Text>
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.foregroundMuted }]}>
                {t('chat.noMessages')}
              </Text>
            </View>
          }
        />

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.scrollBottomContainer}>
            <TouchableOpacity
              onPress={scrollToBottom}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              style={[
                styles.scrollBottomButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Ionicons name="chevron-down" size={20} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Typing indicator */}
        {isOtherTyping && (
          <View style={[styles.typingContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.typingText, { color: colors.foregroundMuted }]}>
              {isGroupConversation ? (
                <>
                  <Text style={{ fontFamily: fontFamily.mono }}>
                    {conversation?.participantCount || conversation?.participants.length || 0}
                  </Text>
                  {` ${t('chat.typing')}`}
                </>
              ) : (
                t('chat.typing')
              )}
            </Text>
          </View>
        )}

        {/* Input Area */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.input, borderColor: colors.inputBorder },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={handleInputChange}
              placeholder={t('chat.typeMessage')}
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
              style={[styles.input, { color: colors.foreground }]}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || isSending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              accessibilityState={{ disabled: !input.trim() || isSending }}
              style={[
                styles.sendButton,
                {
                  backgroundColor: input.trim() ? colors.primary : colors.muted,
                },
              ]}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={input.trim() ? colors.primaryForeground : colors.foregroundMuted}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.sm,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  connectionText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  messagesList: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '50%',
  },
  emptyText: {
    fontSize: fontSize.base,
  },
  messageContainer: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: spacing.sm,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  messageText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  messageTime: {
    fontSize: fontSize.xs,
  },
  readIcon: {
    marginLeft: 4,
  },
  typingContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  typingText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
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
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dateSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateSeparatorText: {
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.sm,
  },
  scrollBottomContainer: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 80,
  },
  scrollBottomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    shadowOpacity: 0.1,
    elevation: 3,
  },
});
