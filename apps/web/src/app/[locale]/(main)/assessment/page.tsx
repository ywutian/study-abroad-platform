'use client';

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileClock,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageCircle,
  Save,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { assessmentRoutes, profileRoutes } from '@study-abroad/shared';
import { AiAssistantPanel, type ContextAction } from '@/components/features/agent-chat';
import { PageContainer, PageHeader } from '@/components/layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import { useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type {
  Assessment,
  AssessmentDraft,
  AssessmentKind,
  AssessmentResult,
  AssessmentSummary,
  AssessmentTab,
} from './_components/assessment-constants';
import { isLikertQuestion } from './_components/assessment-constants';
import { AssessmentIntro } from './_components/assessment-intro';
import { AssessmentQuestion } from './_components/assessment-question';
import { AssessmentMbtiResult } from './_components/assessment-mbti-result';
import { AssessmentHollandResult } from './_components/assessment-holland-result';
import { AssessmentHistory } from './_components/assessment-history';

type ApiAssessmentType = 'MBTI' | 'HOLLAND';

interface ProfileSnapshot {
  targetMajor?: string | null;
  intendedMajor?: string | null;
  secondMajor?: string | null;
}

const toApiType = (type: AssessmentKind): ApiAssessmentType =>
  type === 'mbti' ? 'MBTI' : 'HOLLAND';

const toKind = (type: string): AssessmentKind => (type === 'HOLLAND' ? 'holland' : 'mbti');

const answersToMap = (draft: AssessmentDraft | null | undefined) =>
  Object.fromEntries((draft?.answers ?? []).map((answer) => [answer.questionId, answer.answer]));

