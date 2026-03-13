'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Brain,
  Compass,
  Sparkles,
  Trophy,
  GraduationCap,
  Lightbulb,
  Target,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { AiAssistantPanel, type ContextAction } from '@/components/features/agent-chat';
import type { Assessment, AssessmentResult } from './_components/assessment-constants';
import { isLikertQuestion } from './_components/assessment-constants';
import { AssessmentIntro } from './_components/assessment-intro';
import { AssessmentQuestion } from './_components/assessment-question';
import { AssessmentMbtiResult } from './_components/assessment-mbti-result';
import { AssessmentHollandResult } from './_components/assessment-holland-result';
import { AssessmentHistory } from './_components/assessment-history';

export default function AssessmentPage() {
  const t = useTranslations('assessment');
  const [activeTab, setActiveTab] = useState<'intro' | 'mbti' | 'holland' | 'history'>('intro');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<AssessmentResult | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Fetch MBTI questions
  const { data: mbtiAssessment, isLoading: mbtiLoading } = useQuery<Assessment>({
    queryKey: ['assessment', 'MBTI'],
    queryFn: () => apiClient.get('/assessments/MBTI'),
    enabled: activeTab === 'mbti' && !showResult,
  });

  // Fetch Holland questions
  const { data: hollandAssessment, isLoading: hollandLoading } = useQuery<Assessment>({
    queryKey: ['assessment', 'HOLLAND'],
    queryFn: () => apiClient.get('/assessments/HOLLAND'),
    enabled: activeTab === 'holland' && !showResult,
  });

  // Fetch history
  const { data: history, refetch: refetchHistory } = useQuery<AssessmentResult[]>({
    queryKey: ['assessment-history'],
    queryFn: () => apiClient.get('/assessments/history/me'),
    enabled: activeTab === 'history',
  });

  // Submit assessment
  const submitMutation = useMutation({
    mutationFn: (data: { type: string; answers: { questionId: string; answer: string }[] }) =>
      apiClient.post<AssessmentResult>('/assessments', data),
    onSuccess: (data) => {
      setCurrentResult(data);
      setShowResult(true);
      refetchHistory();
      toast.success(t('viewResult'));
    },
  });

  const currentAssessment = activeTab === 'mbti' ? mbtiAssessment : hollandAssessment;
  const isLoading = activeTab === 'mbti' ? mbtiLoading : hollandLoading;

  // Auto-advance after selecting an answer
  const handleSelectAnswer = useCallback(
    (questionId: string, value: string, autoAdvance = true) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));

      if (
        autoAdvance &&
        currentAssessment?.questions &&
        currentQuestion < currentAssessment.questions.length - 1
      ) {
        setTimeout(() => {
          setCurrentQuestion((prev) => prev + 1);
        }, 300);
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
    if (!currentAssessment) return;

    const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));

    submitMutation.mutate({
      type: activeTab.toUpperCase(),
      answers: formattedAnswers,
    });
  }, [currentAssessment, answers, activeTab, submitMutation]);

  // Keyboard shortcuts
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
        const allAnswered = Object.keys(answers).length === currentAssessment.questions.length;
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

  const handleRetake = () => {
    setShowResult(false);
    setCurrentResult(null);
    setCurrentQuestion(0);
    setAnswers({});
  };

  const handleStartTest = (type: 'mbti' | 'holland') => {
    setActiveTab(type);
    setShowResult(false);
    setCurrentResult(null);
    setCurrentQuestion(0);
    setAnswers({});
  };

  const handleViewHistoryResult = (result: AssessmentResult) => {
    setCurrentResult(result);
    setShowResult(true);
    setActiveTab(result.type.toLowerCase() as 'mbti' | 'holland');
  };

  const canSubmit =
    currentAssessment?.questions &&
    Object.keys(answers).length === currentAssessment.questions.length;

  // AI assistant context actions
  const aiContextActions = useMemo((): ContextAction[] => {
    const actions: ContextAction[] = [];

    if (currentResult) {
      if (currentResult.mbtiResult) {
        const mbtiScores = `E=${currentResult.mbtiResult.scores.E}%, I=${currentResult.mbtiResult.scores.I}%, S=${currentResult.mbtiResult.scores.S}%, N=${currentResult.mbtiResult.scores.N}%, T=${currentResult.mbtiResult.scores.T}%, F=${currentResult.mbtiResult.scores.F}%, J=${currentResult.mbtiResult.scores.J}%, P=${currentResult.mbtiResult.scores.P}%`;
        actions.push(
          {
            id: 'interpret-mbti',
            label: t('aiActions.interpretMbti'),
            prompt: t('aiActions.interpretMbtiPrompt', {
              type: currentResult.mbtiResult.type,
              scores: mbtiScores,
            }),
            icon: <Brain className="h-4 w-4" />,
          },
          {
            id: 'recommend-majors-mbti',
            label: t('aiActions.recommendMajorsMbti'),
            prompt: t('aiActions.recommendMajorsMbtiPrompt', {
              type: currentResult.mbtiResult.type,
              strengths: currentResult.mbtiResult.strengths.join(', '),
              majors: currentResult.mbtiResult.majors.join(', '),
              careers: currentResult.mbtiResult.careers.join(', '),
            }),
            icon: <GraduationCap className="h-4 w-4" />,
          }
        );
      }

      if (currentResult.hollandResult) {
        const hollandScores = Object.entries(currentResult.hollandResult.scores)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        actions.push(
          {
            id: 'interpret-holland',
            label: t('aiActions.interpretHolland'),
            prompt: t('aiActions.interpretHollandPrompt', {
              codes: currentResult.hollandResult.codes,
              types: currentResult.hollandResult.typesZh.join(', '),
              scores: hollandScores,
            }),
            icon: <Compass className="h-4 w-4" />,
          },
          {
            id: 'recommend-majors-holland',
            label: t('aiActions.recommendMajorsHolland'),
            prompt: t('aiActions.recommendMajorsHollandPrompt', {
              codes: currentResult.hollandResult.codes,
              types: currentResult.hollandResult.typesZh.join(', '),
              fields: currentResult.hollandResult.fieldsZh.join(', '),
              majors: currentResult.hollandResult.majors.join(', '),
            }),
            icon: <GraduationCap className="h-4 w-4" />,
          }
        );
      }

      const testResults = [
        currentResult.mbtiResult ? `- MBTI: ${currentResult.mbtiResult.type}` : '',
        currentResult.hollandResult ? `- Holland: ${currentResult.hollandResult.codes}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      actions.push({
        id: 'comprehensive-analysis',
        label: t('aiActions.comprehensiveAnalysis'),
        prompt: t('aiActions.comprehensiveAnalysisPrompt', { testResults }),
        icon: <Lightbulb className="h-4 w-4" />,
      });
    } else {
      actions.push(
        {
          id: 'explain-mbti',
          label: t('aiActions.explainMbti'),
          prompt: t('aiActions.explainMbtiPrompt'),
          icon: <Brain className="h-4 w-4" />,
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
  }, [currentResult, t]);

  // Render result based on type
  const renderResult = () => {
    if (!currentResult) return null;

    if (currentResult.mbtiResult) {
      return <AssessmentMbtiResult result={currentResult.mbtiResult} onRetake={handleRetake} />;
    }

    if (currentResult.hollandResult) {
      return (
        <AssessmentHollandResult result={currentResult.hollandResult} onRetake={handleRetake} />
      );
    }

    return null;
  };

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader title={t('title')} description={t('description')} icon={Brain} color="violet" />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="intro">
            <Sparkles className="h-4 w-4 mr-2" />
            {t('tabs.intro')}
          </TabsTrigger>
          <TabsTrigger value="mbti">
            <Brain className="h-4 w-4 mr-2" />
            {t('tabs.mbti')}
          </TabsTrigger>
          <TabsTrigger value="holland">
            <Compass className="h-4 w-4 mr-2" />
            {t('tabs.holland')}
          </TabsTrigger>
          <TabsTrigger value="history">
            <Trophy className="h-4 w-4 mr-2" />
            {t('tabs.history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intro">
          <AssessmentIntro onStartTest={handleStartTest} />
        </TabsContent>

        <TabsContent value="mbti">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : showResult ? (
            renderResult()
          ) : currentAssessment ? (
            <AssessmentQuestion
              assessment={currentAssessment}
              currentQuestion={currentQuestion}
              answers={answers}
              canSubmit={!!canSubmit}
              isSubmitting={submitMutation.isPending}
              onSelectAnswer={handleSelectAnswer}
              onNext={handleNext}
              onPrev={handlePrev}
              onSubmit={handleSubmit}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="holland">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : showResult ? (
            renderResult()
          ) : currentAssessment ? (
            <AssessmentQuestion
              assessment={currentAssessment}
              currentQuestion={currentQuestion}
              answers={answers}
              canSubmit={!!canSubmit}
              isSubmitting={submitMutation.isPending}
              onSelectAnswer={handleSelectAnswer}
              onNext={handleNext}
              onPrev={handlePrev}
              onSubmit={handleSubmit}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="history">
          <AssessmentHistory
            history={history}
            onViewResult={handleViewHistoryResult}
            onStartAssessment={() => setActiveTab('intro')}
          />
        </TabsContent>
      </Tabs>

      {/* AI assistant trigger button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAiPanel(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center',
          'rounded-full bg-primary text-white shadow-lg',
          'hover:bg-primary/90 transition-colors',
          showAiPanel && 'hidden'
        )}
      >
        <Bot className="h-6 w-6" />
      </motion.button>

      {/* AI assistant panel */}
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
