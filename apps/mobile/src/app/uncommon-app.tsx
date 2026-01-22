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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';

import { AnimatedCard, Badge, Loading, ProgressBar } from '@/components/ui';
import { CardContent } from '@/components/ui/Card';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useToast } from '@/components/ui/Toast';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { AiChatMessage, StreamEvent } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentType = 'orchestrator' | 'essay' | 'school' | 'profile' | 'timeline';
type AgentMode = 'auto' | AgentType;

interface QuotaData {
  used: number;
  limit: number;
  remaining: number;
  resetAt?: string;
}

interface UsageData {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requestCount: number;
}

interface AgentChip {
  key: AgentMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface QuickAction {
  agent: AgentType;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: string;
  descKey: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UncommonAppScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  // ---- State ---------------------------------------------------------------
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>('auto');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [activeAgent, setActiveAgent] = useState<string | undefined>();
  const [activeTool, setActiveTool] = useState<string | undefined>();

  // ---- Queries -------------------------------------------------------------
  const { data: quota } = useQuery<QuotaData>({
    queryKey: ['ai-agent', 'quota'],
    queryFn: () => apiClient.get('/ai-agent/quota'),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: usage } = useQuery<UsageData>({
    queryKey: ['ai-agent', 'usage'],
    queryFn: () => apiClient.get('/ai-agent/usage'),
    enabled: isAuthenticated,
  });

  // ---- Clear conversation mutation -----------------------------------------
  const clearMutation = useMutation({
    mutationFn: () => apiClient.delete('/ai-agent/conversation'),
    onSuccess: () => {
      setMessages([]);
      setConversationId(undefined);
      setActiveAgent(undefined);
      setActiveTool(undefined);
      queryClient.invalidateQueries({ queryKey: ['ai-agent'] });
      toast.success(t('uncommonApp.conversationCleared'));
    },
    onError: () => {
      toast.error(t('uncommonApp.clearError'));
    },
  });

  // ---- Agent chips ---------------------------------------------------------
  const agentChips: AgentChip[] = useMemo(
    () => [
      { key: 'auto', label: t('uncommonApp.agents.auto'), icon: 'sparkles' },
      { key: 'essay', label: t('uncommonApp.agents.essay'), icon: 'document-text' },
      { key: 'school', label: t('uncommonApp.agents.school'), icon: 'school' },
      { key: 'profile', label: t('uncommonApp.agents.profile'), icon: 'person' },
      { key: 'timeline', label: t('uncommonApp.agents.timeline'), icon: 'calendar' },
    ],
    [t]
  );

  // ---- Quick actions -------------------------------------------------------
  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        agent: 'profile',
        icon: 'analytics',
        color: colors.primary,
        titleKey: 'uncommonApp.quickActions.analyzeProfile',
        descKey: 'uncommonApp.quickActions.analyzeProfileDesc',
        prompt: t('uncommonApp.quickActions.analyzeProfilePrompt'),
      },
      {
        agent: 'school',
        icon: 'school',
        color: colors.info,
        titleKey: 'uncommonApp.quickActions.schoolRec',
        descKey: 'uncommonApp.quickActions.schoolRecDesc',
        prompt: t('uncommonApp.quickActions.schoolRecPrompt'),
      },
      {
        agent: 'essay',
        icon: 'create',
        color: colors.success,
        titleKey: 'uncommonApp.quickActions.essayReview',
        descKey: 'uncommonApp.quickActions.essayReviewDesc',
        prompt: t('uncommonApp.quickActions.essayReviewPrompt'),
      },
      {
        agent: 'timeline',
        icon: 'time',
        color: colors.warning,
        titleKey: 'uncommonApp.quickActions.timeline',
        descKey: 'uncommonApp.quickActions.timelineDesc',
        prompt: t('uncommonApp.quickActions.timelinePrompt'),
      },
    ],
    [t, colors]
  );

  // ---- Markdown styles -----------------------------------------------------
  const markdownStyles = useMemo(
    () => ({
      body: { color: colors.foreground, fontSize: fontSize.base, lineHeight: 24 },
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
      paragraph: { color: colors.foreground, marginVertical: spacing.xs },
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
      list_item: { color: colors.foreground, marginVertical: spacing.xs },
      link: { color: colors.primary },
      strong: { color: colors.foreground, fontWeight: fontWeight.bold },
    }),
    [colors]
  );

  // ---- Send message (streaming) --------------------------------------------
  const sendMessage = useCallback(
    async (messageText?: string, directAgent?: AgentType) => {
      const text = messageText || input.trim();
      if (!text || isStreaming) return;

      if (!isAuthenticated) {
        toast.error(t('errors.unauthorized'));
        return;
      }

      const userMessage: AiChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      const assistantMessage: AiChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInput('');
      setIsStreaming(true);
      setActiveTool(undefined);

      try {
        const agentToUse = directAgent || (agentMode !== 'auto' ? agentMode : undefined);
        const endpoint = agentToUse ? '/ai-agent/agent' : '/ai-agent/chat';
        const body = agentToUse
          ? { agent: agentToUse, message: text, conversationId }
          : { message: text, conversationId, stream: true };

        if (agentToUse) {
          // Non-streaming direct agent invocation
          const response = await apiClient.post<{
            message: string;
            agentType: string;
            conversationId?: string;
          }>(endpoint, body);

          if (response.conversationId) {
            setConversationId(response.conversationId);
          }
          setActiveAgent(response.agentType);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              last.content = response.message;
            }
            return updated;
          });
        } else {
          // Streaming chat
          for await (const chunk of apiClient.stream(endpoint, body)) {
            try {
              const event: StreamEvent = JSON.parse(chunk);

              switch (event.type) {
                case 'start':
                  if (event.agent) setActiveAgent(event.agent);
                  break;

                case 'content':
                  if (event.content) {
                    setMessages((prev) => {
                      const updated = [...prev];
                      const last = updated[updated.length - 1];
                      if (last.role === 'assistant') {
                        last.content += event.content;
                      }
                      return updated;
                    });
                  }
                  break;

                case 'tool_start':
                  if (event.tool) {
                    setActiveTool(event.tool);
                    setMessages((prev) => {
                      const updated = [...prev];
                      const last = updated[updated.length - 1];
                      if (last.role === 'assistant') {
                        last.toolCalls = [
                          ...(last.toolCalls || []),
                          { name: event.tool!, status: 'running' },
                        ];
                      }
                      return updated;
                    });
                  }
                  break;

                case 'tool_end':
                  setActiveTool(undefined);
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last.role === 'assistant' && last.toolCalls) {
                      const tc = last.toolCalls[last.toolCalls.length - 1];
                      if (tc) tc.status = 'done';
                    }
                    return updated;
                  });
                  break;

                case 'agent_switch':
                  if (event.agent) setActiveAgent(event.agent);
                  break;

                case 'done':
                  if (event.response?.agentType) {
                    setActiveAgent(event.response.agentType);
                  }
                  break;

                case 'error':
                  toast.error(event.error || t('errors.unknown'));
                  break;
              }
            } catch {
              // Non-JSON chunk – append as raw text
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  last.content += chunk;
                }
                return updated;
              });
            }
          }
        }

        // Refresh quota after each request
        queryClient.invalidateQueries({ queryKey: ['ai-agent', 'quota'] });
        queryClient.invalidateQueries({ queryKey: ['ai-agent', 'usage'] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('errors.unknown'));
        // Remove the empty assistant message on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
        setActiveTool(undefined);
      }
    },
    [input, isStreaming, isAuthenticated, agentMode, conversationId, toast, t, queryClient]
  );

  // ---- Quick action handler ------------------------------------------------
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      setAgentMode(action.agent);
      sendMessage(action.prompt, action.agent);
    },
    [sendMessage]
  );

  // ---- Agent label helper --------------------------------------------------
  const getAgentLabel = (agent?: string): string => {
    if (!agent) return '';
    const map: Record<string, string> = {
      orchestrator: t('uncommonApp.agents.auto'),
      essay: t('uncommonApp.agents.essay'),
      school: t('uncommonApp.agents.school'),
      profile: t('uncommonApp.agents.profile'),
      timeline: t('uncommonApp.agents.timeline'),
    };
    return map[agent] || agent;
  };

  // ---- Quota percentage ----------------------------------------------------
  const quotaPercent = quota ? Math.round((quota.used / quota.limit) * 100) : 0;
  const quotaColor =
    quotaPercent > 90 ? colors.error : quotaPercent > 70 ? colors.warning : colors.primary;

  // =========================================================================
  // Render helpers
  // =========================================================================

  const renderQuotaHeader = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <View
        style={[styles.quotaCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.quotaRow}>
          <View style={styles.quotaLeft}>
            <Ionicons name="flash" size={20} color={colors.primary} />
            <Text style={[styles.quotaTitle, { color: colors.foreground }]}>
              {t('uncommonApp.quota.title')}
            </Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity
              onPress={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.foregroundMuted} />
            </TouchableOpacity>
          )}
        </View>

        {quota ? (
          <View style={styles.quotaBody}>
            <ProgressBar
              value={quota.used}
              max={quota.limit}
              color={quotaColor}
              size="sm"
              showValue={false}
            />
            <Text style={[styles.quotaText, { color: colors.foregroundMuted }]}>
              {t('uncommonApp.quota.usage', {
                used: quota.used,
                limit: quota.limit,
              })}
            </Text>
          </View>
        ) : (
          <View style={styles.quotaBody}>
            <Text style={[styles.quotaText, { color: colors.foregroundMuted }]}>
              {t('uncommonApp.quota.loading')}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderAgentSelector = () => (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.agentChipContainer}
      >
        {agentChips.map((chip) => {
          const isActive = agentMode === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setAgentMode(chip.key)}
              style={[
                styles.agentChip,
                {
                  backgroundColor: isActive ? colors.primary : colors.muted,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={chip.icon}
                size={16}
                color={isActive ? colors.primaryForeground : colors.foregroundMuted}
              />
              <Text
                style={[
                  styles.agentChipText,
                  { color: isActive ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  const renderQuickActions = () => (
    <Animated.View entering={FadeInDown.delay(300).duration(400)}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {t('uncommonApp.quickActions.title')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActionsContainer}
      >
        {quickActions.map((action, index) => (
          <AnimatedCard
            key={action.agent}
            onPress={() => handleQuickAction(action)}
            style={[styles.quickActionCard, { borderColor: colors.border }]}
          >
            <CardContent style={styles.quickActionContent}>
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text
                style={[styles.quickActionTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {t(action.titleKey)}
              </Text>
              <Text
                style={[styles.quickActionDesc, { color: colors.foregroundMuted }]}
                numberOfLines={2}
              >
                {t(action.descKey)}
              </Text>
            </CardContent>
          </AnimatedCard>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderWelcome = () => (
    <ScrollView
      style={styles.welcomeScroll}
      contentContainerStyle={styles.welcomeContent}
      showsVerticalScrollIndicator={false}
    >
      {renderQuotaHeader()}
      {renderAgentSelector()}
      {renderQuickActions()}

      {/* Welcome message */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.welcomeSection}>
        <View style={[styles.welcomeIcon, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="rocket" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
          {t('uncommonApp.welcome.title')}
        </Text>
        <Text style={[styles.welcomeSubtitle, { color: colors.foregroundMuted }]}>
          {t('uncommonApp.welcome.subtitle')}
        </Text>
      </Animated.View>
    </ScrollView>
  );

  // ---- Message rendering ---------------------------------------------------

  const renderToolIndicator = (toolName: string, status?: string) => (
    <View style={[styles.toolIndicator, { backgroundColor: colors.muted }]}>
      <Ionicons
        name={status === 'done' ? 'checkmark-circle' : 'cog'}
        size={14}
        color={status === 'done' ? colors.success : colors.foregroundMuted}
      />
      <Text style={[styles.toolIndicatorText, { color: colors.foregroundMuted }]}>{toolName}</Text>
      {status !== 'done' && <Loading size="small" />}
    </View>
  );

  const renderAgentBadge = (agent: string) => (
    <View style={styles.agentBadgeRow}>
      <Badge variant="secondary">
        <Text style={[styles.agentBadgeText, { color: colors.primary }]}>
          {getAgentLabel(agent)}
        </Text>
      </Badge>
    </View>
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: AiChatMessage; index: number }) => {
      const isUser = item.role === 'user';
      const isLastAssistant = !isUser && index === messages.length - 1;

      return (
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View
            style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}
          >
            {/* Avatar for assistant */}
            {!isUser && (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Ionicons name="sparkles" size={14} color={colors.primaryForeground} />
              </View>
            )}

            <View
              style={[
                styles.bubble,
                isUser
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
              ]}
            >
              {/* Agent switch badge */}
              {!isUser && isLastAssistant && activeAgent && renderAgentBadge(activeAgent)}

              {/* Tool call indicators */}
              {item.toolCalls?.map((tc, i) => (
                <View key={`tool-${i}`}>{renderToolIndicator(tc.name, tc.status)}</View>
              ))}

              {/* Active tool indicator (live) */}
              {isLastAssistant && isStreaming && activeTool && (
                <View>{renderToolIndicator(activeTool)}</View>
              )}

              {/* Message content */}
              {isUser ? (
                <Text style={[styles.userText, { color: colors.primaryForeground }]}>
                  {item.content}
                </Text>
              ) : item.content ? (
                <Markdown style={markdownStyles}>{item.content}</Markdown>
              ) : isStreaming && isLastAssistant ? (
                <View style={styles.typingRow}>
                  <Loading size="small" />
                  <Text style={[styles.typingText, { color: colors.foregroundMuted }]}>
                    {t('uncommonApp.chat.thinking')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      );
    },
    [messages.length, isStreaming, activeAgent, activeTool, colors, markdownStyles, t]
  );

  // ---- Chat view -----------------------------------------------------------

  const renderChat = () => (
    <>
      {/* Compact header in chat mode */}
      <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.chatHeaderTop}>{renderQuotaHeader()}</View>
        {renderAgentSelector()}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />
    </>
  );

  // ---- Input bar -----------------------------------------------------------

  const renderInputBar = () => (
    <View
      style={[
        styles.inputBar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
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
          placeholder={t('uncommonApp.chat.placeholder')}
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={4000}
          style={[styles.textInput, { color: colors.foreground }]}
          editable={!isStreaming && isAuthenticated}
        />
        <TouchableOpacity
          onPress={() => sendMessage()}
          disabled={!input.trim() || isStreaming || !isAuthenticated}
          style={[
            styles.sendBtn,
            {
              backgroundColor: input.trim() && !isStreaming ? colors.primary : colors.muted,
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="send"
            size={18}
            color={input.trim() && !isStreaming ? colors.primaryForeground : colors.foregroundMuted}
          />
        </TouchableOpacity>
      </View>
      {!isAuthenticated && (
        <Text style={[styles.authHint, { color: colors.foregroundMuted }]}>
          {t('errors.unauthorized')}
        </Text>
      )}
    </View>
  );

  // =========================================================================
  // Main render
  // =========================================================================

  return (
    <>
      <Stack.Screen
        options={{
          title: t('uncommonApp.title'),
          headerBackTitle: t('common.back'),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {messages.length === 0 ? renderWelcome() : renderChat()}
        {renderInputBar()}
      </KeyboardAvoidingView>
    </>
  );
}

// ===========================================================================
// Styles
// ===========================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
