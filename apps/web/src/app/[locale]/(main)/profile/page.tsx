'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import dynamic from 'next/dynamic';
import { SchoolSelector } from '@/components/features';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Download, FileText, Save, User, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

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

import { TAB_CONFIG } from './_components/constants';
import type {
  ProfileData,
  ProfileFormData,
  ProfileUpdatePayload,
  TestScore,
  Activity,
  Award,
  TargetSchool,
} from './_components/types';

// Tab content components
import { ProfileHeader } from './_components/profile-header';
import { BasicInfoTab } from './_components/basic-info-tab';
import { DemographicsTab } from './_components/demographics-tab';
import { TestScoresTab } from './_components/test-scores-tab';
import { GpaTab } from './_components/gpa-tab';
import { ActivitiesTab } from './_components/activities-tab';
import { AwardsTab } from './_components/awards-tab';
import { SchoolSelectionTab } from './_components/school-selection-tab';
import { PrivacyTab } from './_components/privacy-tab';

export default function ProfilePage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');

  const { isInitialized, accessToken } = useAuthStore();

  // Form dialogs state
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [awardFormOpen, setAwardFormOpen] = useState(false);
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [defaultRound, setDefaultRound] = useState('RD');
  const [editingScore, setEditingScore] = useState<TestScore | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingAward, setEditingAward] = useState<Award | null>(null);
  const [resumeExportOpen, setResumeExportOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousCompleteness, setPreviousCompleteness] = useState<number | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<ProfileData>('/profiles/me'),
    enabled: isInitialized && !!accessToken,
  });

  const { data: schoolListData } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () =>
      apiClient.get<
        Array<{
          id: string;
          schoolId: string;
          school: {
            id: string;
            name: string;
            nameZh?: string;
            country: string;
            state?: string;
            usNewsRank?: number;
            acceptanceRate?: number;
          };
          tier?: string;
          prediction?: { tier?: string; probability: number };
        }>
      >('/school-lists'),
    enabled: isInitialized && !!accessToken,
  });

  const targetSchools: TargetSchool[] = (schoolListData || []).map((item) => ({
    ...item.school,
    id: item.schoolId,
    _listItemId: item.id,
    tier: item.tier,
    prediction: item.prediction,
  }));

  const addSchoolMutation = useMutation({
    mutationFn: (schoolId: string) =>
      apiClient.post('/school-lists', { schoolId, tier: 'TARGET', round: defaultRound }),
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

  const handleSchoolsChange = useCallback(
    (newSchools: TargetSchool[]) => {
      const currentIds = new Set(targetSchools.map((s) => s.id));
      const newIds = new Set(newSchools.map((s) => s.id));

      for (const school of newSchools) {
        if (!currentIds.has(school.id)) {
          addSchoolMutation.mutate(school.id);
        }
      }

      for (const school of targetSchools) {
        if (!newIds.has(school.id) && school._listItemId) {
          removeSchoolMutation.mutate(school._listItemId);
        }
      }
    },
    [targetSchools, addSchoolMutation, removeSchoolMutation]
  );

  const [formData, setFormData] = useState<ProfileFormData>({
    grade: '',
    currentSchool: '',
    gpa: '',
    gpaScale: '4.0',
    targetMajor: '',
    budgetTier: '',
    visibility: 'PRIVATE',
    nationality: '',
    countryOfResidence: '',
    citizenship: '',
    educationSystem: '',
    needsFinancialAid: false,
    firstGeneration: false,
    legacy: [],
    intendedMajor: '',
    secondMajor: '',
  });

  const calculateCompleteness = useCallback(() => {
    let completed = 0;
    const total = 7;
    if (formData.grade) completed++;
    if (formData.currentSchool) completed++;
    if (formData.gpa) completed++;
    if (formData.targetMajor) completed++;
    if (profile?.testScores && profile.testScores.length > 0) completed++;
    if (profile?.activities && profile.activities.length > 0) completed++;
    if (profile?.awards && profile.awards.length > 0) completed++;
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
    mutationFn: (data: ProfileUpdatePayload) => apiClient.put('/profiles/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('common.success'));
      const newCompleteness = calculateCompleteness();
      if (previousCompleteness !== null && newCompleteness > previousCompleteness) {
        setShowCelebration(true);
      }
      setPreviousCompleteness(newCompleteness);
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

  const reorderActivitiesMutation = useMutation({
    mutationFn: (activityIds: string[]) =>
      apiClient.put('/profiles/me/activities/reorder', { ids: activityIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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
        nationality: profile.nationality || '',
        countryOfResidence: profile.countryOfResidence || '',
        citizenship: profile.citizenship || '',
        educationSystem: profile.educationSystem || '',
        needsFinancialAid: profile.needsFinancialAid ?? false,
        firstGeneration: profile.firstGeneration ?? false,
        legacy: profile.legacy || [],
        intendedMajor: profile.intendedMajor || '',
        secondMajor: profile.secondMajor || '',
      }));
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
      educationSystem: formData.educationSystem || undefined,
      nationality: formData.nationality || undefined,
      countryOfResidence: formData.countryOfResidence || undefined,
      citizenship: formData.citizenship || undefined,
      legacy: formData.legacy.length > 0 ? formData.legacy : undefined,
      intendedMajor: formData.intendedMajor || undefined,
      secondMajor: formData.secondMajor || undefined,
    });
  };

  const handleEditScore = (score: TestScore) => {
    setEditingScore(score);
    setScoreFormOpen(true);
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityFormOpen(true);
  };

  const handleEditAward = (award: Award) => {
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

  const activeTabConfig = TAB_CONFIG.find((tab) => tab.value === activeTab);

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title={t('profile.title')}
        description={t('profile.description')}
        icon={User}
        color="blue"
        actions={
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
        }
      />

      <ProfileHeader
        completeness={completeness}
        profile={profile}
        onOpenResumeExport={() => setResumeExportOpen(true)}
        onSetActiveTab={setActiveTab}
      />

      {/* Main content area */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Tab navigation */}
        <div className="lg:w-64 shrink-0">
          <div className="sticky top-20">
            {/* Desktop vertical navigation */}
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

            {/* Mobile selector */}
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

        {/* Right: Content area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'basic' && (
                <BasicInfoTab formData={formData} onFormDataChange={setFormData} />
              )}

              {activeTab === 'demographics' && (
                <DemographicsTab formData={formData} onFormDataChange={setFormData} />
              )}

              {activeTab === 'scores' && (
                <TestScoresTab
                  testScores={profile?.testScores || []}
                  onAddScore={() => {
                    setEditingScore(null);
                    setScoreFormOpen(true);
                  }}
                  onEditScore={handleEditScore}
                  onDeleteScore={(id) => deleteScoreMutation.mutate(id)}
                />
              )}

              {activeTab === 'gpa' && <GpaTab formData={formData} onFormDataChange={setFormData} />}

              {activeTab === 'activities' && (
                <ActivitiesTab
                  activities={profile?.activities || []}
                  onAddActivity={() => {
                    setEditingActivity(null);
                    setActivityFormOpen(true);
                  }}
                  onEditActivity={handleEditActivity}
                  onDeleteActivity={(id) => deleteActivityMutation.mutate(id)}
                  onReorderActivities={(ids) => reorderActivitiesMutation.mutate(ids)}
                />
              )}

              {activeTab === 'awards' && (
                <AwardsTab
                  awards={profile?.awards || []}
                  onAddAward={() => {
                    setEditingAward(null);
                    setAwardFormOpen(true);
                  }}
                  onEditAward={handleEditAward}
                  onDeleteAward={(id) => deleteAwardMutation.mutate(id)}
                />
              )}

              {activeTab === 'targets' && (
                <SchoolSelectionTab
                  targetSchools={targetSchools}
                  defaultRound={defaultRound}
                  onDefaultRoundChange={setDefaultRound}
                  onOpenSchoolSelector={() => setSchoolSelectorOpen(true)}
                  onRemoveSchool={(listItemId) => removeSchoolMutation.mutate(listItemId)}
                />
              )}

              {activeTab === 'privacy' && (
                <PrivacyTab formData={formData} onFormDataChange={setFormData} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Save button */}
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

      <ResumeExportDialog
        open={resumeExportOpen}
        onOpenChange={setResumeExportOpen}
        profileData={profile}
      />

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
