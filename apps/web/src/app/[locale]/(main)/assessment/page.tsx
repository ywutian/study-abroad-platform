'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Brain,
  Compass,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  RotateCcw,
  Trophy,
  GraduationCap,
  Briefcase,
  Lightbulb,
  Target,
  Palette,
  Users,
  LineChart,
  Wrench,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { AiAssistantPanel, type ContextAction } from '@/components/features/agent-chat';

interface Question {
  id: string;
  text: string;
  textZh: string;
  options: { value: number | string; text: string; textZh: string }[];
  dimension?: string;
}

// 判断是否为 Likert 量表题目（MBTI 新版）
const isLikertQuestion = (options: Question['options']) => {
  return options.length === 5 && typeof options[0]?.value === 'number';
};

// MBTI dimension keys (translations loaded via i18n)
const _DIMENSION_KEYS = ['EI', 'SN', 'TF', 'JP'] as const;

// MBTI dimension display names
const DIMENSION_NAMES: Record<string, string> = {
  EI: 'E-I',
  SN: 'S-N',
  TF: 'T-F',
  JP: 'J-P',
};

// 估算每题答题时间（秒）
const SECONDS_PER_QUESTION = 8;

interface Assessment {
  id: string;
  type: string;
  title: string;
  titleZh: string;
  description?: string;
  descriptionZh?: string;
  questions: Question[];
}

interface MbtiResult {
  type: string;
  scores: Record<string, number>;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  strengths: string[];
  careers: string[];
  majors: string[];
}

interface HollandResult {
  codes: string;
  scores: Record<string, number>;
  types: string[];
  typesZh: string[];
  fields: string[];
  fieldsZh: string[];
  majors: string[];
}

interface AssessmentResult {
  id: string;
  type: string;
  mbtiResult?: MbtiResult;
  hollandResult?: HollandResult;
  completedAt: string;
}

// Holland 类型图标
const HOLLAND_ICONS: Record<string, any> = {
  R: Wrench,
  I: Brain,
  A: Palette,
  S: Users,
  E: Briefcase,
  C: LineChart,
};

// Holland 类型颜色
const HOLLAND_COLORS: Record<string, string> = {
  R: 'bg-amber-500',
  I: 'bg-blue-500',
  A: 'bg-primary',
  S: 'bg-green-500',
  E: 'bg-red-500',
  C: 'bg-cyan-500',
};

