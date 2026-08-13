/**
 * Essay Editor with 6 AI tools
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clipboard,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton, Loading, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { spacing, useColors, withOpacity } from '@/utils/theme';
import { AI_REQUEST_TIMEOUT_MS, essayAiRoutes, profileRoutes } from '@study-abroad/shared';
import {
  BrainstormResult,
  ContinueResult,
  OpeningResult,
  PolishResult,
  ReviewResult,
  RewriteResult,
} from './EssayEditorResults';
import { styles } from './EssayEditorScreen.styles';

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

export interface AIReviewResult {
  overallScore: number;
  scores: { category: string; score: number; feedback: string }[];
  suggestions: string[];
  summary: string;
}

export interface AIPolishResult {
  polished: string;
  changes: { original: string; revised: string; reason: string }[];
}

export interface AIBrainstormResult {
  ideas: { title: string; description: string }[];
}

export interface AIContinueResult {
  continuation: string;
  suggestions: string[];
}

export interface AIOpeningResult {
  openings: { style: string; content: string }[];
}

export interface AIRewriteResult {
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

  // Auto-save is declared after the mutation so the closure always sees the
  // current mutation object and the latest title.
  const triggerAutoSave = useCallback(
    (newContent: string) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        if (!isNew && id) {
          saveMutation.mutate({ title, content: newContent });
        }
      }, 2000);
    },
    [id, isNew, saveMutation, title]
  );

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
        contentContainerStyle={[
          styles.editorContent,
          keyboardVisible ? styles.editorContentKeyboard : { paddingBottom: insets.bottom + 80 },
        ]}
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
                  },
                  isAnyAILoading && !isLoading && styles.dimmedTool,
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
