'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import dynamic from 'next/dynamic';
import { SchoolSelector, VerificationStatusCard, PointsOverview } from '@/components/features';

// Code-split heavy form components for better initial load performance
const TestScoreForm = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.TestScoreForm })),
  { ssr: false }
);
const ActivityForm = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.ActivityForm })),
  { ssr: false }
);
const AwardForm = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.AwardForm })),
  { ssr: false }
);
const ResumeExportDialog = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.ResumeExportDialog })),
  { ssr: false }
);
const MilestoneCelebration = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.MilestoneCelebration })),
  { ssr: false }
);
const ProfileAIAnalysis = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.ProfileAIAnalysis })),
  { ssr: false }
);
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import {
  Download,
  FileText,
  Save,
  User,
  GraduationCap,
  Award,
  Target,
  Shield,
  BookOpen,
  BarChart,
  Plus,
  Pencil,
  Trash2,
  Trophy,
  ChevronRight,
  Sparkles,
  Check,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const GRADES = [
  { value: 'FRESHMAN', labelKey: 'profile.grades.freshman' },
  { value: 'SOPHOMORE', labelKey: 'profile.grades.sophomore' },
  { value: 'JUNIOR', labelKey: 'profile.grades.junior' },
  { value: 'SENIOR', labelKey: 'profile.grades.senior' },
  { value: 'GAP_YEAR', labelKey: 'profile.grades.gapYear' },
];

const BUDGET_TIERS = [
  { value: 'LOW', labelKey: 'profile.budgetTiers.low' },
  { value: 'MEDIUM', labelKey: 'profile.budgetTiers.medium' },
  { value: 'HIGH', labelKey: 'profile.budgetTiers.high' },
  { value: 'UNLIMITED', labelKey: 'profile.budgetTiers.unlimited' },
];

const VISIBILITY_OPTIONS = [
  {
    value: 'PRIVATE',
    labelKey: 'profile.visibilityOptions.private',
    descKey: 'profile.visibilityDesc.private',
    icon: Shield,
  },
  {
    value: 'ANONYMOUS',
    labelKey: 'profile.visibilityOptions.anonymous',
    descKey: 'profile.visibilityDesc.anonymous',
    icon: User,
  },
  {
    value: 'VERIFIED_ONLY',
    labelKey: 'profile.visibilityOptions.verifiedOnly',
    descKey: 'profile.visibilityDesc.verifiedOnly',
    icon: Check,
  },
];

const TAB_CONFIG = [
  { value: 'basic', labelKey: 'profile.steps.basic', icon: User, color: 'bg-primary' },
  { value: 'scores', labelKey: 'profile.steps.scores', icon: BarChart, color: 'bg-primary' },
  { value: 'gpa', labelKey: 'profile.steps.gpa', icon: GraduationCap, color: 'bg-success' },
  {
    value: 'activities',
    labelKey: 'profile.steps.activities',
    icon: BookOpen,
    color: 'bg-warning',
  },
  {
    value: 'awards',
    labelKey: 'profile.steps.awards',
    icon: Award,
    color: 'from-yellow-500 to-orange-500',
  },
  { value: 'targets', labelKey: 'profile.steps.targets', icon: Target, color: 'bg-destructive' },
  {
    value: 'privacy',
    labelKey: 'profile.steps.privacy',
    icon: Shield,
    color: 'from-slate-500 to-slate-600',
  },
];

const ACTIVITY_CATEGORY_KEYS: Record<string, string> = {
  ACADEMIC: 'profile.activityCategories.academic',
  ARTS: 'profile.activityCategories.arts',
  ATHLETICS: 'profile.activityCategories.athletics',
  COMMUNITY_SERVICE: 'profile.activityCategories.communityService',
  LEADERSHIP: 'profile.activityCategories.leadership',
  WORK: 'profile.activityCategories.work',
  RESEARCH: 'profile.activityCategories.research',
  OTHER: 'profile.activityCategories.other',
};

const AWARD_LEVEL_KEYS: Record<string, string> = {
  SCHOOL: 'profile.awardLevels.school',
  REGIONAL: 'profile.awardLevels.regional',
  STATE: 'profile.awardLevels.state',
  NATIONAL: 'profile.awardLevels.national',
  INTERNATIONAL: 'profile.awardLevels.international',
};

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');

  // 等待认证初始化完成后再请求数据
  const { isInitialized, accessToken } = useAuthStore();

  // Form dialogs state
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [awardFormOpen, setAwardFormOpen] = useState(false);
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<any>(null);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [editingAward, setEditingAward] = useState<any>(null);
  const [resumeExportOpen, setResumeExportOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousCompleteness, setPreviousCompleteness] = useState<number | null>(null);

  // apiClient 已自动解包 { success, data } -> data
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<any>('/profiles/me'),
    // 只有在认证初始化完成且有 accessToken 时才启用查询
    enabled: isInitialized && !!accessToken,
  });

  // 目标学校列表 (SchoolListItem)
  const { data: schoolListData } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<any[]>('/school-lists'),
    enabled: isInitialized && !!accessToken,
  });
  const targetSchools = (schoolListData || []).map((item: any) => ({
    id: item.schoolId,
    ...item.school,
    _listItemId: item.id,
    tier: item.tier,
  }));

  const addSchoolMutation = useMutation({
    mutationFn: (schoolId: string) => apiClient.post('/school-lists', { schoolId, tier: 'TARGET' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
  });

  const removeSchoolMutation = useMutation({
    mutationFn: (listItemId: string) => apiClient.delete(`/school-lists/${listItemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
  });

  // 处理 SchoolSelector 选择变更
  const handleSchoolsChange = useCallback(
    (newSchools: any[]) => {
      const currentIds = new Set(targetSchools.map((s: any) => s.id));
      const newIds = new Set(newSchools.map((s: any) => s.id));

      // 添加新学校
      for (const school of newSchools) {
        if (!currentIds.has(school.id)) {
          addSchoolMutation.mutate(school.id);
        }
      }

      // 删除被移除的学校
      for (const school of targetSchools) {
        if (!newIds.has(school.id) && school._listItemId) {
          removeSchoolMutation.mutate(school._listItemId);
        }
      }
    },
    [targetSchools, addSchoolMutation, removeSchoolMutation]
  );

  const [formData, setFormData] = useState({
    grade: '',
    currentSchool: '',
    gpa: '',
    gpaScale: '4.0',
    targetMajor: '',
    budgetTier: '',
    visibility: 'PRIVATE',
  });

  // 计算档案完整度 - moved before updateMutation that uses it
  const calculateCompleteness = useCallback(() => {
    let completed = 0;
    const total = 7;
    if (formData.grade) completed++;
    if (formData.currentSchool) completed++;
    if (formData.gpa) completed++;
    if (formData.targetMajor) completed++;
    if (profile?.testScores?.length > 0) completed++;
    if (profile?.activities?.length > 0) completed++;
    if (profile?.awards?.length > 0) completed++;
    return Math.round((completed / total) * 100);
  }, [
    formData.grade,
    formData.currentSchool,
    formData.gpa,
    formData.targetMajor,
    profile?.testScores?.length,
    profile?.activities?.length,
    profile?.awards?.length,
  ]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.put('/profiles/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('common.success'));
      // 检查档案完成度是否提升，显示庆祝动画
      const newCompleteness = calculateCompleteness();
      if (previousCompleteness !== null && newCompleteness > previousCompleteness) {
        setShowCelebration(true);
      }
      setPreviousCompleteness(newCompleteness);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteScoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/test-scores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.toast.scoreDeleted'));
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/activities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.toast.activityDeleted'));
    },
  });

  const deleteAwardMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/awards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.toast.awardDeleted'));
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        grade: profile.grade || '',
        currentSchool: profile.currentSchool || '',
        gpa: profile.gpa?.toString() || '',
        gpaScale: profile.gpaScale?.toString() || '4.0',
        targetMajor: profile.targetMajor || '',
        budgetTier: profile.budgetTier || '',
        visibility: profile.visibility || 'PRIVATE',
      }));
      // 初始化档案完成度记录
      if (previousCompleteness === null) {
        setPreviousCompleteness(calculateCompleteness());
      }
    }
  }, [profile, previousCompleteness]);

  const handleSave = () => {
    updateMutation.mutate({
      ...formData,
      gpa: formData.gpa ? parseFloat(formData.gpa) : null,
      gpaScale: parseFloat(formData.gpaScale),
    });
  };

  const handleEditScore = (score: any) => {
    setEditingScore(score);
    setScoreFormOpen(true);
  };

  const handleEditActivity = (activity: any) => {
    setEditingActivity(activity);
    setActivityFormOpen(true);
  };

  const handleEditAward = (award: any) => {
    setEditingAward(award);
    setAwardFormOpen(true);
  };

  const completeness = calculateCompleteness();

  if (isLoading) {
    return (
      <PageContainer maxWidth="5xl">
        <LoadingState variant="profile" />
      </PageContainer>
    );
  }

  const activeTabConfig = TAB_CONFIG.find((t) => t.value === activeTab);

  return (
    <PageContainer maxWidth="5xl">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* 左侧：标题和描述 */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary border-2 border-primary/20">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-title">{t('profile.title')}</h1>
                <p className="text-muted-foreground">{t('profile.description')}</p>
              </div>
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setResumeExportOpen(true)}
            >
              <FileText className="h-4 w-4" />
              {t('profile.exportResume')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              {t('profile.exportData')}
            </Button>
          </div>
        </div>

        {/* 档案完整度 */}
        <div className="mt-6 rounded-xl border bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">{t('profile.completeness')}</span>
            </div>
            <span className="text-sm font-bold text-blue-500">{completeness}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${completeness}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completeness < 100 ? t('profile.completenessHint') : t('profile.completenessComplete')}
          </p>
        </div>

        {/* AI 智能分析 - 档案有数据时显示 */}
        {completeness >= 30 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <ProfileAIAnalysis compact />
          </motion.div>
        )}

        {/* 积分与认证卡片 */}
        {profile && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <PointsOverview compact />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <VerificationStatusCard userId={profile.userId} compact />
            </motion.div>
          </div>
        )}
      </div>

      {/* 快速开始提示 - 新用户显示 */}
      {completeness < 30 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="overflow-hidden border-blue-500/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-600 dark:text-blue-400">
                    {t('profile.quickStart.title')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('profile.quickStart.description')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('gpa')}
                    className="gap-1.5"
                  >
                    <GraduationCap className="h-4 w-4" />
                    {t('profile.quickStart.fillGpa')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('scores')}
                    className="gap-1.5 bg-primary hover:opacity-90"
                  >
                    <BarChart className="h-4 w-4" />
                    {t('profile.quickStart.fillScore')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 主内容区 */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左侧：Tab 导航 */}
        <div className="lg:w-64 shrink-0">
          <div className="sticky top-20">
            {/* 桌面端垂直导航 */}
            <nav className="hidden lg:block space-y-1">
              {TAB_CONFIG.map((tab, index) => {
                const isActive = activeTab === tab.value;
                return (
                  <motion.button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                        isActive
                          ? `bg-gradient-to-br ${tab.color} text-white shadow-md`
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-sm">{t(tab.labelKey)}</span>
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </motion.button>
                );
              })}
            </nav>

            {/* 移动端选择器 */}
            <div className="lg:hidden">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="h-12">
                  <div className="flex items-center gap-3">
                    {activeTabConfig && (
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                          activeTabConfig.color
                        )}
                      >
                        <activeTabConfig.icon className="h-4 w-4" />
                      </div>
                    )}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {TAB_CONFIG.map((tab) => (
                    <SelectItem key={tab.value} value={tab.value}>
                      <span className="flex items-center gap-2">
                        <tab.icon className="h-4 w-4" />
                        {t(tab.labelKey)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 右侧：内容区 */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Basic Info */}
              {activeTab === 'basic' && (
                <Card className="overflow-hidden">
                  <div className="h-1.5 bg-primary" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-500" />
                      {t('profile.basicInfo')}
                    </CardTitle>
                    <CardDescription>{t('profile.basicInfoDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('profile.fields.grade')}</Label>
                        <Select
                          value={formData.grade}
                          onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={t('profile.placeholders.selectGrade')} />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADES.map((g) => (
                              <SelectItem key={g.value} value={g.value}>
                                {t(g.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {t('profile.fields.currentSchool')}
                        </Label>
                        <Input
                          value={formData.currentSchool}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, currentSchool: e.target.value }))
                          }
                          placeholder={t('profile.fields.currentSchoolPlaceholder')}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        {t('profile.fields.targetMajor')}
                      </Label>
                      <Input
                        value={formData.targetMajor}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, targetMajor: e.target.value }))
                        }
                        placeholder={t('profile.fields.targetMajorPlaceholder')}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t('profile.fields.budget')}</Label>
                      <Select
                        value={formData.budgetTier}
                        onValueChange={(v) => setFormData((p) => ({ ...p, budgetTier: v }))}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={t('profile.placeholders.selectBudget')} />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGET_TIERS.map((b) => (
                            <SelectItem key={b.value} value={b.value}>
                              {t(b.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Test Scores */}
              {activeTab === 'scores' && (
                <Card className="overflow-hidden">
                  <div className="h-1.5 bg-primary dark:bg-primary" />
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-primary" />
                        {t('profile.testScores')}
                      </CardTitle>
                      <CardDescription>{t('profile.testScoresDesc')}</CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingScore(null);
                        setScoreFormOpen(true);
                      }}
                      className="gap-2 bg-primary dark:bg-primary hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t('profile.actions.addScore')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {profile?.testScores?.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {profile.testScores.map((score: any, index: number) => (
                          <motion.div
                            key={score.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative rounded-xl border bg-primary/5 p-4 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary dark:bg-primary text-white shadow-md">
                                  <span className="text-lg font-bold">
                                    {score.type?.slice(0, 2)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-muted-foreground">
                                    {score.type}
                                  </p>
                                  <p className="text-2xl font-bold">{score.score}</p>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditScore(score)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => deleteScoreMutation.mutate(score.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {score.subScores && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(score.subScores).map(([k, v]) => (
                                  <Badge key={k} variant="secondary" className="text-xs">
                                    {k}: {String(v)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                          <BarChart className="h-8 w-8 text-primary/50" />
                        </div>
                        <p className="font-medium">{t('profile.empty.noScores')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('profile.empty.noScoresHint')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* GPA */}
              {activeTab === 'gpa' && (
                <Card className="overflow-hidden">
                  <div className="h-1.5 bg-success" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-emerald-500" />
                      {t('profile.gpa')}
                    </CardTitle>
                    <CardDescription>{t('profile.gpaDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">GPA</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          value={formData.gpa}
                          onChange={(e) => setFormData((p) => ({ ...p, gpa: e.target.value }))}
                          placeholder={t('profile.placeholders.gpaExample')}
                          className="h-11 text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('profile.gpaScale')}</Label>
                        <Select
                          value={formData.gpaScale}
                          onValueChange={(v) => setFormData((p) => ({ ...p, gpaScale: v }))}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4.0">{t('profile.gpaScales.scale4')}</SelectItem>
                            <SelectItem value="5.0">{t('profile.gpaScales.scale5')}</SelectItem>
                            <SelectItem value="100">{t('profile.gpaScales.scale100')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {formData.gpa && (
                      <div className="rounded-xl bg-success/10 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success text-white shadow-lg">
                            <span className="text-xl font-bold">{formData.gpa}</span>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t('profile.yourGpa')}</p>
                            <p className="font-medium">
                              {t(
                                'profile.gpaScales.scale' +
                                  (formData.gpaScale === '100'
                                    ? '100'
                                    : formData.gpaScale === '5.0'
                                      ? '5'
                                      : '4')
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Activities */}
              {activeTab === 'activities' && (
                <Card className="overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r bg-warning" />
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-orange-500" />
                        {t('profile.activities')}
                      </CardTitle>
                      <CardDescription>{t('profile.activitiesDesc')}</CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingActivity(null);
                        setActivityFormOpen(true);
                      }}
                      className="gap-2 bg-gradient-to-r bg-warning hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t('profile.actions.addActivity')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {profile?.activities?.length > 0 ? (
                      <div className="space-y-3">
                        {profile.activities.map((activity: any, index: number) => (
                          <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group rounded-xl border p-4 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-orange-500">
                                  <BookOpen className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold">{activity.name}</p>
                                    <Badge variant="secondary" className="text-xs">
                                      {t(
                                        ACTIVITY_CATEGORY_KEYS[activity.category] ||
                                          'profile.activityCategories.other'
                                      )}
                                    </Badge>
                                    {activity.isOngoing && (
                                      <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                        {t('common.ongoing')}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{activity.role}</p>
                                  {activity.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {activity.description}
                                    </p>
                                  )}
                                  {(activity.hoursPerWeek || activity.weeksPerYear) && (
                                    <p className="text-xs text-muted-foreground">
                                      {activity.hoursPerWeek &&
                                        `${activity.hoursPerWeek} ${t('common.perWeek')}`}
                                      {activity.hoursPerWeek && activity.weeksPerYear && ' · '}
                                      {activity.weeksPerYear &&
                                        `${activity.weeksPerYear} ${t('common.weeksPerYear')}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditActivity(activity)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => deleteActivityMutation.mutate(activity.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-orange-500/10">
                          <BookOpen className="h-8 w-8 text-orange-500/50" />
                        </div>
                        <p className="font-medium">{t('profile.empty.noActivities')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('profile.empty.noActivitiesHint')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Awards */}
              {activeTab === 'awards' && (
                <Card className="overflow-hidden">
                  <div className="h-1.5 bg-warning" />
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        {t('profile.awards')}
                      </CardTitle>
                      <CardDescription>{t('profile.awardsDesc')}</CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingAward(null);
                        setAwardFormOpen(true);
                      }}
                      className="gap-2 bg-warning hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t('profile.actions.addAward')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {profile?.awards?.length > 0 ? (
                      <div className="space-y-3">
                        {profile.awards.map((award: any, index: number) => (
                          <motion.div
                            key={award.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group rounded-xl border p-4 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-yellow-500">
                                  <Trophy className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold">{award.name}</p>
                                    <Badge
                                      className={cn(
                                        'text-xs',
                                        award.level === 'INTERNATIONAL' &&
                                          'bg-primary/10 text-primary border-primary/20',
                                        award.level === 'NATIONAL' &&
                                          'bg-red-500/10 text-red-600 border-red-500/20',
                                        award.level === 'STATE' &&
                                          'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                      )}
                                    >
                                      {t(
                                        AWARD_LEVEL_KEYS[award.level] ||
                                          'profile.awardLevels.school'
                                      )}
                                    </Badge>
                                  </div>
                                  {award.year && (
                                    <p className="text-sm text-muted-foreground">{award.year}</p>
                                  )}
                                  {award.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {award.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditAward(award)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => deleteAwardMutation.mutate(award.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-yellow-500/10">
                          <Trophy className="h-8 w-8 text-yellow-500/50" />
                        </div>
                        <p className="font-medium">{t('profile.empty.noAwards')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('profile.empty.noAwardsHint')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Target Schools */}
              {activeTab === 'targets' && (
                <Card className="overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r bg-destructive" />
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-pink-500" />
                        {t('profile.targetSchools')}
                      </CardTitle>
                      <CardDescription>{t('profile.targetSchoolsDesc')}</CardDescription>
                    </div>
                    <Button
                      onClick={() => setSchoolSelectorOpen(true)}
                      className="gap-2 bg-gradient-to-r bg-destructive hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t('profile.actions.addSchool')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {targetSchools.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {targetSchools.map((school: any, index: number) => (
                          <motion.div
                            key={school.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="group rounded-xl border p-4 hover:shadow-md transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-pink-500 font-bold">
                                  {school.usNewsRank
                                    ? `#${school.usNewsRank}`
                                    : getSchoolName(school, locale).charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold">{getSchoolName(school, locale)}</p>
                                  {getSchoolSubName(school, locale) && (
                                    <p className="text-sm text-muted-foreground">
                                      {getSchoolSubName(school, locale)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  if (school._listItemId) {
                                    removeSchoolMutation.mutate(school._listItemId);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-pink-500/10">
                          <Target className="h-8 w-8 text-pink-500/50" />
                        </div>
                        <p className="font-medium">{t('profile.empty.noTargets')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('profile.empty.noTargetsHint')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Privacy Settings */}
              {activeTab === 'privacy' && (
                <Card className="overflow-hidden">
                  <div className="h-1.5 bg-slate-500" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      {t('profile.visibility')}
                    </CardTitle>
                    <CardDescription>{t('profile.visibilityDesc.title')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={formData.visibility}
                      onValueChange={(v) => setFormData((p) => ({ ...p, visibility: v }))}
                      className="space-y-3"
                    >
                      {VISIBILITY_OPTIONS.map((opt) => {
                        const isSelected = formData.visibility === opt.value;
                        return (
                          <div
                            key={opt.value}
                            className={cn(
                              'relative rounded-xl border p-4 transition-all cursor-pointer',
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => setFormData((p) => ({ ...p, visibility: opt.value }))}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={cn(
                                  'flex h-10 w-10 items-center justify-center rounded-lg transition-all',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                <opt.icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem
                                    value={opt.value}
                                    id={opt.value}
                                    className="sr-only"
                                  />
                                  <Label
                                    htmlFor={opt.value}
                                    className="cursor-pointer font-semibold"
                                  >
                                    {t(opt.labelKey)}
                                  </Label>
                                </div>
                                <p className="text-sm text-muted-foreground">{t(opt.descKey)}</p>
                              </div>
                              {isSelected && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                                  <Check className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          {/* 保存按钮 */}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" className="px-6">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-6 gap-2 bg-primary hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>

      {/* Form Dialogs */}
      <TestScoreForm
        open={scoreFormOpen}
        onOpenChange={(open) => {
          setScoreFormOpen(open);
          if (!open) setEditingScore(null);
        }}
        editingScore={editingScore}
      />
      <ActivityForm
        open={activityFormOpen}
        onOpenChange={(open) => {
          setActivityFormOpen(open);
          if (!open) setEditingActivity(null);
        }}
        editingActivity={editingActivity}
      />
      <AwardForm
        open={awardFormOpen}
        onOpenChange={(open) => {
          setAwardFormOpen(open);
          if (!open) setEditingAward(null);
        }}
        editingAward={editingAward}
      />
      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={targetSchools}
        onSelect={handleSchoolsChange}
        maxSelection={15}
        title={t('profile.actions.selectSchools')}
      />

      {/* 简历导出对话框 */}
      <ResumeExportDialog
        open={resumeExportOpen}
        onOpenChange={setResumeExportOpen}
        profileData={profile}
      />

      {/* 里程碑庆祝动画 */}
      <MilestoneCelebration
        type="profile_complete"
        show={showCelebration}
        title={t('ui.milestone.profileCompleteTitle')}
        message={t('ui.milestone.profileCompleteDesc')}
        onClose={() => setShowCelebration(false)}
      />
    </PageContainer>
  );
}
