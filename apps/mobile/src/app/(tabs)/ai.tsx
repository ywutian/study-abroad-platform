import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';

import { Card, CardContent, Badge, Button, Loading } from '@/components/ui';
import { Segment } from '@/components/ui/Tabs';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { AiChatMessage, StreamEvent } from '@/types';

type AgentMode = 'auto' | 'essay' | 'school' | 'profile' | 'timeline';

interface ChatMessageItemProps {
  item: AiChatMessage;
  colors: ReturnType<typeof useColors>;
  markdownStyles: Record<string, any>;
  isLoading: boolean;
  t: (key: string) => string;
}

const ChatMessageItem = React.memo(function ChatMessageItem({
  item,
  colors,
  markdownStyles,
  isLoading,
  t,
}: ChatMessageItemProps) {
  const isUser = item.role === 'user';

  return (
    <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.assistantMessage]}>
      {!isUser && (
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name="sparkles" size={16} color={colors.primaryForeground} />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isUser
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        {isUser ? (
          <Text style={[styles.messageText, { color: colors.primaryForeground }]}>
            {item.content}
          </Text>
        ) : (
          <>
            {/* Tool calls */}
            {item.toolCalls?.map((tc, i) => (
              <View key={i} style={[styles.toolCall, { backgroundColor: colors.muted }]}>
                <Ionicons name="build" size={14} color={colors.foregroundMuted} />
                <Text style={[styles.toolCallText, { color: colors.foregroundMuted }]}>
                  {tc.name}
                </Text>
              </View>
            ))}

            {/* Content */}
            {item.content ? (
              <Markdown style={markdownStyles}>{item.content}</Markdown>
            ) : isLoading ? (
              <View style={styles.thinkingContainer}>
                <Loading size="small" />
                <Text style={[styles.thinkingText, { color: colors.foregroundMuted }]}>
                  {t('ai.chat.thinking')}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
});

export default function AIScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { isAuthenticated, user } = useAuthStore();
  const scrollRef = useRef<FlashListRef<AiChatMessage>>(null);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>('auto');

  const agentModes = [
    { key: 'auto', label: t('ai.chat.agentModes.auto') },
    { key: 'essay', label: t('ai.chat.agentModes.essay') },
    { key: 'school', label: t('ai.chat.agentModes.school') },
  ];

  const quickSuggestions = [
    { text: t('ai.chat.suggestions.analyzeProfile'), icon: 'person' as const },
    { text: t('ai.chat.suggestions.recommendSchools'), icon: 'school' as const },
    { text: t('ai.chat.suggestions.reviewEssay'), icon: 'document-text' as const },
    { text: t('ai.chat.suggestions.checkTimeline'), icon: 'calendar' as const },
  ];

  const sendMessage = useCallback(
    async (messageText?: string) => {
      const text = messageText || input.trim();
      if (!text || isLoading) return;

      if (!isAuthenticated) {
        toast.error(t('errors.unauthorized'));
        return;
      }

      const userMessage: AiChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      const assistantMessage: AiChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Use streaming API
        for await (const chunk of apiClient.stream('/ai-agent/chat', {
          message: text,
          agentMode,
          conversationId: null, // Start new conversation
          stream: true, // 必须传递此参数启用 SSE
        })) {
          try {
            const event: StreamEvent = JSON.parse(chunk);

            if (event.type === 'content' && event.content) {
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + event.content,
                  };
                }
                return newMessages;
              });
            } else if (event.type === 'tool_start' && event.tool) {
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    toolCalls: [
                      ...(lastMessage.toolCalls || []),
                      { name: event.tool!, status: 'running' },
                    ],
                  };
                }
                return newMessages;
              });
            } else if (event.type === 'error') {
              toast.error(event.error || t('errors.unknown'));
            }
          } catch {
            // Non-JSON chunk, treat as plain text
            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                newMessages[newMessages.length - 1] = {
                  ...lastMessage,
                  content: lastMessage.content + chunk,
                };
              }
              return newMessages;
            });
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('errors.unknown'));
        // Remove the empty assistant message
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, isAuthenticated, agentMode, toast, t]
  );

  const handleSuggestionPress = (text: string) => {
    sendMessage(text);
  };

  const markdownStyles = useMemo(
    () => ({
      body: {
        color: colors.foreground,
        fontSize: fontSize.base,
        lineHeight: 24,
      },
      heading1: {
        color: colors.foreground,
        fontSize: fontSize['2xl'],
        fontWeight: fontWeight.bold,
        marginVertical: spacing.md,
      },
      heading2: {
        color: colors.foreground,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.semibold,
        marginVertical: spacing.sm,
      },
      paragraph: {
        color: colors.foreground,
        marginVertical: spacing.xs,
      },
      code_inline: {
        backgroundColor: colors.muted,
        color: colors.primary,
        paddingHorizontal: spacing.xs,
        borderRadius: 4,
      },
      code_block: {
        backgroundColor: colors.backgroundSecondary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginVertical: spacing.sm,
      },
      list_item: {
        color: colors.foreground,
        marginVertical: spacing.xs,
      },
      link: {
        color: colors.primary,
      },
    }),
    [colors]
  );

  const renderMessage = useCallback(
    ({ item }: { item: AiChatMessage }) => (
      <ChatMessageItem
        item={item}
        colors={colors}
        markdownStyles={markdownStyles}
        isLoading={isLoading}
        t={t}
      />
    ),
    [colors, markdownStyles, isLoading, t]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Agent Mode Selector */}
      <View style={[styles.modeSelector, { borderBottomColor: colors.border }]}>
        <Segment
          segments={agentModes}
          value={agentMode}
          onChange={(value) => setAgentMode(value as AgentMode)}
        />
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <ScrollView style={styles.emptyContainer} contentContainerStyle={styles.emptyContent}>
          <View style={[styles.welcomeIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="sparkles" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
            {t('ai.chat.title')}
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.foregroundMuted }]}>
            {t('ai.chat.placeholder')}
          </Text>

          {/* Quick Suggestions */}
          <View style={styles.suggestions}>
            {quickSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleSuggestionPress(suggestion.text)}
                style={[
                  styles.suggestionCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name={suggestion.icon} size={20} color={colors.primary} />
                <Text style={[styles.suggestionText, { color: colors.foreground }]}>
                  {suggestion.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlashList
          ref={scrollRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
        />
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
            onChangeText={setInput}
            placeholder={t('ai.chat.placeholder')}
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={2000}
            style={[styles.input, { color: colors.foreground }]}
            editable={!isLoading && isAuthenticated}
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={!input.trim() || isLoading || !isAuthenticated}
            style={[
              styles.sendButton,
              {
                backgroundColor: input.trim() && !isLoading ? colors.primary : colors.muted,
              },
            ]}
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() && !isLoading ? colors.primaryForeground : colors.foregroundMuted}
            />
          </TouchableOpacity>
        </View>

        {!isAuthenticated && (
          <Text style={[styles.authHint, { color: colors.foregroundMuted }]}>
            {t('errors.unauthorized')}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeSelector: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  authHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
