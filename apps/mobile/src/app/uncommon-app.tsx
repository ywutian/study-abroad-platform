import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, type Href } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedCard, Badge, Loading, ProgressBar } from '@/components/ui';
import { CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAiAgentConversation } from '@/hooks/useAiAgentConversation';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import type { AiChatMessage } from '@/types';
import { borderRadius, fontSize, fontWeight, spacing, useColors, withOpacity } from '@/utils/theme';
import {
  AI_REQUEST_TIMEOUT_MS,
  API_ROUTES,
  profileRoutes,
  recommendationRoutes,
  schoolListRoutes,
  type AIAnalysisResult,
  type RecommendationPreflight,
  type RecommendationResult,
} from '@study-abroad/shared';
import { MetricTile } from '@/components/features/uncommon-app/MetricTile';
import { styles } from './uncommon-app.styles';

import type {
  AgentChip,
  AgentMode,
  PredictionDashboard,
  ProfileSummary,
  QuickAction,
  QuotaData,
  SchoolListItem,
} from './uncommon-app.types';

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
  const [input, setInput] = useState('');
  const [agentMode, setAgentMode] = useState<AgentMode>('auto');
  const {
    messages,
    isStreaming,
    activeAgent,
    activeTool,
    pendingApproval,
    approvalBusy,
    resumeApproval,
    rejectApproval,
    cancelRun,
    sendMessage,
    resetConversation,
  } = useAiAgentConversation({
    input,
    setInput,
    isAuthenticated,
    agentMode,
    toast,
    t,
    queryClient,
  });

  // ---- Queries -------------------------------------------------------------
  const { data: quota } = useQuery<QuotaData>({
    queryKey: ['ai-agent', 'quota'],
    queryFn: () => apiClient.get(`${API_ROUTES.AI_AGENT}/quota`),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: profile } = useQuery<ProfileSummary>({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get(profileRoutes.me()),
    enabled: isAuthenticated,
  });

  const { data: schoolList } = useQuery<SchoolListItem[]>({
    queryKey: qk.schoolList.all,
    queryFn: () => apiClient.get(schoolListRoutes.list()),
    enabled: isAuthenticated,
  });

  const { data: predictionDashboard } = useQuery<PredictionDashboard>({
    queryKey: qk.predictions.dashboard,
    queryFn: () => apiClient.get(`${API_ROUTES.PREDICTIONS}/dashboard`),
    enabled: isAuthenticated,
  });

  const { data: recommendationPreflight } = useQuery<RecommendationPreflight>({
    queryKey: qk.recommendation.preflight(),
    queryFn: () => apiClient.get(recommendationRoutes.preflight()),
    enabled: isAuthenticated,
  });

  const { data: recommendationHistory } = useQuery<RecommendationResult[]>({
    queryKey: qk.recommendation.history(),
    queryFn: () => apiClient.get(recommendationRoutes.history()),
    enabled: isAuthenticated,
  });

  const [generatedAnalysis, setGeneratedAnalysis] = useState<AIAnalysisResult | null>(null);
  const cachedAnalysis = queryClient.getQueryData<AIAnalysisResult>(qk.profile.aiAnalysis());
  const applicationAnalysis = generatedAnalysis ?? cachedAnalysis ?? null;

  const profileScore = useMemo(() => {
    if (!profile) return 0;
    return (
      (profile.gpa ? 20 : 0) +
      ((profile.testScores?.length ?? 0) > 0 ? 30 : 0) +
      ((profile.activities?.length ?? 0) > 0 ? 25 : 0) +
      ((profile.awards?.length ?? 0) > 0 ? 25 : 0)
    );
  }, [profile]);

  const schoolCount = schoolList?.length ?? predictionDashboard?.totalSchools ?? 0;
  const essayPromptCount =
    schoolList?.reduce((sum, item) => sum + (item.essayPromptCount ?? 0), 0) ?? 0;
  const recommendationCount = recommendationHistory?.[0]?.recommendations?.length ?? 0;

  // ---- Clear conversation mutation -----------------------------------------
  const clearMutation = useMutation({
    mutationFn: () => apiClient.delete(`${API_ROUTES.AI_AGENT}/conversation`),
    onSuccess: () => {
      resetConversation();
      queryClient.invalidateQueries({ queryKey: ['ai-agent'] });
      toast.success(t('uncommonApp.conversationCleared'));
    },
    onError: () => {
      toast.error(t('uncommonApp.clearError'));
    },
  });

  const analysisMutation = useMutation({
    mutationFn: () =>
      apiClient.get<AIAnalysisResult>(profileRoutes.aiAnalysis(), {
        timeout: AI_REQUEST_TIMEOUT_MS,
      }),
    onSuccess: (data) => {
      setGeneratedAnalysis(data);
      queryClient.setQueryData(qk.profile.aiAnalysis(), data);
      toast.success(t('uncommonApp.dashboard.analysisGenerated'));
    },
    onError: () => {
      toast.error(t('uncommonApp.dashboard.analysisFailed'));
    },
  });

  const recommendationMutation = useMutation({
    mutationFn: () =>
      apiClient.post<RecommendationResult>(
        recommendationRoutes.generate(),
        {
          schoolCount: 8,
          additionalPreferences:
            'Build a balanced application portfolio with reach, match, and safety options.',
        },
        { timeout: AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.recommendation.history() });
      queryClient.invalidateQueries({ queryKey: qk.recommendation.preflight() });
      toast.success(t('recommendation.generateSuccess'));
    },
    onError: () => {
      toast.error(t('recommendation.generateFailed'));
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
        titleKey: 'uncommonApp.quickActions.timelinePlan',
        descKey: 'uncommonApp.quickActions.timelinePlanDesc',
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

  // ---- Quick action handler ------------------------------------------------
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      setAgentMode(action.agent);
      sendMessage(action.prompt, action.agent);
    },
    [sendMessage]
  );

  // ---- Agent label helper --------------------------------------------------
  const getAgentLabel = useCallback(
    (agent?: string): string => {
      if (!agent) return '';
      const map: Record<string, string> = {
        orchestrator: t('uncommonApp.agents.auto'),
        essay: t('uncommonApp.agents.essay'),
        school: t('uncommonApp.agents.school'),
        profile: t('uncommonApp.agents.profile'),
        timeline: t('uncommonApp.agents.timeline'),
      };
      return map[agent] || agent;
    },
    [t]
  );

  // ---- Quota percentage ----------------------------------------------------
  const quotaPercent = quota ? Math.round((quota.used / quota.limit) * 100) : 0;
  const quotaColor =
    quotaPercent > 90 ? colors.error : quotaPercent > 70 ? colors.warning : colors.primary;

  // =========================================================================
  // Render helpers
  // =========================================================================

  const handleGenerateRecommendation = () => {
    if (recommendationPreflight && !recommendationPreflight.canGenerate) {
      toast.warning(t('uncommonApp.dashboard.recommendationBlocked'));
      router.push('/recommendation' as Href);
      return;
    }
    recommendationMutation.mutate();
  };

  const renderApplicationDashboard = () => (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View
        style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={[styles.dashboardEyebrow, { color: colors.foregroundMuted }]}>
              {t('uncommonApp.dashboard.eyebrow')}
            </Text>
            <Text style={[styles.dashboardTitle, { color: colors.foreground }]}>
              {t('uncommonApp.dashboard.title')}
            </Text>
          </View>
          <Badge variant={applicationAnalysis ? 'success' : 'secondary'}>
            {applicationAnalysis
              ? t(`applicationAnalysis.freshness.${applicationAnalysis.status ?? 'fresh'}`)
              : t('uncommonApp.dashboard.manual')}
          </Badge>
        </View>

        <Text style={[styles.dashboardSummary, { color: colors.foregroundMuted }]}>
          {applicationAnalysis?.overallVerdict ??
            applicationAnalysis?.portfolioSummary?.verdict ??
            t('uncommonApp.dashboard.description')}
        </Text>

        <View style={styles.metricGrid}>
          <MetricTile
            icon="person-outline"
            label={t('uncommonApp.dashboard.profile')}
            value={`${profileScore}%`}
            color={colors.primary}
          />
          <MetricTile
            icon="school-outline"
            label={t('uncommonApp.dashboard.schools')}
            value={String(schoolCount)}
            color={colors.info}
          />
          <MetricTile
            icon="document-text-outline"
            label={t('uncommonApp.dashboard.essays')}
            value={String(essayPromptCount)}
            color={colors.success}
          />
          <MetricTile
            icon="sparkles-outline"
            label={t('uncommonApp.dashboard.recommendations')}
            value={String(recommendationCount)}
            color={colors.warning}
          />
        </View>

        <View style={styles.dashboardActions}>
          <TouchableOpacity
            onPress={() => analysisMutation.mutate()}
            disabled={analysisMutation.isPending || !isAuthenticated}
            style={[styles.dashboardButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('uncommonApp.dashboard.generateAnalysis')}
          >
            {analysisMutation.isPending ? (
              <Loading size="small" />
            ) : (
              <Ionicons name="analytics-outline" size={16} color={colors.primaryForeground} />
            )}
            <Text style={[styles.dashboardButtonText, { color: colors.primaryForeground }]}>
              {analysisMutation.isPending
                ? t('uncommonApp.dashboard.analyzing')
                : t('uncommonApp.dashboard.generateAnalysis')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGenerateRecommendation}
            disabled={recommendationMutation.isPending || !isAuthenticated}
            style={[
              styles.dashboardButton,
              styles.dashboardButtonSecondary,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('uncommonApp.dashboard.generateRecommendations')}
          >
            {recommendationMutation.isPending ? (
              <Loading size="small" />
            ) : (
              <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            )}
            <Text style={[styles.dashboardButtonText, { color: colors.primary }]}>
              {recommendationMutation.isPending
                ? t('recommendation.loadingStep4')
                : t('uncommonApp.dashboard.generateRecommendations')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.taskList}>
          {[
            {
              done: profileScore >= 80,
              text: t('uncommonApp.dashboard.tasks.profile'),
              href: '/profile/basic',
            },
            {
              done: schoolCount >= 6,
              text: t('uncommonApp.dashboard.tasks.schools'),
              href: '/find-college',
            },
            {
              done: essayPromptCount > 0,
              text: t('uncommonApp.dashboard.tasks.essays'),
              href: '/essays',
            },
            {
              done: Boolean(applicationAnalysis),
              text: t('uncommonApp.dashboard.tasks.strategy'),
              href: '/profile/analysis',
            },
          ].map((task) => (
            <TouchableOpacity
              key={task.href}
              onPress={() => router.push(task.href as Href)}
              style={styles.taskRow}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={task.text}
            >
              <Ionicons
                name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={task.done ? colors.success : colors.warning}
              />
              <Text style={[styles.taskText, { color: colors.foreground }]}>{task.text}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.foregroundMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );

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
              accessibilityRole="button"
              accessibilityLabel={t('uncommonApp.chat.clearChat')}
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
              accessibilityRole="button"
              accessibilityLabel={chip.label}
              accessibilityState={{ selected: isActive }}
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
        {quickActions.map((action) => (
          <AnimatedCard
            key={action.agent}
            onPress={() => handleQuickAction(action)}
            style={[styles.quickActionCard, { borderColor: colors.border }]}
            accessibilityLabel={t(action.titleKey)}
          >
            <CardContent style={styles.quickActionContent}>
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: withOpacity(action.color, 0.08) },
                ]}
              >
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
      {renderApplicationDashboard()}
      {renderQuotaHeader()}
      {renderAgentSelector()}
      {renderQuickActions()}

      {/* Welcome message */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.welcomeSection}>
        <View style={[styles.welcomeIcon, { backgroundColor: withOpacity(colors.primary, 0.08) }]}>
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

  const renderToolIndicator = useCallback(
    (toolName: string, status?: string) => (
      <View style={[styles.toolIndicator, { backgroundColor: colors.muted }]}>
        <Ionicons
          name={status === 'done' ? 'checkmark-circle' : 'cog'}
          size={14}
          color={status === 'done' ? colors.success : colors.foregroundMuted}
        />
        <Text style={[styles.toolIndicatorText, { color: colors.foregroundMuted }]}>
          {toolName}
        </Text>
        {status !== 'done' && <Loading size="small" />}
      </View>
    ),
    [colors.foregroundMuted, colors.muted, colors.success]
  );

  const renderAgentBadge = useCallback(
    (agent: string) => (
      <View style={styles.agentBadgeRow}>
        <Badge variant="secondary">
          <Text style={[styles.agentBadgeText, { color: colors.primary }]}>
            {getAgentLabel(agent)}
          </Text>
        </Badge>
      </View>
    ),
    [colors.primary, getAgentLabel]
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
                  : [
                      styles.assistantBubble,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ],
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
    [
      messages.length,
      isStreaming,
      activeAgent,
      activeTool,
      colors,
      markdownStyles,
      renderAgentBadge,
      renderToolIndicator,
      t,
    ]
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
      {pendingApproval && (
        <View
          style={[
            styles.approvalCard,
            {
              borderColor: colors.warning,
              backgroundColor: withOpacity(colors.warning, 0.08),
            },
          ]}
        >
          <Text style={{ color: colors.foreground, fontWeight: fontWeight.semibold }}>
            {t('ai.chat.approval.title')}
          </Text>
          <Text style={{ color: colors.foregroundMuted, marginTop: spacing.xs }}>
            {t('ai.chat.approval.description', { tool: pendingApproval.toolName })}
          </Text>
          <Text
            numberOfLines={4}
            style={{
              color: colors.foregroundMuted,
              marginTop: spacing.sm,
              fontSize: fontSize.xs,
            }}
          >
            {JSON.stringify(pendingApproval.arguments, null, 2)}
          </Text>
          <Text
            style={{ color: colors.foregroundMuted, marginTop: spacing.xs, fontSize: fontSize.xs }}
          >
            {t('ai.chat.approval.expiresAt', {
              time: new Date(pendingApproval.expiresAt).toLocaleString(),
            })}
          </Text>
          <View style={styles.approvalActions}>
            <TouchableOpacity onPress={() => void resumeApproval()} disabled={approvalBusy}>
              <Text style={{ color: colors.primary }}>{t('ai.chat.approval.approve')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void rejectApproval()} disabled={approvalBusy}>
              <Text style={{ color: colors.foreground }}>{t('ai.chat.approval.reject')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void cancelRun()} disabled={approvalBusy}>
              <Text style={{ color: colors.foregroundMuted }}>{t('ai.chat.approval.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
