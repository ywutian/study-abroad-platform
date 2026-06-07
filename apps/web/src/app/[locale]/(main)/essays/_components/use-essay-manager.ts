'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import {
  useEssayReview,
  useEssayPolish,
  useEssayRewrite,
  useEssayContinue,
  useEssayOpening,
} from '@/hooks/use-essay-ai';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEssaySchema, type EssayFormData } from '@/lib/validations/essay';
import type {
  Essay,
  EssayReview,
  PolishResult,
  RewriteResult,
  ContinueResult,
  OpeningResult,
} from '@/types/essay';
import { toast } from 'sonner';

export function useEssayManager(
  initialSchoolId?: string | null,
  initialPromptId?: string | null,
  /**
   * Gallery → Workbench attribution (PR 2 · §E). When the user clicks
   * "用此 prompt 写一篇" on a gallery essay, the source `AdmissionCase.id`
   * is passed here and stamped onto the `Essay.inspirationCaseId` FK on
   * create. Cross-stage links (gallery cohort dashboards in Phase 2)
   * read this field. Only honoured on the first create — intentionally
   * not threaded into updateMutation.
   */
  initialInspirationId?: string | null,
  /**
   * Plain-text prompt prefill from the gallery CTA. When set, we open
   * the create form with the prompt pre-populated AND skip the prompt
   * picker — the user already chose a prompt by clicking on a gallery
   * essay. Distinct from `initialPromptId`, which links to a verified
   * EssayPrompt row by id.
   */
  initialPromptText?: string | null
) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const authReady = useAuthReady();

  const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Fetch prompt data when navigated with promptId
  const { data: initialPrompt } = useQuery({
    queryKey: ['essayPrompt', initialPromptId],
    queryFn: () =>
      apiClient.get<{
        id: string;
        schoolId?: string;
        schoolName?: string;
        type?: string;
        prompt?: string;
        promptZh?: string;
        wordLimit?: number;
      }>(`/essay-prompts/${initialPromptId}`),
    enabled: !!initialPromptId,
  });

  // Auto-open create form when navigated with schoolId (but not promptId — that has its own effect)
  useEffect(() => {
    if (initialSchoolId && !initialPromptId) {
      setIsFormOpen(true);
    }
  }, [initialSchoolId, initialPromptId]);

  // Gallery → Workbench deep-link: when arriving with `?prompt=<text>`
  // (and optionally `inspirationId=<caseId>`), open the create form with
  // the prompt prefilled. We intentionally don't auto-submit — the user
  // still needs to draft content. Runs once on mount; if the user later
  // navigates away and back without these params, we leave things alone.
  useEffect(() => {
    if (initialPromptText && !initialPromptId) {
      setIsFormOpen(true);
      essayForm.setValue('prompt', initialPromptText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [essayToDelete, setEssayToDelete] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewResult, setReviewResult] = useState<EssayReview | null>(null);

  // AI state
  const [isPolishOpen, setIsPolishOpen] = useState(false);
  const [polishResult, setPolishResult] = useState<PolishResult | null>(null);
  const [polishStyle] = useState<'formal' | 'vivid' | 'concise'>('formal');
  const [isRewriteOpen, setIsRewriteOpen] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [isContinueOpen, setIsContinueOpen] = useState(false);
  const [continueResult, setContinueResult] = useState<ContinueResult | null>(null);
  const [continueDirection] = useState('');
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingResult, setOpeningResult] = useState<OpeningResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isBrainstormOpen, setIsBrainstormOpen] = useState(false);
  const [essayPromptId, setEssayPromptId] = useState<string | null>(null);
  const [autoOpenPromptSelector, setAutoOpenPromptSelector] = useState(false);

  const essayForm = useForm<EssayFormData>({
    resolver: zodResolver(createEssaySchema(t)),
    defaultValues: { title: '', prompt: '', content: '' },
  });

  // Auto-fill form when navigated with promptId and prompt data loads
  useEffect(() => {
    if (initialPrompt && initialPromptId) {
      setIsFormOpen(true);
      setEssayPromptId(initialPromptId);
      const typeLabel = initialPrompt.type || '';
      essayForm.setValue(
        'title',
        `${initialPrompt.schoolName || ''} - ${typeLabel}`.trim().replace(/^- /, '')
      );
      essayForm.setValue('prompt', initialPrompt.prompt || '');
    }
  }, [initialPrompt, initialPromptId, essayForm]);

  const randomOffsetsRef = useRef({
    originality: Math.random() * 2,
    impact: Math.random() * 1.5,
    relevance: Math.random() * 1,
  });

  const derivedScores = useMemo(() => {
    if (!reviewResult) return null;
    const offsets = randomOffsetsRef.current;
    return {
      originality: Math.min(10, Math.max(0, reviewResult.overallScore - 1 + offsets.originality)),
      impact: Math.min(10, Math.max(0, reviewResult.overallScore - 0.5 + offsets.impact)),
      relevance: Math.min(10, Math.max(0, reviewResult.overallScore + offsets.relevance)),
    };
  }, [reviewResult]);

  // Queries & Mutations
  const { data: essays, isLoading } = useQuery({
    queryKey: ['essays'],
    queryFn: () => apiClient.get<Essay[]>(profileRoutes.essays()),
    enabled: authReady,
  });

  useEffect(() => {
    if (!essays?.length) {
      if (selectedEssay) setSelectedEssay(null);
      return;
    }

    if (!selectedEssay) {
      setSelectedEssay(essays[0]);
      return;
    }

    const refreshed = essays.find((essay) => essay.id === selectedEssay.id);
    if (refreshed && refreshed.updatedAt !== selectedEssay.updatedAt) {
      setSelectedEssay(refreshed);
    }
  }, [essays, selectedEssay]);

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      prompt?: string;
      content: string;
      essayPromptId?: string;
      inspirationCaseId?: string;
    }) => apiClient.post<Essay>(profileRoutes.essays(), data),
    onSuccess: (createdEssay) => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setSelectedEssay(createdEssay);
      setIsFormOpen(false);
      essayForm.reset();
      setEssayPromptId(null);
      toast.success(t('essays.toast.saved'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { title: string; prompt?: string; content: string; essayPromptId?: string };
      silent?: boolean;
    }) => apiClient.put<Essay>(profileRoutes.essay(id), data),
    onSuccess: (updatedEssay, variables) => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setSelectedEssay(updatedEssay);
      if (!variables.silent) {
        setIsFormOpen(false);
        essayForm.reset();
        setEssayPromptId(null);
        toast.success(t('essays.toast.updated'));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(profileRoutes.essay(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsDeleteOpen(false);
      setEssayToDelete(null);
      if (selectedEssay?.id === essayToDelete) setSelectedEssay(null);
      toast.success(t('essays.toast.deleted'));
    },
  });

  const reviewMutation = useEssayReview((data) => {
    setReviewResult(data);
    setIsReviewOpen(true);
  });

  const polishMutation = useEssayPolish((data) => {
    setPolishResult(data);
    setIsPolishOpen(true);
  });

  const rewriteMutation = useEssayRewrite((data) => {
    setRewriteResult(data);
    setIsRewriteOpen(true);
  });

  const continueMutation = useEssayContinue((data) => {
    setContinueResult(data);
    setIsContinueOpen(true);
  });

  const openingMutation = useEssayOpening((data) => {
    setOpeningResult(data);
    setIsOpeningOpen(true);
  });

  // Handlers
  const getWordCount = (text?: string | null) => (text ?? '').split(/\s+/).filter(Boolean).length;

  const handleCreate = () => {
    essayForm.reset({ title: '', prompt: '', content: '' });
    setSelectedEssay(null);
    setEssayPromptId(null);
    setAutoOpenPromptSelector(false);
    setIsFormOpen(true);
  };

  const handleCreateFromPrompt = () => {
    essayForm.reset({ title: '', prompt: '', content: '' });
    setSelectedEssay(null);
    setEssayPromptId(null);
    setAutoOpenPromptSelector(true);
    setIsFormOpen(true);
  };

  const handleEdit = (essay: Essay) => {
    essayForm.reset({ title: essay.title, prompt: essay.prompt || '', content: essay.content });
    setSelectedEssay(essay);
    setEssayPromptId(essay.essayPromptId ?? null);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setEssayToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleSubmit = essayForm.handleSubmit((values) => {
    const data = {
      title: values.title,
      prompt: values.prompt || undefined,
      content: values.content,
      essayPromptId: essayPromptId || undefined,
    };
    if (selectedEssay) {
      updateMutation.mutate({ id: selectedEssay.id, data });
    } else {
      // Gallery → Workbench attribution (PR 2 · §E). Only set on first
      // create; the inspiration is a creation-time fact and we don't
      // retroactively rewrite it on update.
      createMutation.mutate({
        ...data,
        inspirationCaseId: initialInspirationId || undefined,
      });
    }
  });

  const saveEssay = useCallback(
    (
      id: string,
      data: { title: string; prompt?: string; content: string; essayPromptId?: string },
      silent = true
    ) => {
      updateMutation.mutate({ id, data, silent });
    },
    [updateMutation]
  );

  const handleReview = (essay: Essay) => {
    if (!essay.content) {
      toast.error(t('essays.toast.contentRequired'));
      return;
    }
    reviewMutation.mutate({ essayId: essay.id });
  };

  const handlePolish = (essay: Essay) => {
    if (!essay.content) {
      toast.error(t('essays.toast.contentRequired'));
      return;
    }
    polishMutation.mutate({ essayId: essay.id, style: polishStyle });
  };

  const handleRewrite = () => {
    if (!selectedText) {
      toast.error(t('essays.toast.selectParagraph'));
      return;
    }
    rewriteMutation.mutate({
      paragraph: selectedText,
      instruction: rewriteInstruction || undefined,
    });
  };

  const handleContinue = (essay: Essay) => {
    if (!essay.content) {
      toast.error(t('essays.toast.contentRequired'));
      return;
    }
    continueMutation.mutate({
      content: essay.content,
      prompt: essay.prompt,
      direction: continueDirection || undefined,
    });
  };

  const handleGenerateOpening = (essay: Essay) => {
    if (!essay.prompt && !essay.title) {
      toast.error(t('essays.toast.promptRequired'));
      return;
    }
    openingMutation.mutate({ prompt: essay.prompt || essay.title });
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success(t('essays.toast.copied'));
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const applyPolishedContent = () => {
    if (polishResult && selectedEssay) {
      essayForm.reset({
        title: selectedEssay.title,
        prompt: selectedEssay.prompt || '',
        content: polishResult.polished,
      });
      setSelectedEssay({ ...selectedEssay, content: polishResult.polished });
      updateMutation.mutate({
        id: selectedEssay.id,
        data: {
          title: selectedEssay.title,
          prompt: selectedEssay.prompt,
          content: polishResult.polished,
        },
      });
      setIsPolishOpen(false);
      toast.success(t('essays.toast.polishApplied'));
    }
  };

  const appendContinuation = () => {
    if (continueResult && selectedEssay) {
      const newContent = selectedEssay.content + '\n\n' + continueResult.continuation;
      updateMutation.mutate({
        id: selectedEssay.id,
        data: { title: selectedEssay.title, prompt: selectedEssay.prompt, content: newContent },
      });
      setIsContinueOpen(false);
      toast.success(t('essays.toast.continuationAdded'));
    }
  };

  return {
    // Data
    essays,
    isLoading,
    selectedEssay,
    setSelectedEssay,
    essayForm,
    derivedScores,
    getWordCount,

    // Prompt linking
    essayPromptId,
    setEssayPromptId,
    initialSchoolId: initialSchoolId ?? null,

    // Form dialogs
    isFormOpen,
    setIsFormOpen,
    isDeleteOpen,
    setIsDeleteOpen,
    essayToDelete,
    handleCreate,
    handleCreateFromPrompt,
    autoOpenPromptSelector,
    handleEdit,
    handleDelete,
    handleSubmit,
    saveEssay,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    confirmDelete: () => essayToDelete && deleteMutation.mutate(essayToDelete),

    // AI dialogs
    isReviewOpen,
    setIsReviewOpen,
    reviewResult,
    isPolishOpen,
    setIsPolishOpen,
    polishResult,
    isContinueOpen,
    setIsContinueOpen,
    continueResult,
    isOpeningOpen,
    setIsOpeningOpen,
    openingResult,
    isRewriteOpen,
    setIsRewriteOpen,
    rewriteResult,
    copiedIndex,
    isBrainstormOpen,
    setIsBrainstormOpen,

    // AI handlers
    handleReview,
    handlePolish,
    handleRewrite,
    handleContinue,
    handleGenerateOpening,
    copyToClipboard,
    applyPolishedContent,
    appendContinuation,
    setSelectedText,
    setRewriteInstruction,

    // Mutation states
    reviewMutation,
    polishMutation,
    rewriteMutation,
    continueMutation,
    openingMutation,
    updateMutation,
  };
}
