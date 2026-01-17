'use client';

/**
 * ReviewTab -- 锐评模式标签页
 *
 * 多步骤向导流程:
 * 1. 选择公开档案 (ProfileSelector)
 * 2. 选择评审模块 / 进入沉浸式 (ModuleSelector)
 * 3. 逐模块评审 (ReviewModuleCard)
 * 4. 汇总确认 & 提交 (ReviewSummaryStep)
 *
 * 所有评分/评语在本地 state 累积，最终一次性提交，
 * 修复了旧版每个模块单独提交导致分数互相覆盖的问题。
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  Users,
  GraduationCap,
  Maximize2,
  BarChart,
  BookOpen,
  Trophy,
  Star,
  ChevronLeft,
  ChevronRight,
  Check,
  Send,
  Tag,
} from 'lucide-react';
import { useSubmitReview, hallKeys, reviewKeys } from '@/hooks/use-hall-api';
import { ProfileSelector } from '@/components/features';
import { ModuleSelector, ReviewModuleCard } from './ReviewModuleCard';
import { SwipeReviewMode } from './SwipeReviewMode';
import type { PublicProfile, ReviewModuleType } from '@/types/hall';
import { cn } from '@/lib/utils';

// 评审维度配置
const REVIEW_DIMENSIONS = [
  { key: 'academic' as const, icon: GraduationCap, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'test' as const, icon: BarChart, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { key: 'activity' as const, icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { key: 'award' as const, icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
] as const;

// 可选标签
const REVIEW_TAGS = [
  'well-rounded',
  'strong-stem',
  'high-gpa',
  'leadership',
  'creative',
  'community-impact',
  'research-oriented',
  'athletic',
];

type DimensionKey = (typeof REVIEW_DIMENSIONS)[number]['key'];

interface ReviewScores {
  academic: number;
  test: number;
  activity: number;
  award: number;
  overall: number;
}

interface ReviewComments {
  academic: string;
  test: string;
  activity: string;
  award: string;
  general: string;
}

type WizardStep = 'select-profile' | 'select-module' | DimensionKey | 'summary';

export function ReviewTab() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // UI state
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [swipeMode, setSwipeMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('select-profile');

  // 累积评审数据
  const [scores, setScores] = useState<ReviewScores>({
    academic: 5,
    test: 5,
    activity: 5,
    award: 5,
    overall: 5,
  });
  const [comments, setComments] = useState<ReviewComments>({
    academic: '',
    test: '',
    activity: '',
    award: '',
    general: '',
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // API
  const submitReviewMutation = useSubmitReview();

  // 向导步骤序列
  const wizardSteps: WizardStep[] = useMemo(
    () => ['select-profile', 'select-module', 'academic', 'test', 'activity', 'award', 'summary'],
    []
  );

  const currentStepIndex = wizardSteps.indexOf(currentStep);
  const progress = Math.max(0, ((currentStepIndex - 1) / (wizardSteps.length - 2)) * 100);

  // 重置所有状态
  const resetAll = useCallback(() => {
    setSelectedProfile(null);
    setCurrentStep('select-profile');
    setScores({ academic: 5, test: 5, activity: 5, award: 5, overall: 5 });
    setComments({ academic: '', test: '', activity: '', award: '', general: '' });
    setSelectedTags([]);
  }, []);

  // 计算加权总分
  const computeOverall = useCallback((s: ReviewScores) => {
    return (
      Math.round((s.academic * 0.3 + s.test * 0.2 + s.activity * 0.3 + s.award * 0.2) * 10) / 10
    );
  }, []);

  // 提交
  const handleSubmit = useCallback(() => {
    if (!selectedProfile) return;

    const finalOverall = scores.overall !== 5 ? scores.overall : Math.round(computeOverall(scores));

    submitReviewMutation.mutate(
      {
        profileUserId: selectedProfile.userId,
        academicScore: scores.academic,
        testScore: scores.test,
        activityScore: scores.activity,
        awardScore: scores.award,
        overallScore: finalOverall,
        comment: comments.general || undefined,
        academicComment: comments.academic || undefined,
        testComment: comments.test || undefined,
        activityComment: comments.activity || undefined,
        awardComment: comments.award || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        status: 'PUBLISHED',
      },
      {
        onSuccess: () => {
          toast.success(t('hall.review.submitSuccess'));
          resetAll();
        },
        onError: (error: Error) => {
          toast.error(error.message);
        },
      }
    );
  }, [
    selectedProfile,
    scores,
    comments,
    selectedTags,
    computeOverall,
    submitReviewMutation,
    t,
    resetAll,
  ]);

  // 导航
  const goNext = useCallback(() => {
    const idx = wizardSteps.indexOf(currentStep);
    if (idx < wizardSteps.length - 1) {
      setCurrentStep(wizardSteps[idx + 1]);
    }
  }, [currentStep, wizardSteps]);

  const goBack = useCallback(() => {
    const idx = wizardSteps.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(wizardSteps[idx - 1]);
    }
  }, [currentStep, wizardSteps]);

  // 标签切换
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // 渲染评审维度卡
  const renderDimensionStep = (dimension: DimensionKey) => {
    const config = REVIEW_DIMENSIONS.find((d) => d.key === dimension)!;
    const Icon = config.icon;

    return (
      <Card className="overflow-hidden">
        <div className={cn('h-1.5', config.bg.replace('/10', ''))} />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                config.bg,
                config.color
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t(`hall.review.dimension.${dimension}`)}</CardTitle>
              <CardDescription>{t(`hall.review.dimensionDesc.${dimension}`)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 评分滑块 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('hall.review.score')}</span>
              <span className="text-2xl font-bold">{scores[dimension]}/10</span>
            </div>
            <Slider
              value={[scores[dimension]]}
              min={1}
              max={10}
              step={1}
              onValueChange={([val]) => setScores((prev) => ({ ...prev, [dimension]: val }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('hall.review.weak')}</span>
              <span>{t('hall.review.average')}</span>
              <span>{t('hall.review.excellent')}</span>
            </div>
          </div>

          {/* 模块评语 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('hall.review.moduleComment')}</label>
            <Textarea
              value={comments[dimension]}
              onChange={(e) => setComments((prev) => ({ ...prev, [dimension]: e.target.value }))}
              placeholder={t(`hall.review.commentHint.${dimension}`)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* 导航按钮 */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={goBack} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
            <Button onClick={goNext} className="gap-1">
              {t('common.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // 渲染汇总步骤
  const renderSummary = () => {
    const suggestedOverall = Math.round(computeOverall(scores));

    return (
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-destructive" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('hall.review.summary')}</CardTitle>
              <CardDescription>{t('hall.review.summaryDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 各维度评分一览 */}
          <div className="grid grid-cols-2 gap-3">
            {REVIEW_DIMENSIONS.map((dim) => {
              const Icon = dim.icon;
              return (
                <div key={dim.key} className={cn('rounded-xl p-4 text-center', dim.bg)}>
                  <Icon className={cn('h-6 w-6 mx-auto mb-1', dim.color)} />
                  <p className="text-xs text-muted-foreground">
                    {t(`hall.review.dimension.${dim.key}`)}
                  </p>
                  <p className="text-xl font-bold">{scores[dim.key]}/10</p>
                </div>
              );
            })}
          </div>

          {/* 综合评分 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('hall.review.finalScore')}</span>
              <span className="text-3xl font-bold text-primary">{scores.overall}/10</span>
            </div>
            <Slider
              value={[scores.overall]}
              min={1}
              max={10}
              step={1}
              onValueChange={([val]) => setScores((prev) => ({ ...prev, overall: val }))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground text-center">
              {t('hall.review.suggestedScore', { score: suggestedOverall })}
            </p>
          </div>

          {/* 标签选择 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('hall.review.tags')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {REVIEW_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* 总评评语 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('hall.review.generalComment')}</label>
            <Textarea
              value={comments.general}
              onChange={(e) => setComments((prev) => ({ ...prev, general: e.target.value }))}
              placeholder={t('hall.review.generalCommentHint')}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={goBack} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitReviewMutation.isPending}
              className="gap-2"
            >
              {submitReviewMutation.isPending ? (
                t('hall.review.processing')
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('hall.review.submitReview')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <motion.div
        key="review"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-6"
      >
        {/* 进度条 (仅在评审步骤显示) */}
        {currentStepIndex >= 2 && (
          <div className="w-full bg-muted rounded-full h-1.5">
            <motion.div
              className="bg-primary h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 'select-profile' && (
              <Card className="overflow-hidden">
                <div className="h-1.5 bg-primary" />
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t('hall.review.selectProfile')}</CardTitle>
                      <CardDescription>{t('hall.review.selectProfileDesc')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ProfileSelector
                    onSelect={(profile) => {
                      setSelectedProfile(profile);
                      setCurrentStep('select-module');
                    }}
                    selectedProfileId={undefined}
                  />
                </CardContent>
              </Card>
            )}

            {currentStep === 'select-module' && selectedProfile && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">
                        {selectedProfile.targetMajor || t('hall.review.noMajor')}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {selectedProfile.gpa && (
                          <Badge variant="secondary">
                            GPA {Number(selectedProfile.gpa).toFixed(2)}
                          </Badge>
                        )}
                        {selectedProfile._count?.activities !== undefined && (
                          <span>
                            {t('hall.review.activitiesCount', {
                              count: selectedProfile._count.activities,
                            })}
                          </span>
                        )}
                        {selectedProfile._count?.awards !== undefined && (
                          <span>
                            {t('hall.review.awardsCount', {
                              count: selectedProfile._count.awards,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetAll}>
                      {t('common.back')}
                    </Button>
                    <Button onClick={() => setSwipeMode(true)} className="gap-2">
                      <Maximize2 className="h-4 w-4" />
                      {t('hall.review.immersiveMode')}
                    </Button>
                    <Button
                      onClick={() => setCurrentStep('academic')}
                      variant="default"
                      className="gap-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                      {t('hall.review.startReview')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 各维度评审步骤 */}
            {(currentStep === 'academic' ||
              currentStep === 'test' ||
              currentStep === 'activity' ||
              currentStep === 'award') &&
              renderDimensionStep(currentStep)}

            {/* 汇总确认 */}
            {currentStep === 'summary' && renderSummary()}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* 沉浸式评审覆盖层 */}
      {swipeMode && selectedProfile && (
        <SwipeReviewMode
          profile={{
            id: selectedProfile.id,
            userId: selectedProfile.userId,
            grade: selectedProfile.grade,
            gpa: selectedProfile.gpa,
            gpaScale: selectedProfile.gpaScale,
            targetMajor: selectedProfile.targetMajor,
            testScores: selectedProfile.testScores || [],
            activities: selectedProfile.activities || [],
            awards: selectedProfile.awards || [],
          }}
          onClose={() => setSwipeMode(false)}
          onComplete={() => {
            setSwipeMode(false);
            resetAll();
            queryClient.invalidateQueries({ queryKey: hallKeys.publicLists() });
          }}
        />
      )}
    </>
  );
}