export default function AssessmentPage() {
  const t = useTranslations('assessment');
  const locale = useLocale();
  const format = useFormatter();
  const [activeTab, setActiveTab] = useState<'intro' | 'mbti' | 'holland' | 'history'>('intro');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<AssessmentResult | null>(null);

  // 获取 MBTI 题目
  const { data: mbtiAssessment, isLoading: mbtiLoading } = useQuery<Assessment>({
    queryKey: ['assessment', 'MBTI'],
    queryFn: () => apiClient.get('/assessments/MBTI'),
    enabled: activeTab === 'mbti' && !showResult,
  });

  // 获取 Holland 题目
  const { data: hollandAssessment, isLoading: hollandLoading } = useQuery<Assessment>({
    queryKey: ['assessment', 'HOLLAND'],
    queryFn: () => apiClient.get('/assessments/HOLLAND'),
    enabled: activeTab === 'holland' && !showResult,
  });

  // 获取历史记录
  const { data: history, refetch: refetchHistory } = useQuery<AssessmentResult[]>({
    queryKey: ['assessment-history'],
    queryFn: () => apiClient.get('/assessments/history/me'),
    enabled: activeTab === 'history',
  });

  // 提交测评
  const submitMutation = useMutation({
    mutationFn: (data: { type: string; answers: { questionId: string; answer: string }[] }) =>
      apiClient.post<AssessmentResult>('/assessments', data),
    onSuccess: (data) => {
      setCurrentResult(data);
      setShowResult(true);
      refetchHistory();
      toast.success(t('viewResult'));
    },
    // Error toast handled by global MutationCache
  });

  const currentAssessment = activeTab === 'mbti' ? mbtiAssessment : hollandAssessment;
  const isLoading = activeTab === 'mbti' ? mbtiLoading : hollandLoading;

  // B. 自动跳题：选中答案后自动进入下一题
  const handleSelectAnswer = useCallback(
    (questionId: string, value: string, autoAdvance = true) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));

      // 自动跳转到下一题（最后一题除外）
      if (
        autoAdvance &&
        currentAssessment?.questions &&
        currentQuestion < currentAssessment.questions.length - 1
      ) {
        setTimeout(() => {
          setCurrentQuestion((prev) => prev + 1);
        }, 300); // 300ms 延迟，让用户看到选中效果
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

  // D. 键盘快捷键支持
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
      // Likert 量表：1-5 键选择
      if (isLikertQuestion(question.options)) {
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 5) {
          e.preventDefault();
          handleSelectAnswer(question.id, String(keyNum));
        }
      }

      // 左右箭头切换题目
      if (e.key === 'ArrowLeft' && currentQuestion > 0) {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === 'ArrowRight' && currentQuestion < currentAssessment.questions.length - 1) {
        e.preventDefault();
        handleNext();
      }

      // Enter 键：最后一题时提交
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

  const progress = currentAssessment?.questions?.length
    ? Math.round(((currentQuestion + 1) / currentAssessment.questions.length) * 100)
    : 0;

  const canSubmit =
    currentAssessment?.questions &&
    Object.keys(answers).length === currentAssessment.questions.length;

  // C. 计算预计剩余时间
  const remainingQuestions = currentAssessment?.questions?.length
    ? currentAssessment.questions.length - currentQuestion - 1
    : 0;
  const remainingSeconds = remainingQuestions * SECONDS_PER_QUESTION;
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  // C. 获取当前维度信息
  const getCurrentDimension = () => {
    if (!currentAssessment?.questions?.length) return null;
    const question = currentAssessment.questions[currentQuestion];
    if (!question?.dimension) return null;
    return DIMENSION_NAMES[question.dimension] || null;
  };
  const currentDimension = getCurrentDimension();

  const renderIntro = () => (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* MBTI 卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card
            className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => handleStartTest('mbti')}
          >
            <div className="h-2 bg-primary dark:bg-primary" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary dark:bg-primary text-white ">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('mbti.title')}</CardTitle>
                  <CardDescription>{t('mbti.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground">{t('mbti.intro')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t('mbti.disclaimer')}</p>
                <div className="flex flex-wrap gap-2">
                  {['INTJ', 'ENFP', 'ISTJ', 'ENTP'].map((type) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300"
                    >
                      {type}
                    </Badge>
                  ))}
                  <Badge variant="secondary">+12</Badge>
                </div>
              </div>
              <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-white transition-colors">
                {t('mbti.start')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Holland 卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => handleStartTest('holland')}
          >
            <div className="h-2 bg-success" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success text-white ">
                  <Compass className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('holland.title')}</CardTitle>
                  <CardDescription>{t('holland.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground">{t('holland.intro')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(HOLLAND_ICONS).map(([type, Icon]) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className={cn('text-white', HOLLAND_COLORS[type])}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button className="w-full mt-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                {t('holland.start')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );

  const renderQuestion = () => {
    if (!currentAssessment?.questions?.length) return null;

    const question = currentAssessment.questions[currentQuestion];
    const selectedAnswer = answers[question.id];
    const isLikert = isLikertQuestion(question.options);

    return (
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-4 sm:space-y-6"
      >
        {/* C. 进度信息：进度条 + 维度 + 剩余时间 */}
        <div className="space-y-3">
          {/* 主进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span className="font-medium">
                {currentQuestion + 1} / {currentAssessment.questions.length}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* 维度信息 + 剩余时间 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {currentDimension && (
              <Badge variant="outline" className="bg-primary/5">
                <Target className="h-3 w-3 mr-1" />
                {currentDimension}
              </Badge>
            )}
            {remainingQuestions > 0 && (
              <span className="text-muted-foreground">
                {t('timeRemaining', { minutes: remainingMinutes })}
              </span>
            )}
          </div>
        </div>

        {/* 题目卡片 - E. 移动端优化：更大间距 */}
        <Card className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 leading-relaxed">
            {question.textZh}
          </h3>

          {isLikert ? (
            /* Likert 量表 UI - E. 移动端优化：更大点击区域 */
            <div className="space-y-4 sm:space-y-6">
              {/* 端点标签 */}
              <div className="flex justify-between text-xs sm:text-sm text-muted-foreground px-1">
                <span>{t('likert.stronglyDisagree')}</span>
                <span>{t('likert.stronglyAgree')}</span>
              </div>

              {/* E. 移动端优化：更大的按钮，更好的触控体验 */}
              <div className="flex justify-between gap-2 sm:gap-3 px-1">
                {question.options.map((option, index) => (
                  <motion.button
                    key={option.value}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleSelectAnswer(question.id, String(option.value))}
                    className={cn(
                      // E. 移动端：更大的触控目标 (min 44px)
                      'flex-1 min-w-[44px] min-h-[44px] sm:min-w-[56px] sm:min-h-[56px]',
                      'aspect-square rounded-full border-2 flex items-center justify-center',
                      'transition-all duration-200 font-semibold text-base sm:text-lg',
                      // 选中状态
                      selectedAnswer === String(option.value)
                        ? 'border-primary bg-primary text-white scale-105 sm:scale-110 shadow-lg shadow-primary/30'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50 active:scale-95'
                    )}
                  >
                    {option.value}
                  </motion.button>
                ))}
              </div>

              {/* 选项标签 - 移动端隐藏部分 */}
              <div className="hidden sm:flex justify-between gap-1 text-xs text-muted-foreground px-1">
                {question.options.map((option) => (
                  <span key={option.value} className="flex-1 text-center truncate">
                    {option.textZh}
                  </span>
                ))}
              </div>

              {/* D. 键盘快捷键提示 - 仅桌面端显示 */}
              <div className="hidden sm:flex justify-center">
                <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  💡 {t('keyboardHint')}
                </span>
              </div>
            </div>
          ) : (
            /* 二选一 UI - E. 移动端优化 */
            <div className="space-y-2 sm:space-y-3">
              {question.options.map((option, index) => (
                <motion.button
                  key={option.value}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectAnswer(question.id, String(option.value))}
                  className={cn(
                    // E. 移动端：更大的触控目标
                    'w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all min-h-[52px]',
                    'active:scale-[0.98]',
                    selectedAnswer === String(option.value)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        selectedAnswer === String(option.value)
                          ? 'border-primary bg-primary text-white'
                          : 'border-muted-foreground'
                      )}
                    >
                      {selectedAnswer === String(option.value) && (
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      )}
                    </div>
                    <span className="text-sm sm:text-base">{option.textZh}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </Card>

        {/* 导航 */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrev} disabled={currentQuestion === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('prev')}
          </Button>

          {currentQuestion === currentAssessment.questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={!canSubmit || submitMutation.isPending}>
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {t('submit')}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!selectedAnswer}>
              {t('next')}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  const renderMbtiResult = (result: MbtiResult) => (
    <div className="space-y-6">
      {/* 类型展示 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-primary dark:bg-primary border-2 border-violet-500/30 mb-4">
          <span className="text-4xl font-bold text-white">{result.type}</span>
        </div>
        <h2 className="text-subtitle">{result.titleZh}</h2>
        <p className="text-muted-foreground mt-2">{result.descriptionZh}</p>
      </motion.div>

      {/* 维度得分 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            {t('dimensionAnalysis')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'E/I', key: 'EI', leftScore: result.scores.E, rightScore: result.scores.I },
            { label: 'S/N', key: 'SN', leftScore: result.scores.S, rightScore: result.scores.N },
            { label: 'T/F', key: 'TF', leftScore: result.scores.T, rightScore: result.scores.F },
            { label: 'J/P', key: 'JP', leftScore: result.scores.J, rightScore: result.scores.P },
          ].map((dim) => (
            <div key={dim.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span
                  className={
                    dim.leftScore > 50 ? 'font-bold text-primary' : 'text-muted-foreground'
                  }
                >
                  {t(`mbtiDimensions.${dim.key}.left`)} ({dim.leftScore}%)
                </span>
                <span
                  className={
                    dim.rightScore > 50 ? 'font-bold text-primary' : 'text-muted-foreground'
                  }
                >
                  {t(`mbtiDimensions.${dim.key}.right`)} ({dim.rightScore}%)
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                <div className="bg-primary transition-all" style={{ width: `${dim.leftScore}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 优势和推荐 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              {t('mbti.strengths')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.strengths.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500" />
              {t('mbti.careers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.careers.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
              {t('mbti.majors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.majors.map((m) => (
                <Badge
                  key={m}
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 免责声明 */}
      <div className="text-xs text-muted-foreground text-center p-3 bg-muted/50 rounded-lg">
        {t('mbtiDisclaimer')}
        <br />
        {t('mbtiTrademark')}
      </div>

      <Button onClick={handleRetake} variant="outline" className="w-full">
        <RotateCcw className="mr-2 h-4 w-4" />
        {t('retake')}
      </Button>
    </div>
  );

  const renderHollandResult = (result: HollandResult) => (
    <div className="space-y-6">
      {/* 代码展示 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="flex justify-center gap-2 mb-4">
          {result.codes.split('').map((code, index) => {
            const Icon = HOLLAND_ICONS[code];
            return (
              <motion.div
                key={code}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'w-20 h-20 rounded-xl flex flex-col items-center justify-center text-white shadow-lg',
                  HOLLAND_COLORS[code]
                )}
              >
                <Icon className="h-8 w-8 mb-1" />
                <span className="text-xl font-bold">{code}</span>
              </motion.div>
            );
          })}
        </div>
        <h2 className="text-subtitle">{t('hollandCode', { code: result.codes })}</h2>
        <p className="text-muted-foreground mt-2">{result.typesZh.join(' · ')}</p>
      </motion.div>

      {/* 各类型得分 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {t('interestScores')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(result.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([type, score]) => {
              const Icon = HOLLAND_ICONS[type];
              const maxScore = 25;
              const percentage = Math.round((score / maxScore) * 100);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {type}
                    </span>
                    <span className="font-medium">
                      {score}/{maxScore}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: 0.2 }}
                      className={cn('h-full', HOLLAND_COLORS[type])}
                    />
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {/* 推荐 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500" />
              {t('holland.fields')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.fieldsZh.slice(0, 8).map((f) => (
                <Badge key={f} variant="outline">
                  {f}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
              {t('holland.majors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.majors.slice(0, 8).map((m) => (
                <Badge
                  key={m}
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleRetake} variant="outline" className="w-full">
        <RotateCcw className="mr-2 h-4 w-4" />
        {t('retake')}
      </Button>
    </div>
  );

  const renderResult = () => {
    if (!currentResult) return null;

    if (currentResult.mbtiResult) {
      return renderMbtiResult(currentResult.mbtiResult);
    }

    if (currentResult.hollandResult) {
      return renderHollandResult(currentResult.hollandResult);
    }

    return null;
  };

  const renderHistory = () => (
    <div className="space-y-4">
      {!history || history.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold">{t('noHistory')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('noHistoryHint')}</p>
          <Button className="mt-4" onClick={() => setActiveTab('intro')}>
            {t('startAssessment')}
          </Button>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {history.map((result, index) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setCurrentResult(result);
                    setShowResult(true);
                    setActiveTab(result.type.toLowerCase() as 'mbti' | 'holland');
                  }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center text-white',
                          result.type === 'MBTI' ? 'bg-primary dark:bg-primary' : 'bg-success'
                        )}
                      >
                        {result.type === 'MBTI' ? (
                          <Brain className="h-6 w-6" />
                        ) : (
                          <Compass className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold">
                          {result.type === 'MBTI' ? t('testTypes.mbti') : t('testTypes.holland')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {result.mbtiResult?.type || result.hollandResult?.codes}
                          {' · '}
                          {t('completedAt')}:{' '}
                          {format.dateTime(new Date(result.completedAt), 'medium')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  // AI 助手面板的上下文操作 - 根据当前状态动态生成
  const aiContextActions = useMemo((): ContextAction[] => {
    const actions: ContextAction[] = [];

    // 如果有测评结果，提供结果解读操作
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

      // 通用的综合建议
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
      // 没有结果时，提供通用操作
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

  // AI 助手面板状态
  const [showAiPanel, setShowAiPanel] = useState(false);

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader title={t('title')} description={t('description')} icon={Brain} color="blue" />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
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

        <TabsContent value="intro">{renderIntro()}</TabsContent>

        <TabsContent value="mbti">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : showResult ? (
            renderResult()
          ) : (
            renderQuestion()
          )}
        </TabsContent>

        <TabsContent value="holland">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : showResult ? (
            renderResult()
          ) : (
            renderQuestion()
          )}
        </TabsContent>

        <TabsContent value="history">{renderHistory()}</TabsContent>
      </Tabs>

      {/* AI 助手触发按钮 */}
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

      {/* AI 助手面板 */}
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
