/**
 * Essay Editor with 6 AI tools
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ComponentProps } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { AnimatedButton, Loading, Modal, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import {
  useColors,
  withOpacity,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
} from '@/utils/theme';
import { AI_REQUEST_TIMEOUT_MS, essayAiRoutes, profileRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';

interface Essay {
  id: string;
  title: string;
  content: string;
  prompt?: string;
  wordCount: number;
  wordLimit?: number;
  status: string;
  type: string;
  schoolName?: string;
  updatedAt: string;
}

interface AIReviewResult {
  overallScore: number;
  scores: { category: string; score: number; feedback: string }[];
  suggestions: string[];
  summary: string;
}

interface AIPolishResult {
  polished: string;
  changes: { original: string; revised: string; reason: string }[];
}

interface AIBrainstormResult {
  ideas: { title: string; description: string }[];
}

interface AIContinueResult {
  continuation: string;
  suggestions: string[];
}

interface AIOpeningResult {
  openings: { style: string; content: string }[];
}

interface AIRewriteResult {
  versions: { style: string; content: string }[];
}

type AITool = 'review' | 'polish' | 'brainstorm' | 'continue' | 'opening' | 'rewrite';

type ToolColorKey = 'warning' | 'info' | 'success' | 'primary' | 'pink' | 'error';

const AI_TOOLS: { id: AITool; icon: string; colorKey: ToolColorKey }[] = [
  { id: 'review', icon: 'star', colorKey: 'warning' },
  { id: 'polish', icon: 'sparkles', colorKey: 'info' },
  { id: 'brainstorm', icon: 'bulb', colorKey: 'success' },
  { id: 'continue', icon: 'arrow-forward', colorKey: 'primary' },
  { id: 'opening', icon: 'flag', colorKey: 'pink' },
  { id: 'rewrite', icon: 'refresh', colorKey: 'error' },
];

export default function EssayEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTool, setActiveTool] = useState<AITool | null>(null);
  const [aiResult, setAiResult] = useState<unknown>(null);
  const [rewriteInstructions, setRewriteInstructions] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const contentInputRef = useRef<TextInput>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load essay
  const { data: essay, isLoading } = useQuery({
    queryKey: ['essay', id],
    queryFn: () => apiClient.get<Essay>(`${profileRoutes.me()}/essays/${id}`),
    enabled: !isNew && !!id,
  });

  // Set initial values
  useEffect(() => {
    if (essay) {
      setTitle(essay.title);
      setContent(essay.content || '');
    }
  }, [essay]);

  // Word count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // Auto-save
  const triggerAutoSave = useCallback(
    (newContent: string) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        if (!isNew && id) {
          saveMutation.mutate({ title, content: newContent });
        }
      }, 2000);
    },
    [id, isNew, title]
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: { title: string; content: string }) => {
      if (isNew) {
        return apiClient.post(`${profileRoutes.me()}/essays`, {
          ...data,
          type: 'personal_statement',
          status: 'draft',
        });
      }
      return apiClient.put(`${profileRoutes.me()}/essays/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.essays.all });
      setHasChanges(false);
      toast.show({ type: 'success', message: t('essayEditor.saved') });
    },
    onError: () => {
      toast.show({ type: 'error', message: t('essayEditor.saveFailed') });
    },
  });

  // AI mutations
  const reviewMutation = useMutation({
    mutationFn: () =>
      apiClient.post<AIReviewResult>(
        essayAiRoutes.review(),
        { essayId: id },
        { timeout: AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: (data) => {
      setAiResult(data);
      setActiveTool('review');
    },
    onError: () => toast.show({ type: 'error', message: t('essayEditor.aiFailed') }),
  });

  const polishMutation = useMutation({
    mutationFn: () =>
      apiClient.post<AIPolishResult>(
        essayAiRoutes.polish(),
        { essayId: id },
        { timeout: AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: (data) => {
      setAiResult(data);
      setActiveTool('polish');
    },
    onError: () => toast.show({ type: 'error', message: t('essayEditor.aiFailed') }),
  });

  const brainstormMutation = useMutation({
    mutationFn: () =>
      apiClient.post<AIBrainstormResult>(
        essayAiRoutes.brainstorm(),
        { topic: title || content.slice(0, 200) },
        { timeout: AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: (data) => {
      setAiResult(data);
      setActiveTool('brainstorm');
    },
    onError: () => toast.show({ type: 'error', message: t('essayEditor.aiFailed') }),
  });

  const continueMutation = useMutation({
    mutationFn: () =>
      apiClient.post<AIContinueResult>(
        '/essay-ai/continue-writing',
        { essayId: id, content },
        { timeout: AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: (data) => {
      setAiResult(data);
      setActiveTool('continue');
    },
    onError: () => toast.show({ type: 'error', message: t('essayEditor.aiFailed') }),
  });

  const openingMutation = useMutation({
    mutationFn: () =>
      apiClient.post<AIOpeningResult>(
        '/essay-ai/generate-opening',
        { prompt: title },
        { timeout: AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: (data) => {
      setAiResult(data);
      setActiveTool('opening');
    },
    onError: () => toast.show({ type: 'error', message: t('essayEditor.aiFailed') }),
  });

  const rewriteMutation = useMutation({
    mutationFn: (instructions: string) =>
      apiClient.post<AIRewriteResult>(
        '/essay-ai/rewrite-paragraph',
        { paragraph: instructions },
        { timeout: AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: (data) => {
      setAiResult(data);
      setActiveTool('rewrite');
    },
    onError: () => toast.show({ type: 'error', message: t('essayEditor.aiFailed') }),
  });

  const handleAITool = (tool: AITool) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    if (isNew) {
      toast.show({ type: 'warning', message: t('essayEditor.saveFirst') });
      return;
    }

    switch (tool) {
      case 'review':
        reviewMutation.mutate();
        break;
      case 'polish':
        polishMutation.mutate();
        break;
      case 'brainstorm':
        brainstormMutation.mutate();
        break;
      case 'continue':
        continueMutation.mutate();
        break;
      case 'opening':
        openingMutation.mutate();
        break;
      case 'rewrite':
        setActiveTool('rewrite');
        setAiResult(null);
        break;
    }
  };

  const isAnyAILoading =
    reviewMutation.isPending ||
    polishMutation.isPending ||
    brainstormMutation.isPending ||
    continueMutation.isPending ||
    openingMutation.isPending ||
    rewriteMutation.isPending;

  const handleContentChange = (text: string) => {
    setContent(text);
    setHasChanges(true);
    triggerAutoSave(text);
  };

  const handleSave = () => {
    saveMutation.mutate({ title, content });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyText = (text: string) => {
    setContent(text);
    setHasChanges(true);
    setActiveTool(null);
    setAiResult(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show({ type: 'success', message: t('essayEditor.applied') });
  };

  const appendText = (text: string) => {
    const newContent = content + '\n\n' + text;
    setContent(newContent);
    setHasChanges(true);
    setActiveTool(null);
    setAiResult(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show({ type: 'success', message: t('essayEditor.appended') });
  };

  const copyText = (text: string) => {
    Clipboard.setString(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toast.show({ type: 'success', message: t('essayEditor.copied') });
  };

  if (isLoading && !isNew) {
    return <Loading />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header Info */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TextInput
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setHasChanges(true);
          }}
          placeholder={t('essayEditor.titlePlaceholder')}
          placeholderTextColor={colors.foregroundMuted}
          style={[styles.titleInput, { color: colors.foreground }]}
        />
        <View style={styles.headerMeta}>
          <Text style={[styles.wordCountText, { color: colors.foregroundMuted }]}>
            <Text style={styles.wordCountNum}>{wordCount}</Text> {t('essayEditor.words')}
            {essay?.wordLimit ? (
              <Text style={styles.wordCountNum}>{` / ${essay.wordLimit}`}</Text>
            ) : (
              ''
            )}
          </Text>
          {hasChanges && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saveMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.save')}
            >
              <Text style={[styles.saveText, { color: colors.primary }]}>
                {saveMutation.isPending ? t('essayEditor.saving') : t('essayEditor.save')}
              </Text>
            </TouchableOpacity>
          )}
          {!hasChanges && !isNew && (
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          )}
        </View>
      </View>

      {/* Content Editor */}
      <ScrollView
        style={styles.editorScroll}
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingBottom: keyboardVisible ? 120 : insets.bottom + 80 }}
      >
        <TextInput
          ref={contentInputRef}
          value={content}
          onChangeText={handleContentChange}
          placeholder={t('essayEditor.contentPlaceholder')}
          placeholderTextColor={colors.foregroundMuted}
          style={[styles.contentInput, { color: colors.foreground }]}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />
      </ScrollView>

      {/* AI Toolbar */}
      <Animated.View
        entering={FadeInUp.delay(300).springify()}
        style={[
          styles.aiToolbar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: keyboardVisible ? spacing.sm : insets.bottom + spacing.sm,
          },
        ]}
      >
        {isAnyAILoading && (
          <View style={styles.aiLoadingBar}>
            <Text style={[styles.aiLoadingText, { color: colors.primary }]}>
              {t('essayEditor.aiProcessing')}
            </Text>
          </View>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolsRow}
        >
          {AI_TOOLS.map((tool) => {
            const isLoading =
              (tool.id === 'review' && reviewMutation.isPending) ||
              (tool.id === 'polish' && polishMutation.isPending) ||
              (tool.id === 'brainstorm' && brainstormMutation.isPending) ||
              (tool.id === 'continue' && continueMutation.isPending) ||
              (tool.id === 'opening' && openingMutation.isPending) ||
              (tool.id === 'rewrite' && rewriteMutation.isPending);
            const toolColor = colors[tool.colorKey];

            return (
              <TouchableOpacity
                key={tool.id}
                onPress={() => handleAITool(tool.id)}
                disabled={isAnyAILoading}
                accessibilityRole="button"
                accessibilityLabel={t(`essayEditor.tools.${tool.id}`)}
                accessibilityState={{ disabled: isAnyAILoading, busy: isLoading }}
                style={[
                  styles.toolButton,
                  {
                    backgroundColor: withOpacity(toolColor, 0.125),
                    borderColor: withOpacity(toolColor, 0.19),
                    opacity: isAnyAILoading && !isLoading ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={tool.icon as ComponentProps<typeof Ionicons>['name']}
                  size={18}
                  color={toolColor}
                />
                <Text style={[styles.toolLabel, { color: toolColor }]}>
                  {t(`essayEditor.tools.${tool.id}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* AI Result Modals */}
      {/* Review Result */}
      <Modal
        visible={activeTool === 'review' && !!aiResult}
        onClose={() => {
          setActiveTool(null);
          setAiResult(null);
        }}
        title={t('essayEditor.tools.review')}
        fullScreen={false}
      >
        {activeTool === 'review' && aiResult != null ? (
          <ReviewResult result={aiResult as AIReviewResult} colors={colors} t={t} />
        ) : null}
      </Modal>

      {/* Polish Result */}
      <Modal
        visible={activeTool === 'polish' && !!aiResult}
        onClose={() => {
          setActiveTool(null);
          setAiResult(null);
        }}
        title={t('essayEditor.tools.polish')}
        fullScreen={false}
      >
        {activeTool === 'polish' && aiResult != null ? (
          <PolishResult
            result={aiResult as AIPolishResult}
            colors={colors}
            t={t}
            onApply={() => applyText((aiResult as AIPolishResult).polished)}
            onCopy={() => copyText((aiResult as AIPolishResult).polished)}
          />
        ) : null}
      </Modal>

      {/* Brainstorm Result */}
      <Modal
        visible={activeTool === 'brainstorm' && !!aiResult}
        onClose={() => {
          setActiveTool(null);
          setAiResult(null);
        }}
        title={t('essayEditor.tools.brainstorm')}
        fullScreen={false}
      >
        {activeTool === 'brainstorm' && aiResult != null ? (
          <BrainstormResult
            result={aiResult as AIBrainstormResult}
            colors={colors}
            t={t}
            onCopy={copyText}
          />
        ) : null}
      </Modal>

      {/* Continue Result */}
      <Modal
        visible={activeTool === 'continue' && !!aiResult}
        onClose={() => {
          setActiveTool(null);
          setAiResult(null);
        }}
        title={t('essayEditor.tools.continue')}
        fullScreen={false}
      >
        {activeTool === 'continue' && aiResult != null ? (
          <ContinueResult
            result={aiResult as AIContinueResult}
            colors={colors}
            t={t}
            onAppend={() => appendText((aiResult as AIContinueResult).continuation)}
            onCopy={() => copyText((aiResult as AIContinueResult).continuation)}
          />
        ) : null}
      </Modal>

      {/* Opening Result */}
      <Modal
        visible={activeTool === 'opening' && !!aiResult}
        onClose={() => {
          setActiveTool(null);
          setAiResult(null);
        }}
        title={t('essayEditor.tools.opening')}
        fullScreen={false}
      >
        {activeTool === 'opening' && aiResult != null ? (
          <OpeningResult
            result={aiResult as AIOpeningResult}
            colors={colors}
            t={t}
            onApply={applyText}
            onCopy={copyText}
          />
        ) : null}
      </Modal>

      {/* Rewrite - needs instructions input first */}
      <Modal
        visible={activeTool === 'rewrite'}
        onClose={() => {
          setActiveTool(null);
          setAiResult(null);
          setRewriteInstructions('');
        }}
        title={t('essayEditor.tools.rewrite')}
        fullScreen={false}
      >
        {activeTool === 'rewrite' && !aiResult && (
          <View style={styles.rewriteInput}>
            <Text style={[styles.rewriteLabel, { color: colors.foreground }]}>
              {t('essayEditor.rewriteInstructions')}
            </Text>
            <TextInput
              value={rewriteInstructions}
              onChangeText={setRewriteInstructions}
              placeholder={t('essayEditor.rewritePlaceholder')}
              placeholderTextColor={colors.foregroundMuted}
              style={[
                styles.rewriteTextInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                },
              ]}
              multiline
              numberOfLines={3}
            />
            <AnimatedButton
              onPress={() => rewriteMutation.mutate(rewriteInstructions)}
              disabled={!rewriteInstructions.trim() || rewriteMutation.isPending}
              style={styles.rewriteButton}
            >
              {rewriteMutation.isPending
                ? t('essayEditor.aiProcessing')
                : t('essayEditor.rewriteSubmit')}
            </AnimatedButton>
          </View>
        )}
        {activeTool === 'rewrite' && aiResult != null ? (
          <RewriteResult
            result={aiResult as AIRewriteResult}
            colors={colors}
            t={t}
            onApply={applyText}
            onCopy={copyText}
          />
        ) : null}
      </Modal>
    </KeyboardAvoidingView>
  );
}

// Sub-components for AI results

function ReviewResult({
  result,
  colors,
  t,
}: {
  result: AIReviewResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {/* Overall Score */}
      <View
        style={[
          styles.scoreCard,
          { backgroundColor: withOpacity(colors.primary, 0.1), borderColor: colors.border },
        ]}
      >
        <Text style={[styles.scoreValue, { color: colors.primary }]}>{result.overallScore}</Text>
        <Text style={[styles.scoreLabel, { color: colors.foregroundMuted }]}>
          {t('essayEditor.overallScore')}
        </Text>
      </View>

      {/* Category Scores */}
      {result.scores?.map((score, i) => (
        <View key={i} style={[styles.categoryRow, { borderBottomColor: colors.border }]}>
          <View style={styles.categoryInfo}>
            <Text style={[styles.categoryName, { color: colors.foreground }]}>
              {score.category}
            </Text>
            <Text style={[styles.categoryFeedback, { color: colors.foregroundMuted }]}>
              {score.feedback}
            </Text>
          </View>
          <Badge variant={score.score >= 8 ? 'success' : score.score >= 6 ? 'warning' : 'error'}>
            {String(score.score)}/10
          </Badge>
        </View>
      ))}

      {/* Summary */}
      {result.summary && (
        <View style={styles.summarySection}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {t('essayEditor.summary')}
          </Text>
          <Text style={[styles.summaryText, { color: colors.foregroundMuted }]}>
            {result.summary}
          </Text>
        </View>
      )}

      {/* Suggestions */}
      {result.suggestions?.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={[styles.suggestionsTitle, { color: colors.foreground }]}>
            {t('essayEditor.suggestions')}
          </Text>
          {result.suggestions.map((suggestion, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Ionicons name="bulb-outline" size={16} color={colors.warning} />
              <Text style={[styles.suggestionText, { color: colors.foregroundMuted }]}>
                {suggestion}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function PolishResult({
  result,
  colors,
  t,
  onApply,
  onCopy,
}: {
  result: AIPolishResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onApply: () => void;
  onCopy: () => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {/* Changes */}
      {result.changes?.map((change, i) => (
        <View
          key={i}
          style={[styles.changeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text
            style={[
              styles.changeOriginal,
              { color: colors.error, backgroundColor: withOpacity(colors.error, 0.1) },
            ]}
          >
            {change.original}
          </Text>
          <Ionicons
            name="arrow-down"
            size={16}
            color={colors.foregroundMuted}
            style={styles.changeArrow}
          />
          <Text
            style={[
              styles.changeRevised,
              { color: colors.success, backgroundColor: withOpacity(colors.success, 0.1) },
            ]}
          >
            {change.revised}
          </Text>
          <Text style={[styles.changeReason, { color: colors.foregroundMuted }]}>
            {change.reason}
          </Text>
        </View>
      ))}

      <View style={styles.resultActions}>
        <AnimatedButton onPress={onApply} style={styles.resultActionBtn}>
          {t('essayEditor.applyChanges')}
        </AnimatedButton>
        <AnimatedButton onPress={onCopy} variant="outline" style={styles.resultActionBtn}>
          {t('essayEditor.copy')}
        </AnimatedButton>
      </View>
    </ScrollView>
  );
}

function BrainstormResult({
  result,
  colors,
  t,
  onCopy,
}: {
  result: AIBrainstormResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onCopy: (text: string) => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {result.ideas?.map((idea, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onCopy(idea.description)}
          accessibilityRole="button"
          accessibilityLabel={`${idea.title} — ${t('essayEditor.tapToCopy')}`}
          style={[styles.ideaCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.ideaHeader}>
            <Ionicons name="bulb" size={18} color={colors.warning} />
            <Text style={[styles.ideaTitle, { color: colors.foreground }]}>{idea.title}</Text>
          </View>
          <Text style={[styles.ideaDesc, { color: colors.foregroundMuted }]}>
            {idea.description}
          </Text>
          <Text style={[styles.tapToCopy, { color: colors.primary }]}>
            {t('essayEditor.tapToCopy')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ContinueResult({
  result,
  colors,
  t,
  onAppend,
  onCopy,
}: {
  result: AIContinueResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onAppend: () => void;
  onCopy: () => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      <Text
        style={[
          styles.continuationText,
          { color: colors.foreground, backgroundColor: withOpacity(colors.primary, 0.05) },
        ]}
      >
        {result.continuation}
      </Text>
      {result.suggestions?.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={[styles.suggestionsTitle, { color: colors.foreground }]}>
            {t('essayEditor.suggestions')}
          </Text>
          {result.suggestions.map((s, i) => (
            <Text key={i} style={[styles.suggestionText, { color: colors.foregroundMuted }]}>
              • {s}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.resultActions}>
        <AnimatedButton onPress={onAppend} style={styles.resultActionBtn}>
          {t('essayEditor.appendToEssay')}
        </AnimatedButton>
        <AnimatedButton onPress={onCopy} variant="outline" style={styles.resultActionBtn}>
          {t('essayEditor.copy')}
        </AnimatedButton>
      </View>
    </ScrollView>
  );
}

function OpeningResult({
  result,
  colors,
  t,
  onApply,
  onCopy,
}: {
  result: AIOpeningResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onApply: (text: string) => void;
  onCopy: (text: string) => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {result.openings?.map((opening, i) => (
        <View
          key={i}
          style={[styles.openingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Badge variant="secondary">{opening.style}</Badge>
          <Text style={[styles.openingText, { color: colors.foreground }]}>{opening.content}</Text>
          <View style={styles.openingActions}>
            <TouchableOpacity
              onPress={() => onApply(opening.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.use')}
              hitSlop={8}
              style={[styles.smallAction, { backgroundColor: withOpacity(colors.primary, 0.125) }]}
            >
              <Ionicons name="checkmark" size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary }]}>
                {t('essayEditor.use')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onCopy(opening.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.copy')}
              hitSlop={8}
              style={[
                styles.smallAction,
                { backgroundColor: withOpacity(colors.foregroundMuted, 0.125) },
              ]}
            >
              <Ionicons name="copy" size={16} color={colors.foregroundMuted} />
              <Text style={[styles.smallActionText, { color: colors.foregroundMuted }]}>
                {t('essayEditor.copy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function RewriteResult({
  result,
  colors,
  t,
  onApply,
  onCopy,
}: {
  result: AIRewriteResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onApply: (text: string) => void;
  onCopy: (text: string) => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {result.versions?.map((version, i) => (
        <View
          key={i}
          style={[styles.openingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Badge variant="default">{version.style}</Badge>
          <Text style={[styles.openingText, { color: colors.foreground }]}>{version.content}</Text>
          <View style={styles.openingActions}>
            <TouchableOpacity
              onPress={() => onApply(version.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.use')}
              hitSlop={8}
              style={[styles.smallAction, { backgroundColor: withOpacity(colors.primary, 0.125) }]}
            >
              <Ionicons name="checkmark" size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary }]}>
                {t('essayEditor.use')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onCopy(version.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.copy')}
              hitSlop={8}
              style={[
                styles.smallAction,
                { backgroundColor: withOpacity(colors.foregroundMuted, 0.125) },
              ]}
            >
              <Ionicons name="copy" size={16} color={colors.foregroundMuted} />
              <Text style={[styles.smallActionText, { color: colors.foregroundMuted }]}>
                {t('essayEditor.copy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1 },
  titleInput: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  headerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordCountText: { fontSize: fontSize.sm },
  wordCountNum: { fontFamily: fontFamily.mono },
  saveText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  editorScroll: { flex: 1 },
  contentInput: {
    flex: 1,
    padding: spacing.lg,
    fontSize: fontSize.base,
    lineHeight: 26,
    minHeight: 300,
  },
  aiToolbar: { borderTopWidth: 1, paddingTop: spacing.sm },
  aiLoadingBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  aiLoadingText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  toolsRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  toolLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  resultContainer: { maxHeight: 500, paddingHorizontal: spacing.lg },
  scoreCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  scoreValue: { fontSize: 48, fontWeight: fontWeight.bold, fontFamily: fontFamily.mono },
  scoreLabel: { fontSize: fontSize.sm, marginTop: spacing.xs },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  categoryInfo: { flex: 1, marginRight: spacing.md },
  categoryName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  categoryFeedback: { fontSize: fontSize.sm },
  summarySection: { marginTop: spacing.lg },
  summaryTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  summaryText: { fontSize: fontSize.sm, lineHeight: 22 },
  suggestionsSection: { marginTop: spacing.lg },
  suggestionsTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  suggestionText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
  changeCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  changeOriginal: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    fontSize: fontSize.sm,
    overflow: 'hidden',
  },
  changeArrow: { alignSelf: 'center', marginVertical: spacing.xs },
  changeRevised: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    fontSize: fontSize.sm,
    overflow: 'hidden',
  },
  changeReason: { fontSize: fontSize.xs, marginTop: spacing.sm, fontStyle: 'italic' },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  resultActionBtn: { flex: 1 },
  ideaCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  ideaTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  ideaDesc: { fontSize: fontSize.sm, lineHeight: 20 },
  tapToCopy: { fontSize: fontSize.xs, marginTop: spacing.sm },
  continuationText: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    fontSize: fontSize.base,
    lineHeight: 26,
  },
  rewriteInput: { paddingHorizontal: spacing.lg },
  rewriteLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  rewriteTextInput: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: fontSize.base,
    minHeight: 80,
    marginBottom: spacing.md,
  },
  rewriteButton: { marginBottom: spacing.lg },
  openingCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  openingText: { fontSize: fontSize.sm, lineHeight: 22, marginVertical: spacing.sm },
  openingActions: { flexDirection: 'row', gap: spacing.sm },
  smallAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  smallActionText: { fontSize: fontSize.sm },
});