export default function AssessmentPage() {
  const t = useTranslations('assessment');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AssessmentTab>('overview');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<AssessmentResult | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const authReady = useAuthReady();

  const activeAssessmentType: ApiAssessmentType | null =
    activeTab === 'mbti' ? 'MBTI' : activeTab === 'holland' ? 'HOLLAND' : null;

  const summaryQuery = useQuery<AssessmentSummary>({
    queryKey: ['assessment-summary'],
    queryFn: () => apiClient.get(assessmentRoutes.summary()),
    enabled: authReady,
  });

  const profileQuery = useQuery<ProfileSnapshot>({
    queryKey: ['profile', 'assessment-target-major'],
    queryFn: () => apiClient.get(profileRoutes.me()),
    enabled: authReady,
  });

  const mbtiQuery = useQuery<Assessment>({
    queryKey: ['assessment', 'MBTI'],
    queryFn: () => apiClient.get(assessmentRoutes.start('MBTI')),
    enabled: activeTab === 'mbti' && !showResult,
  });

  const hollandQuery = useQuery<Assessment>({
    queryKey: ['assessment', 'HOLLAND'],
    queryFn: () => apiClient.get(assessmentRoutes.start('HOLLAND')),
    enabled: activeTab === 'holland' && !showResult,
  });

  const historyQuery = useQuery<AssessmentResult[]>({
    queryKey: ['assessment-history'],
    queryFn: () => apiClient.get(assessmentRoutes.history()),
    enabled: activeTab === 'history',
  });

  const saveDraftMutation = useMutation({
    mutationFn: ({
      type,
      payload,
    }: {
      type: ApiAssessmentType;
      payload: { answers: { questionId: string; answer: string }[]; currentQuestionIndex: number };
    }) =>
      apiClient.put<AssessmentDraft>(assessmentRoutes.draft(type), payload, {
        suppressErrorToast: true,
      }),
    onSuccess: (draft) => {
      setSaveStatus('saved');
      setLastSavedAt(new Date(draft.updatedAt));
      queryClient.invalidateQueries({ queryKey: ['assessment-summary'] });
    },
    onError: () => setSaveStatus('error'),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (type: ApiAssessmentType) => apiClient.delete(assessmentRoutes.draft(type)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assessment-summary'] }),
  });

  const submitMutation = useMutation({
    mutationFn: (data: {
      type: ApiAssessmentType;
      answers: { questionId: string; answer: string }[];
    }) => apiClient.post<AssessmentResult>(assessmentRoutes.submit(), data),
    onSuccess: (data) => {
      setCurrentResult(data);
      setShowResult(true);
      setSaveStatus('idle');
      setLastSavedAt(null);
      queryClient.invalidateQueries({ queryKey: ['assessment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-history'] });
      toast.success(t('viewResult'));
    },
    onError: () => toast.error(t('submitError')),
  });

  const setTargetMajorMutation = useMutation({
    mutationFn: (major: string) => apiClient.put(profileRoutes.me(), { targetMajor: major }),
    onSuccess: (_, major) => {
      toast.success(t('targetMajor.saved', { major }));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'assessment-target-major'] });
    },
  });
  const saveDraft = saveDraftMutation.mutate;

  const currentAssessment = activeTab === 'mbti' ? mbtiQuery.data : hollandQuery.data;
  const isLoading = activeTab === 'mbti' ? mbtiQuery.isLoading : hollandQuery.isLoading;
  const summary = summaryQuery.data;
  const completedCount =
    Number(Boolean(summary?.latestMbti)) + Number(Boolean(summary?.latestHolland));
  const currentTargetMajor = profileQuery.data?.targetMajor || profileQuery.data?.intendedMajor;

  const handleSelectAnswer = useCallback(
    (questionId: string, value: string, autoAdvance = true) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      setSaveStatus('saving');

      if (
        autoAdvance &&
        currentAssessment?.questions &&
        currentQuestion < currentAssessment.questions.length - 1
      ) {
        setTimeout(() => {
          setCurrentQuestion((prev) => prev + 1);
        }, 260);
      }
    },
    [currentAssessment, currentQuestion]
  );

  const handleNext = useCallback(() => {
    if (currentAssessment && currentQuestion < currentAssessment.questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  }, [currentAssessment, currentQuestion]);

  const handlePrev = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  }, [currentQuestion]);

  const handleSubmit = useCallback(() => {
    if (!currentAssessment || !activeAssessmentType) return;

    const missingIndex = currentAssessment.questions.findIndex((question) => !answers[question.id]);
    if (missingIndex >= 0) {
      setCurrentQuestion(missingIndex);
      toast.error(t('missingAnswers'));
      return;
    }

    const formattedAnswers = currentAssessment.questions.map((question) => ({
      questionId: question.id,
      answer: answers[question.id],
    }));

    submitMutation.mutate({
      type: activeAssessmentType,
      answers: formattedAnswers,
    });
  }, [currentAssessment, activeAssessmentType, answers, submitMutation, t]);

  useEffect(() => {
    if (!activeAssessmentType || !currentAssessment || showResult) return;
    if (Object.keys(answers).length === 0) return;

    const draftAnswers = currentAssessment.questions
      .filter((question) => answers[question.id])
      .map((question) => ({ questionId: question.id, answer: answers[question.id] }));

    const timer = window.setTimeout(() => {
      setSaveStatus('saving');
      saveDraft({
        type: activeAssessmentType,
        payload: {
          answers: draftAnswers,
          currentQuestionIndex: currentQuestion,
        },
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [activeAssessmentType, answers, currentAssessment, currentQuestion, saveDraft, showResult]);

  useEffect(() => {
    if (
      !currentAssessment?.questions ||
      showResult ||
      (activeTab !== 'mbti' && activeTab !== 'holland')
    )
      return;

    const question = currentAssessment.questions[currentQuestion];
    if (!question) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLikertQuestion(question.options)) {
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 5) {
          e.preventDefault();
          handleSelectAnswer(question.id, String(keyNum));
        }
      }

      if (e.key === 'ArrowLeft' && currentQuestion > 0) {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === 'ArrowRight' && currentQuestion < currentAssessment.questions.length - 1) {
        e.preventDefault();
        handleNext();
      }

      if (e.key === 'Enter' && currentQuestion === currentAssessment.questions.length - 1) {
        const allAnswered = currentAssessment.questions.every((q) => answers[q.id]);
        if (allAnswered) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentAssessment,
    currentQuestion,
    showResult,
    activeTab,
    answers,
    handleSelectAnswer,
    handlePrev,
    handleNext,
    handleSubmit,
  ]);

  const loadDraft = useCallback(async (type: ApiAssessmentType) => {
    const draft = await apiClient.get<AssessmentDraft | null>(assessmentRoutes.draft(type));
    setAnswers(answersToMap(draft));
    setCurrentQuestion(draft?.currentQuestionIndex ?? 0);
    setSaveStatus(draft ? 'saved' : 'idle');
    setLastSavedAt(draft ? new Date(draft.updatedAt) : null);
  }, []);

  const handleStartTest = useCallback(
    async (type: AssessmentKind, mode: 'fresh' | 'continue' = 'fresh') => {
      const apiType = toApiType(type);
      const existingDraft = summary?.drafts.find((draft) => draft.type === apiType);

      if (mode === 'fresh' && existingDraft) {
        await deleteDraftMutation.mutateAsync(apiType).catch(() => undefined);
        toast.info(t('draft.restarted'));
      }

      setActiveTab(type);
      setShowResult(false);
      setCurrentResult(null);
      setCurrentQuestion(0);
      setAnswers({});
      setSaveStatus('idle');
      setLastSavedAt(null);

      if (mode === 'continue') {
        await loadDraft(apiType);
      }
    },
    [deleteDraftMutation, loadDraft, summary?.drafts, t]
  );

  const handleRetake = () => {
    setShowResult(false);
    setCurrentResult(null);
    setCurrentQuestion(0);
    setAnswers({});
    setSaveStatus('idle');
    setLastSavedAt(null);
  };

  const handleViewHistoryResult = (result: AssessmentResult) => {
    setCurrentResult(result);
    setShowResult(true);
    setActiveTab(toKind(result.type));
  };

  const handleSetTargetMajor = (major: string) => {
    setTargetMajorMutation.mutate(major);
  };

  const handleStartRecommendation = () => {
    router.push('/schools?tab=recommend');
  };

  const handleExitAssessment = () => {
    setActiveTab('overview');
    setShowResult(false);
    setCurrentResult(null);
  };

  const handleTabChange = (tab: AssessmentTab) => {
    const switchingAssessment =
      (tab === 'mbti' || tab === 'holland') &&
      (activeTab === 'mbti' || activeTab === 'holland') &&
      tab !== activeTab;

    setActiveTab(tab);

    if (switchingAssessment || tab === 'overview' || tab === 'insights' || tab === 'history') {
      setShowResult(false);
      setCurrentResult(null);
      setCurrentQuestion(0);
      setAnswers({});
      setSaveStatus('idle');
      setLastSavedAt(null);
    }
  };

  const canSubmit =
    currentAssessment?.questions &&
    currentAssessment.questions.every((question) => answers[question.id]);

  const aiContextActions = useMemo((): ContextAction[] => {
    const actions: ContextAction[] = [];
    const result = currentResult || summary?.latestMbti || summary?.latestHolland;

    if (result?.mbtiResult) {
      const mbtiScores = `E=${result.mbtiResult.scores.E}%, I=${result.mbtiResult.scores.I}%, S=${result.mbtiResult.scores.S}%, N=${result.mbtiResult.scores.N}%, T=${result.mbtiResult.scores.T}%, F=${result.mbtiResult.scores.F}%, J=${result.mbtiResult.scores.J}%, P=${result.mbtiResult.scores.P}%`;
      actions.push(
        {
          id: 'interpret-mbti',
          label: t('aiActions.interpretMbti'),
          prompt: t('aiActions.interpretMbtiPrompt', {
            type: result.mbtiResult.type,
            scores: mbtiScores,
          }),
          icon: <ClipboardCheck className="h-4 w-4" />,
        },
        {
          id: 'recommend-majors-mbti',
          label: t('aiActions.recommendMajorsMbti'),
          prompt: t('aiActions.recommendMajorsMbtiPrompt', {
            type: result.mbtiResult.type,
            strengths: result.mbtiResult.strengths.join(', '),
            majors: result.mbtiResult.majors.join(', '),
            careers: result.mbtiResult.careers.join(', '),
          }),
          icon: <GraduationCap className="h-4 w-4" />,
        }
      );
    }

    if (result?.hollandResult) {
      const hollandScores = Object.entries(result.hollandResult.scores)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      actions.push(
        {
          id: 'interpret-holland',
          label: t('aiActions.interpretHolland'),
          prompt: t('aiActions.interpretHollandPrompt', {
            codes: result.hollandResult.codes,
            types: result.hollandResult.typesZh.join(', '),
            scores: hollandScores,
          }),
          icon: <Compass className="h-4 w-4" />,
        },
        {
          id: 'recommend-majors-holland',
          label: t('aiActions.recommendMajorsHolland'),
          prompt: t('aiActions.recommendMajorsHollandPrompt', {
            codes: result.hollandResult.codes,
            types: result.hollandResult.typesZh.join(', '),
            fields: result.hollandResult.fieldsZh.join(', '),
            majors: result.hollandResult.majors.join(', '),
          }),
          icon: <GraduationCap className="h-4 w-4" />,
        }
      );
    }

    if (summary?.majorSuggestions.length) {
      actions.push({
        id: 'comprehensive-analysis',
        label: t('aiActions.comprehensiveAnalysis'),
        prompt: t('aiActions.comprehensiveAnalysisPrompt', {
          testResults: summary.majorSuggestions
            .map((item) => `${item.major} (${item.sources.join('+')})`)
            .join('\n'),
        }),
        icon: <Lightbulb className="h-4 w-4" />,
      });
    }

    if (!actions.length) {
      actions.push(
        {
          id: 'explain-mbti',
          label: t('aiActions.explainMbti'),
          prompt: t('aiActions.explainMbtiPrompt'),
          icon: <ClipboardCheck className="h-4 w-4" />,
        },
        {
          id: 'explain-holland',
          label: t('aiActions.explainHolland'),
          prompt: t('aiActions.explainHollandPrompt'),
          icon: <Compass className="h-4 w-4" />,
        },
        {
          id: 'major-selection-guide',
          label: t('aiActions.majorSelectionGuide'),
          prompt: t('aiActions.majorSelectionGuidePrompt'),
          icon: <Target className="h-4 w-4" />,
        }
      );
    }

    return actions;
  }, [currentResult, summary, t]);

  const renderResult = () => {
    if (!currentResult) return null;

    if (currentResult.mbtiResult) {
      return (
        <AssessmentMbtiResult
          result={currentResult.mbtiResult}
          onRetake={handleRetake}
          onSetTargetMajor={handleSetTargetMajor}
          onStartRecommendation={handleStartRecommendation}
          isSettingTargetMajor={setTargetMajorMutation.isPending}
        />
      );
    }

    if (currentResult.hollandResult) {
      return (
        <AssessmentHollandResult
          result={currentResult.hollandResult}
          onRetake={handleRetake}
          onSetTargetMajor={handleSetTargetMajor}
          onStartRecommendation={handleStartRecommendation}
          isSettingTargetMajor={setTargetMajorMutation.isPending}
        />
      );
    }

    return null;
  };

  return (
    <PageContainer maxWidth="fluid" className="space-y-6 pb-10">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={ClipboardCheck}
        color="violet"
        stats={[
          { label: t('overview.completed'), value: `${completedCount}/2`, icon: CheckCircle2 },
          { label: t('overview.drafts'), value: summary?.drafts.length ?? 0, icon: FileClock },
          {
            label: t('overview.majors'),
            value: summary?.majorSuggestions.length ?? 0,
            icon: GraduationCap,
          },
          { label: t('history'), value: summary?.historyCount ?? 0, icon: Trophy },
        ]}
        actions={
          <Button onClick={() => setShowAiPanel(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t('aiAssistant.title')}
          </Button>
        }
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs
          value={activeTab}
          onValueChange={(v) => handleTabChange(v as AssessmentTab)}
          className="min-w-0"
        >
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-5">
            <TabsTrigger value="overview" className="min-w-0 gap-2 text-xs sm:text-sm">
              <BookOpenCheck className="h-4 w-4" />
              {t('tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="mbti" className="min-w-0 gap-2 text-xs sm:text-sm">
              <ClipboardCheck className="h-4 w-4" />
              {t('tabs.mbti')}
            </TabsTrigger>
            <TabsTrigger value="holland" className="min-w-0 gap-2 text-xs sm:text-sm">
              <Compass className="h-4 w-4" />
              {t('tabs.holland')}
            </TabsTrigger>
            <TabsTrigger value="insights" className="min-w-0 gap-2 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              {t('tabs.insights')}
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-0 gap-2 text-xs sm:text-sm">
              <Trophy className="h-4 w-4" />
              {t('tabs.history')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <AssessmentIntro
              summary={summary}
              isLoading={summaryQuery.isLoading}
              onStartTest={handleStartTest}
              onViewResult={handleViewHistoryResult}
              onOpenInsights={() => setActiveTab('insights')}
            />
          </TabsContent>

          <TabsContent value="mbti" className="mt-0">
            <AssessmentWorkArea
              isLoading={isLoading}
              showResult={showResult}
              result={renderResult()}
              assessment={currentAssessment}
              currentQuestion={currentQuestion}
              answers={answers}
              canSubmit={!!canSubmit}
              isSubmitting={submitMutation.isPending}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              onSelectAnswer={handleSelectAnswer}
              onNext={handleNext}
              onPrev={handlePrev}
              onSubmit={handleSubmit}
              onJumpToQuestion={setCurrentQuestion}
              onExit={handleExitAssessment}
            />
          </TabsContent>

          <TabsContent value="holland" className="mt-0">
            <AssessmentWorkArea
              isLoading={isLoading}
              showResult={showResult}
              result={renderResult()}
              assessment={currentAssessment}
              currentQuestion={currentQuestion}
              answers={answers}
              canSubmit={!!canSubmit}
              isSubmitting={submitMutation.isPending}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              onSelectAnswer={handleSelectAnswer}
              onNext={handleNext}
              onPrev={handlePrev}
              onSubmit={handleSubmit}
              onJumpToQuestion={setCurrentQuestion}
              onExit={handleExitAssessment}
            />
          </TabsContent>

          <TabsContent value="insights" className="mt-0">
            <AssessmentInsights
              summary={summary}
              targetMajor={currentTargetMajor}
              onSetTargetMajor={handleSetTargetMajor}
              onStartRecommendation={handleStartRecommendation}
              isSettingTargetMajor={setTargetMajorMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <AssessmentHistory
              history={historyQuery.data}
              isLoading={historyQuery.isLoading}
              onViewResult={handleViewHistoryResult}
              onStartAssessment={() => setActiveTab('overview')}
            />
          </TabsContent>
        </Tabs>

        <AssessmentSidePanel
          summary={summary}
          targetMajor={currentTargetMajor}
          isLoading={summaryQuery.isLoading}
          onOpenInsights={() => setActiveTab('insights')}
          onStartRecommendation={handleStartRecommendation}
        />
      </div>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAiPanel(true)}
        aria-label={t('aiAssistant.title')}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center',
          'rounded-full bg-primary text-white shadow-lg',
          'transition-colors hover:bg-primary/90 xl:hidden',
          showAiPanel && 'hidden'
        )}
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>

      <AiAssistantPanel
        isOpen={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        title={t('aiAssistant.title')}
        description={currentResult ? t('aiAssistant.withResult') : t('aiAssistant.default')}
        contextActions={aiContextActions}
        initialMessage={
          currentResult
            ? t('aiAssistant.initialWithResult', {
                testType: currentResult.mbtiResult ? 'MBTI' : 'Holland',
              })
            : t('aiAssistant.initialNoResult')
        }
      />
    </PageContainer>
  );
}

function AssessmentWorkArea({
  isLoading,
  showResult,
  result,
  assessment,
  currentQuestion,
  answers,
  canSubmit,
  isSubmitting,
  saveStatus,
  lastSavedAt,
  onSelectAnswer,
  onNext,
  onPrev,
  onSubmit,
  onJumpToQuestion,
  onExit,
}: {
  isLoading: boolean;
  showResult: boolean;
  result: ReactNode;
  assessment?: Assessment;
  currentQuestion: number;
  answers: Record<string, string>;
  canSubmit: boolean;
  isSubmitting: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  onSelectAnswer: (questionId: string, value: string, autoAdvance?: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  onJumpToQuestion: (index: number) => void;
  onExit: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showResult) return <>{result}</>;

  if (!assessment) return null;

  return (
    <AssessmentQuestion
      assessment={assessment}
      currentQuestion={currentQuestion}
      answers={answers}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      saveStatus={saveStatus}
      lastSavedAt={lastSavedAt}
      onSelectAnswer={onSelectAnswer}
      onNext={onNext}
      onPrev={onPrev}
      onSubmit={onSubmit}
      onJumpToQuestion={onJumpToQuestion}
      onExit={onExit}
    />
  );
}

function AssessmentInsights({
  summary,
  targetMajor,
  onSetTargetMajor,
  onStartRecommendation,
  isSettingTargetMajor,
}: {
  summary?: AssessmentSummary;
  targetMajor?: string | null;
  onSetTargetMajor: (major: string) => void;
  onStartRecommendation: () => void;
  isSettingTargetMajor: boolean;
}) {
  const t = useTranslations('assessment');
  const suggestions = summary?.majorSuggestions ?? [];
  const hasAnyResult = Boolean(summary?.latestMbti || summary?.latestHolland);

  if (!hasAnyResult) {
    return (
      <Card className="p-10 text-center">
        <Lightbulb className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="font-semibold">{t('insights.emptyTitle')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('insights.emptyDescription')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>{t('insights.title')}</AlertTitle>
        <AlertDescription>{t('insights.description')}</AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <ResultSnapshot result={summary?.latestMbti} title="MBTI" />
        <ResultSnapshot result={summary?.latestHolland} title="Holland" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {t('insights.majorShortlist')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.map((item, index) => (
            <div
              key={item.major}
              className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="font-medium">{item.major}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('insights.sources', { sources: item.sources.join(' + ') })}
                </p>
              </div>
              <Button
                size="sm"
                variant={targetMajor === item.major ? 'outline' : 'default'}
                onClick={() => onSetTargetMajor(item.major)}
                disabled={isSettingTargetMajor}
              >
                {targetMajor === item.major ? t('targetMajor.current') : t('targetMajor.apply')}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/15">
        <CardContent className="grid min-w-0 gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="font-semibold">{t('insights.nextStepTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('insights.nextStepDescription')}
            </p>
          </div>
          <Button onClick={onStartRecommendation} className="gap-2">
            {t('resultActions.schoolRecommendation')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultSnapshot({ result, title }: { result?: AssessmentResult; title: string }) {
  const t = useTranslations('assessment');
  const code = result?.mbtiResult?.type || result?.hollandResult?.codes;
  const description = result?.mbtiResult?.titleZh || result?.hollandResult?.typesZh?.join(' · ');

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          {code ? (
            <Badge variant="success">{code}</Badge>
          ) : (
            <Badge variant="outline">{t('insights.notCompleted')}</Badge>
          )}
        </div>
        <p className="text-lg font-semibold">{description || t('insights.pending')}</p>
      </CardContent>
    </Card>
  );
}

function AssessmentSidePanel({
  summary,
  targetMajor,
  isLoading,
  onOpenInsights,
  onStartRecommendation,
}: {
  summary?: AssessmentSummary;
  targetMajor?: string | null;
  isLoading: boolean;
  onOpenInsights: () => void;
  onStartRecommendation: () => void;
}) {
  const t = useTranslations('assessment');
  const format = useFormatter();
  const latest = [summary?.latestMbti, summary?.latestHolland].filter(
    Boolean
  ) as AssessmentResult[];

  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            {t('sidePanel.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/25 p-3">
            <p className="text-xs text-muted-foreground">{t('sidePanel.targetMajor')}</p>
            <p className="mt-1 font-medium">{targetMajor || t('sidePanel.noTargetMajor')}</p>
          </div>
          <div className="space-y-2">
            {latest.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {result.type === 'MBTI' ? 'MBTI' : t('tabs.holland')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(result.completedAt), 'short')}
                  </p>
                </div>
                <Badge variant="secondary">
                  {result.mbtiResult?.type || result.hollandResult?.codes}
                </Badge>
              </div>
            ))}
            {!latest.length && !isLoading ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {t('sidePanel.noResults')}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Button onClick={onOpenInsights} variant="outline" className="justify-start gap-2">
              <Lightbulb className="h-4 w-4" />
              {t('overview.openInsights')}
            </Button>
            <Button onClick={onStartRecommendation} className="justify-start gap-2">
              <GraduationCap className="h-4 w-4" />
              {t('resultActions.schoolRecommendation')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Save className="h-4 w-4 text-primary" />
            {t('draft.title')}
          </div>
          {(summary?.drafts ?? []).map((draft) => (
            <div key={draft.type} className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>{draft.type}</span>
                <span className="text-muted-foreground">{draft.answerCount}</span>
              </div>
              <Progress
                value={Math.round((draft.answerCount / (draft.type === 'MBTI' ? 48 : 30)) * 100)}
                className="h-2"
              />
            </div>
          ))}
          {!summary?.drafts.length ? (
            <p className="text-sm text-muted-foreground">{t('draft.none')}</p>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}
