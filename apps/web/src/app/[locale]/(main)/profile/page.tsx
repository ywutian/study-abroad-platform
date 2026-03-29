'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { SchoolSelector } from '@/components/features';
import { toast } from 'sonner';
import { Download, FileText, Save, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

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
const DataExportDialog = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.DataExportDialog })),
  { ssr: false }
);

import type { ProfileData, ProfileFormData, TargetSchool } from './_components/types';
import { ProfileHeader } from './_components/profile-header';
import { ProfileTabNav } from './_components/ProfileTabNav';
import { useProfileMutations } from './_components/useProfileMutations';
import { BasicInfoTab } from './_components/basic-info-tab';
import { DemographicsTab } from './_components/demographics-tab';
import { TestScoresTab } from './_components/test-scores-tab';
import { GpaTab } from './_components/gpa-tab';
import { ActivitiesTab } from './_components/activities-tab';
import { AwardsTab } from './_components/awards-tab';
import { SchoolSelectionTab } from './_components/school-selection-tab';
import { PrivacyTab } from './_components/privacy-tab';
import { RecommendationLettersTab } from './_components/recommendation-letters-tab';

export default function ProfilePage() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('basic');
  const { isInitialized, accessToken } = useAuthStore();
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousCompleteness, setPreviousCompleteness] = useState<number | null>(null);

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
    gpa9: '',
    gpa10: '',
    gpa11: '',
    gpa12: '',
  });

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
            website?: string;
            scorecardId?: string;
            hasEarlyDecision?: boolean;
            transferAcceptanceRate?: number;
            needBlindInternational?: boolean;
            percentNeedMet?: number;
            averageAidPackage?: number;
            averageNetPrice?: number;
            rankings?: Array<{ source: string; list: string; rank: number; year: number }>;
          };
          tier?: string;
          round?: string;
          essayPromptCount?: number;
          deadlines?: Array<{
            round: string;
            applicationDeadline: string;
            financialAidDeadline?: string;
            interviewRequired: boolean;
            interviewDeadline?: string;
          }>;
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
    round: item.round,
    essayPromptCount: item.essayPromptCount,
    deadlines: item.deadlines,
    prediction: item.prediction,
  }));

  // Completeness from backend (weighted 6-category system)
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      apiClient.get<{ profile: { completeness: number }; pendingTasks: { profileGaps: string[] } }>(
        '/users/me/dashboard'
      ),
    enabled: isInitialized && !!accessToken,
  });
  const calculateCompleteness = useCallback(() => {
    return dashboardData?.profile?.completeness ?? 0;
  }, [dashboardData?.profile?.completeness]);

  const m = useProfileMutations();

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
        gpa9: profile.gpa9?.toString() || '',
        gpa10: profile.gpa10?.toString() || '',
        gpa11: profile.gpa11?.toString() || '',
        gpa12: profile.gpa12?.toString() || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Track completeness changes for milestone celebration
  const currentCompleteness = calculateCompleteness();
  useEffect(() => {
    if (currentCompleteness > 0 && previousCompleteness === null) {
      setPreviousCompleteness(currentCompleteness);
    } else if (previousCompleteness !== null && currentCompleteness > previousCompleteness) {
      setShowCelebration(true);
      setPreviousCompleteness(currentCompleteness);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompleteness]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateBeforeSave = (): boolean => {
    const errors: Record<string, string> = {};
    // GPA scale-aware validation
    if (formData.gpa) {
      const gpa = parseFloat(formData.gpa);
      const scale = parseFloat(formData.gpaScale) || 4.0;
      const maxGpa = scale === 100 ? 100 : scale === 45 ? 45 : scale === 6 ? 6 : scale + 1;
      if (isNaN(gpa) || gpa < 0 || gpa > maxGpa) {
        errors.gpa = t('profile.errors.gpaRange', { max: maxGpa });
      }
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t('profile.errors.fixBeforeSave'));
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateBeforeSave()) return;
    m.updateMutation.mutate({
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
      gpa9: formData.gpa9 ? parseFloat(formData.gpa9) : null,
      gpa10: formData.gpa10 ? parseFloat(formData.gpa10) : null,
      gpa11: formData.gpa11 ? parseFloat(formData.gpa11) : null,
      gpa12: formData.gpa12 ? parseFloat(formData.gpa12) : null,
    });
  };

  const completeness = calculateCompleteness();

  if (isLoading) {
    return (
      <PageContainer maxWidth="5xl">
        <LoadingState variant="profile" />
      </PageContainer>
    );
  }

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
              onClick={() => m.setResumeExportOpen(true)}
            >
              <FileText className="h-4 w-4" />
              {t('profile.exportResume')}
            </Button>
            <DataExportDialog
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  {t('profile.exportData')}
                </Button>
              }
            />
          </div>
        }
      />

      <ProfileHeader
        completeness={completeness}
        profile={profile}
        onOpenResumeExport={() => m.setResumeExportOpen(true)}
        onSetActiveTab={setActiveTab}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <ProfileTabNav activeTab={activeTab} onTabChange={setActiveTab} />

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
                <BasicInfoTab
                  formData={formData}
                  onFormDataChange={setFormData}
                  errors={formErrors}
                />
              )}
              {activeTab === 'demographics' && (
                <DemographicsTab formData={formData} onFormDataChange={setFormData} />
              )}
              {activeTab === 'scores' && (
                <TestScoresTab
                  testScores={profile?.testScores || []}
                  onAddScore={() => {
                    m.setEditingScore(null);
                    m.setScoreFormOpen(true);
                  }}
                  onEditScore={m.handleEditScore}
                  onDeleteScore={(id) => m.deleteScoreMutation.mutate(id)}
                />
              )}
              {activeTab === 'gpa' && (
                <GpaTab
                  formData={formData}
                  onFormDataChange={setFormData}
                  errors={formErrors}
                  semesterGpas={profile?.semesterGpas || []}
                  onCreateSemesterGpa={(data) => m.createSemesterGpaMutation.mutate(data)}
                  onUpdateSemesterGpa={(id, data) =>
                    m.updateSemesterGpaMutation.mutate({ id, ...data })
                  }
                  onDeleteSemesterGpa={(id) => m.deleteSemesterGpaMutation.mutate(id)}
                  isSemesterMutating={
                    m.createSemesterGpaMutation.isPending ||
                    m.updateSemesterGpaMutation.isPending ||
                    m.deleteSemesterGpaMutation.isPending
                  }
                />
              )}
              {activeTab === 'activities' && (
                <ActivitiesTab
                  activities={profile?.activities || []}
                  onAddActivity={() => {
                    m.setEditingActivity(null);
                    m.setActivityFormOpen(true);
                  }}
                  onEditActivity={m.handleEditActivity}
                  onDeleteActivity={(id) => m.deleteActivityMutation.mutate(id)}
                  onReorderActivities={(ids) => m.reorderActivitiesMutation.mutate(ids)}
                  aiSortResult={m.aiSortResult}
                  aiSortPending={m.aiSortMutation.isPending}
                  onAiSort={() => m.aiSortMutation.mutate()}
                  onAiSortAccept={m.handleAiSortAccept}
                  onAiSortDismiss={() => m.setAiSortResult(null)}
                />
              )}
              {activeTab === 'awards' && (
                <AwardsTab
                  awards={profile?.awards || []}
                  onAddAward={() => {
                    m.setEditingAward(null);
                    m.setAwardFormOpen(true);
                  }}
                  onEditAward={m.handleEditAward}
                  onDeleteAward={(id) => m.deleteAwardMutation.mutate(id)}
                />
              )}
              {activeTab === 'targets' && (
                <SchoolSelectionTab
                  targetSchools={targetSchools}
                  defaultRound={m.defaultRound}
                  onDefaultRoundChange={m.setDefaultRound}
                  onOpenSchoolSelector={() => m.setSchoolSelectorOpen(true)}
                  onRemoveSchool={(id) => m.removeSchoolMutation.mutate(id)}
                  onUpdateRound={(listItemId, round) =>
                    m.updateRoundMutation.mutate({ listItemId, round })
                  }
                />
              )}
              {activeTab === 'recLetters' && <RecommendationLettersTab />}
              {activeTab === 'privacy' && (
                <PrivacyTab formData={formData} onFormDataChange={setFormData} />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" className="px-6">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={m.updateMutation.isPending}
              className="px-6 gap-2 bg-primary hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              {m.updateMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>

      {/* Form Dialogs */}
      <TestScoreForm
        open={m.scoreFormOpen}
        onOpenChange={(open) => {
          m.setScoreFormOpen(open);
          if (!open) m.setEditingScore(null);
        }}
        editingScore={m.editingScore}
      />
      <ActivityForm
        open={m.activityFormOpen}
        onOpenChange={(open) => {
          m.setActivityFormOpen(open);
          if (!open) m.setEditingActivity(null);
        }}
        editingActivity={m.editingActivity}
      />
      <AwardForm
        open={m.awardFormOpen}
        onOpenChange={(open) => {
          m.setAwardFormOpen(open);
          if (!open) m.setEditingAward(null);
        }}
        editingAward={m.editingAward}
      />
      <SchoolSelector
        open={m.schoolSelectorOpen}
        onOpenChange={m.setSchoolSelectorOpen}
        selectedSchools={targetSchools}
        onSelect={(schools) => m.handleSchoolsChange(schools, targetSchools)}
        maxSelection={15}
        title={t('profile.actions.selectSchools')}
      />
      <ResumeExportDialog
        open={m.resumeExportOpen}
        onOpenChange={m.setResumeExportOpen}
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
