import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { Avatar, Loading } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useColors, spacing, fontSize, borderRadius } from '@/utils/theme';
import type { Conversation, Message } from '@/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
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
    queryFn: () => apiClient.get<Conversation>(`/chats/conversations/${id}`),
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
        await apiClient.post<Message>(`/chats/conversations/${id}/messages`, { content: text });
        queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      }
    } else {
      // Fallback: send via REST
      await apiClient.post<Message>(`/chats/conversations/${id}/messages`, { content: text });
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
    }

    setIsSending(false);
  };

  // Get other participant
  const otherParticipant = conversation?.participants.find((p) => p.userId !== user?.id)?.user;
  const otherUserId = otherParticipant?.id;
  const isOtherOnline = otherUserId ? isUserOnline(otherUserId) : false;
  const typingUserIds = id ? getTypingUsers(id) : [];
  const isOtherTyping = otherUserId ? typingUserIds.includes(otherUserId) : false;

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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        {!isMe && (
          <Avatar
            source={null}
            name={otherParticipant?.email}
            size="sm"
            style={styles.messageAvatar}
          />
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
                  color: isMe ? 'rgba(255,255,255,0.7)' : colors.foregroundMuted,
                },
              ]}
            >
              {format(new Date(item.createdAt), 'HH:mm')}
            </Text>
            {isMe && item.read && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color="rgba(255,255,255,0.7)"
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: otherParticipant?.email?.split('@')[0] || t('chat.title'),
          headerRight: () => (
            <View style={styles.headerRight}>
              {/* Online status dot */}
              <View
                style={[
                  styles.onlineDot,
                  {
                    backgroundColor: isOtherOnline ? colors.success : colors.foregroundMuted,
                  },
                ]}
              />
              <TouchableOpacity style={styles.headerButton}>
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
              {t('chat.connecting', 'Connecting...')}
            </Text>
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={conversation.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.foregroundMuted }]}>
                {t('chat.noMessages')}
              </Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isOtherTyping && (
          <View style={[styles.typingContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.typingText, { color: colors.foregroundMuted }]}>
              {t('chat.typing', 'typing...')}
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
});
