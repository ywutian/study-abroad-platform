'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import {
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BarChart,
  BookOpen,
  Trophy,
  Star,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Check,
  Brain,
  User,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface ProfileData {
  id: string;
  userId: string;
  grade?: string;
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<{ name: string; category: string; role: string; description?: string }>;
  awards?: Array<{ name: string; level: string; year?: number }>;
}

interface SwipeReviewModeProps {
  profile: ProfileData;
  onClose: () => void;
  onComplete?: () => void;
}

const STEP_STYLES = [
  { key: 'intro', icon: User, color: 'bg-primary' },
  { key: 'academic', icon: GraduationCap, color: 'bg-primary' },
  { key: 'scores', icon: BarChart, color: 'from-indigo-500 to-violet-500' },
  { key: 'activities', icon: BookOpen, color: 'bg-warning' },
  { key: 'awards', icon: Trophy, color: 'from-yellow-500 to-orange-500' },
  { key: 'verdict', icon: Star, color: 'bg-destructive' },
];

export function SwipeReviewMode({ profile, onClose, onComplete }: SwipeReviewModeProps) {
  const t = useTranslations('hall');
  const tc = useTranslations('common');

  const REVIEW_STEPS = STEP_STYLES.map((step) => ({
    ...step,
    label: t(`review.steps.${step.key}`),
  }));
  const [currentStep, setCurrentStep] = useState(0);
  const [scores, setScores] = useState({
    academic: 0,
    test: 0,
    activity: 0,
    award: 0,
    overall: 0,
  });
  const [comment, setComment] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Swipe motion values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const submitMutation = useMutation({
    mutationFn: (data: {
      profileUserId: string;
      academicScore: number;
      testScore: number;
      activityScore: number;
      awardScore: number;
      overallScore: number;
      comment?: string;
    }) => apiClient.post('/halls/reviews', data),
    onSuccess: () => {
      toast.success(t('review.submitSuccess'));
      onComplete?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('review.submitError'));
    },
  });

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      setSwipeDirection(direction);

      // 根据滑动方向设置分数 (5档: 左=3, 中左=5, 中=6, 中右=7, 右=9)
      const stepKey = REVIEW_STEPS[currentStep].key;
      if (stepKey !== 'intro' && stepKey !== 'verdict') {
        const scoreMap: Record<string, keyof typeof scores> = {
          academic: 'academic',
          scores: 'test',
          activities: 'activity',
          awards: 'award',
        };
        const scoreKey = scoreMap[stepKey];
        if (scoreKey) {
          const score = direction === 'right' ? 8 : 4;
          setScores((prev) => ({ ...prev, [scoreKey]: score }));
        }
      }

      setTimeout(() => {
        setSwipeDirection(null);
        if (currentStep < REVIEW_STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        }
      }, 300);
    },
    [currentStep]
  );

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      handleSwipe('right');
    } else if (info.offset.x < -100) {
      handleSwipe('left');
    }
  };

  const handleSubmit = () => {
    const finalOverall =
      scores.overall ||
      Math.round(
        scores.academic * 0.3 + scores.test * 0.2 + scores.activity * 0.3 + scores.award * 0.2
      );
    submitMutation.mutate({
      profileUserId: profile.userId,
      academicScore: scores.academic || 5,
      testScore: scores.test || 5,
      activityScore: scores.activity || 5,
      awardScore: scores.award || 5,
      overallScore: finalOverall || 5,
      comment: comment || undefined,
    });
  };

  const currentStepConfig = REVIEW_STEPS[currentStep];
  const StepIcon = currentStepConfig.icon;

  const renderStepContent = () => {
    switch (currentStepConfig.key) {
      case 'intro':
        return (
          <div className="text-center space-y-6">
            <div className="flex h-24 w-24 mx-auto items-center justify-center rounded-xl bg-primary dark:bg-primary text-white shadow-2xl">
              <User className="h-12 w-12" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('review.applicantProfile')}</h2>
              <p className="text-muted-foreground">
                {t('review.targetMajor')}: {profile.targetMajor || t('review.notDetermined')}
              </p>
            </div>
            <div className="flex justify-center gap-4 text-sm">
              <Badge variant="outline" className="px-4 py-2">
                {profile.grade || t('review.unknownGrade')}
              </Badge>
              {profile.gpa && (
                <Badge variant="outline" className="px-4 py-2">
                  GPA {Number(profile.gpa).toFixed(2)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground pt-4">{t('review.swipeToStart')}</p>
          </div>
        );

      case 'academic':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-lg bg-primary text-white shadow-xl mb-4">
                <GraduationCap className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">{t('review.academicBg')}</h2>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">GPA</span>
                <span className="text-3xl font-bold">
                  {profile.gpa
                    ? `${Number(profile.gpa).toFixed(2)}/${profile.gpaScale || 4.0}`
                    : tc('notAvailable')}
                </span>
              </div>
              {profile.gpa && (
                <Progress
                  value={(Number(profile.gpa) / (profile.gpaScale || 4)) * 100}
                  className="h-3"
                />
              )}
            </div>

            <div className="flex justify-center gap-8 pt-4">
              <div className="text-center">
                <ThumbsDown className="h-8 w-8 mx-auto text-rose-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.weakLeft')}</span>
              </div>
              <div className="text-center">
                <ThumbsUp className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.excellentRight')}</span>
              </div>
            </div>
          </div>
        );

      case 'scores':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-lg bg-primary text-white shadow-xl mb-4">
                <BarChart className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">{t('review.testScores')}</h2>
            </div>

            <div className="space-y-3">
              {profile.testScores && profile.testScores.length > 0 ? (
                profile.testScores.map((score, i) => (
                  <div
                    key={i}
                    className="bg-muted/50 rounded-xl p-4 flex justify-between items-center"
                  >
                    <span className="font-medium">{score.type}</span>
                    <span className="text-2xl font-bold">{score.score}</span>
                  </div>
                ))
              ) : (
                <div className="bg-muted/50 rounded-xl p-6 text-center text-muted-foreground">
                  {t('review.noTestScores')}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-8 pt-4">
              <div className="text-center">
                <ThumbsDown className="h-8 w-8 mx-auto text-rose-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.weakLeft')}</span>
              </div>
              <div className="text-center">
                <ThumbsUp className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.excellentRight')}</span>
              </div>
            </div>
          </div>
        );

      case 'activities':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-lg bg-gradient-to-br bg-warning text-white shadow-xl mb-4">
                <BookOpen className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">{t('review.activities')}</h2>
              <p className="text-muted-foreground">
                {t('review.activitiesCount', { count: profile.activities?.length || 0 })}
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {profile.activities && profile.activities.length > 0 ? (
                profile.activities.slice(0, 5).map((activity, i) => (
                  <div key={i} className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{activity.name}</p>
                        <p className="text-sm text-muted-foreground">{activity.role}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {activity.category}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-muted/50 rounded-xl p-6 text-center text-muted-foreground">
                  {t('review.noActivities')}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-8 pt-4">
              <div className="text-center">
                <ThumbsDown className="h-8 w-8 mx-auto text-rose-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.averageLeft')}</span>
              </div>
              <div className="text-center">
                <ThumbsUp className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.excellentAct')}</span>
              </div>
            </div>
          </div>
        );

      case 'awards':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-lg bg-warning text-white shadow-xl mb-4">
                <Trophy className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">{t('review.awards')}</h2>
              <p className="text-muted-foreground">
                {t('review.awardsCount', { count: profile.awards?.length || 0 })}
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {profile.awards && profile.awards.length > 0 ? (
                profile.awards.slice(0, 5).map((award, i) => (
                  <div
                    key={i}
                    className="bg-muted/50 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{award.name}</p>
                      {award.year && <p className="text-sm text-muted-foreground">{award.year}</p>}
                    </div>
                    <Badge
                      className={cn(
                        'text-xs',
                        award.level === 'INTERNATIONAL' && 'bg-primary/10 text-primary',
                        award.level === 'NATIONAL' && 'bg-red-500/10 text-red-600',
                        award.level === 'STATE' && 'bg-blue-500/10 text-blue-600'
                      )}
                    >
                      {award.level}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="bg-muted/50 rounded-xl p-6 text-center text-muted-foreground">
                  {t('review.noAwards')}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-8 pt-4">
              <div className="text-center">
                <ThumbsDown className="h-8 w-8 mx-auto text-rose-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.averageLeft')}</span>
              </div>
              <div className="text-center">
                <ThumbsUp className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <span className="text-sm text-muted-foreground">{t('review.excellentAct')}</span>
              </div>
            </div>
          </div>
        );

      case 'verdict':
        const avgScore = Math.round(
          scores.academic * 0.3 + scores.test * 0.2 + scores.activity * 0.3 + scores.award * 0.2
        );
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-lg bg-gradient-to-br bg-destructive text-white shadow-xl mb-4">
                <Brain className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">{t('review.finalVerdict')}</h2>
            </div>

            {/* 评分汇总 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                <GraduationCap className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <p className="text-xs text-muted-foreground">{t('review.academic')}</p>
                <p className="text-xl font-bold">{scores.academic || '-'}/10</p>
              </div>
              <div className="bg-indigo-500/10 rounded-xl p-4 text-center">
                <BarChart className="h-6 w-6 mx-auto text-indigo-500 mb-1" />
                <p className="text-xs text-muted-foreground">{t('review.scores')}</p>
                <p className="text-xl font-bold">{scores.test || '-'}/10</p>
              </div>
              <div className="bg-orange-500/10 rounded-xl p-4 text-center">
                <BookOpen className="h-6 w-6 mx-auto text-orange-500 mb-1" />
                <p className="text-xs text-muted-foreground">{t('review.activity')}</p>
                <p className="text-xl font-bold">{scores.activity || '-'}/10</p>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-4 text-center">
                <Trophy className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
                <p className="text-xs text-muted-foreground">{t('review.awards')}</p>
                <p className="text-xl font-bold">{scores.award || '-'}/10</p>
              </div>
            </div>

            {/* 总体评分滑块 */}
            <div className="space-y-3">
              <label className="text-sm font-medium">{t('review.finalScore')}</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={scores.overall || avgScore || 5}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, overall: parseInt(e.target.value) }))
                  }
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer"
                />
                <span className="text-2xl font-bold w-12 text-center">
                  {scores.overall || avgScore || 5}
                </span>
              </div>
            </div>

            {/* 评语 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('review.reviewComment')}</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('review.commentPlaceholder')}
                rows={3}
                className="resize-none"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full h-12 gap-2 bg-gradient-to-r bg-destructive hover:opacity-90 text-lg"
            >
              {submitMutation.isPending ? (
                <>{t('review.processing')}</>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  {t('review.submitReview')}
                </>
              )}
            </Button>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm',
        isFullscreen ? '' : 'p-4 md:p-8'
      )}
    >
      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>

        {/* 进度指示器 */}
        <div className="flex items-center gap-1">
          {REVIEW_STEPS.map((step, i) => (
            <div
              key={step.key}
              className={cn(
                'h-1.5 w-8 rounded-full transition-all',
                i < currentStep
                  ? 'bg-primary'
                  : i === currentStep
                    ? `bg-gradient-to-r ${step.color}`
                    : 'bg-muted'
              )}
            />
          ))}
        </div>

        <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
      </div>

      {/* 主内容区 */}
      <div className="h-full flex items-center justify-center px-4 py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            drag={currentStepConfig.key !== 'verdict' ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            style={{ x, rotate, opacity }}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: swipeDirection === 'left' ? -300 : swipeDirection === 'right' ? 300 : 0,
            }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              'w-full max-w-md bg-card rounded-xl shadow-2xl p-6 cursor-grab active:cursor-grabbing',
              'border border-border/50'
            )}
          >
            {/* 步骤标签 */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                  currentStepConfig.color
                )}
              >
                <StepIcon className="h-5 w-5" />
              </div>
              <span className="font-semibold">{currentStepConfig.label}</span>
              <Badge variant="outline" className="ml-2">
                {currentStep + 1}/{REVIEW_STEPS.length}
              </Badge>
            </div>

            {/* 步骤内容 */}
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* 滑动提示覆盖层 */}
        <AnimatePresence>
          {swipeDirection && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'absolute inset-0 flex items-center justify-center pointer-events-none',
                swipeDirection === 'right' ? 'bg-emerald-500/20' : 'bg-rose-500/20'
              )}
            >
              <div
                className={cn(
                  'flex h-24 w-24 items-center justify-center rounded-full',
                  swipeDirection === 'right' ? 'bg-emerald-500' : 'bg-rose-500'
                )}
              >
                {swipeDirection === 'right' ? (
                  <ThumbsUp className="h-12 w-12 text-white" />
                ) : (
                  <ThumbsDown className="h-12 w-12 text-white" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部导航 */}
      {currentStepConfig.key !== 'verdict' && (
        <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-14 w-14 border-rose-500/50 hover:bg-rose-500/10"
            onClick={() => handleSwipe('left')}
          >
            <ThumbsDown className="h-6 w-6 text-rose-500" />
          </Button>

          {currentStep > 0 && (
            <Button
              variant="ghost"
              size="lg"
              className="rounded-full h-14 px-6"
              onClick={() => setCurrentStep((prev) => prev - 1)}
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              {t('review.back')}
            </Button>
          )}

          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-14 w-14 border-emerald-500/50 hover:bg-emerald-500/10"
            onClick={() => handleSwipe('right')}
          >
            <ThumbsUp className="h-6 w-6 text-emerald-500" />
          </Button>
        </div>
      )}
    </div>
  );
}
