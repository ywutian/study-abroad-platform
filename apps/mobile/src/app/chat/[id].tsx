import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { Avatar, Loading, ErrorState } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { Conversation, Message } from '@/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const [input, setInput] = useState('');

  // Fetch conversation
  const {
    data: conversation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => apiClient.get<Conversation>(`/chat/conversations/${id}`),
    enabled: !!id,
    refetchInterval: 5000, // Poll for new messages
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient.post<Message>(`/chat/conversations/${id}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      setInput('');
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (conversation?.messages?.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation?.messages?.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(text);
  };

  // Get other participant
  const otherParticipant = conversation?.participants.find((p) => p.userId !== user?.id)?.user;

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !conversation) {
    return <ErrorState title={t('errors.notFound')} />;
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
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
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
              onChangeText={setInput}
              placeholder={t('chat.typeMessage')}
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
              style={[styles.input, { color: colors.foreground }]}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || sendMessageMutation.isPending}
              style={[
                styles.sendButton,
                {
                  backgroundColor: input.trim() ? colors.primary : colors.muted,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={20}
                color={input.trim() ? colors.primaryForeground : colors.foregroundMuted}
              />
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
  headerButton: {
    padding: spacing.sm,
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
  messageTime: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
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
