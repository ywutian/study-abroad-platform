'use client';

import { useState, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
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

export function useEssayManager() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
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

  const essayForm = useForm<EssayFormData>({
    resolver: zodResolver(createEssaySchema(t)),
    defaultValues: { title: '', prompt: '', content: '' },
  });

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
    queryFn: () => apiClient.get<Essay[]>('/profiles/me/essays'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; prompt?: string; content: string }) =>
      apiClient.post<Essay>('/profiles/me/essays', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      essayForm.reset();
      toast.success(t('essays.toast.saved'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { title: string; prompt?: string; content: string };
    }) => apiClient.put<Essay>(`/profiles/me/essays/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      setSelectedEssay(null);
      essayForm.reset();
      toast.success(t('essays.toast.updated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/essays/${id}`),
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
  const getWordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  const handleCreate = () => {
    essayForm.reset({ title: '', prompt: '', content: '' });
    setSelectedEssay(null);
    setIsFormOpen(true);
  };

  const handleEdit = (essay: Essay) => {
    essayForm.reset({ title: essay.title, prompt: essay.prompt || '', content: essay.content });
    setSelectedEssay(essay);
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
    };
    if (selectedEssay) {
      updateMutation.mutate({ id: selectedEssay.id, data });
    } else {
      createMutation.mutate(data);
    }
  });

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

    // Form dialogs
    isFormOpen,
    setIsFormOpen,
    isDeleteOpen,
    setIsDeleteOpen,
    essayToDelete,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
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
