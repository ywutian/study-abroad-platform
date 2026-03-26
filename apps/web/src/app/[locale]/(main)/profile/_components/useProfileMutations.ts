'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AI_TIMEOUTS } from '@/lib/constants';
import { profileRoutes, schoolListRoutes } from '@study-abroad/shared';
import type { ProfileUpdatePayload, TestScore, Activity, Award, TargetSchool } from './types';

type AddErrorType = 'duplicate' | 'binding' | 'unavailable' | 'unknown';

function classifyAddError(error: unknown): AddErrorType {
  if (error instanceof ApiError && error.code) {
    switch (error.code) {
      case 'SCHOOL_LIST_DUPLICATE':
        return 'duplicate';
      case 'SCHOOL_LIST_BINDING_CONFLICT':
        return 'binding';
      case 'SCHOOL_LIST_ROUND_UNAVAILABLE':
        return 'unavailable';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

function getAddErrorMessage(
  t: ReturnType<typeof useTranslations>,
  errorType: AddErrorType,
  school: string,
  details?: Record<string, unknown>
): string {
  switch (errorType) {
    case 'duplicate':
      return t('profile.toast.addErrorDuplicate', { school });
    case 'binding':
      return t('profile.toast.addErrorBinding', {
        school,
        round: (details?.round as string) || (details?.conflictingRound as string) || 'ED',
      });
    case 'unavailable':
      return t('profile.toast.addErrorUnavailable', {
        school,
        round: (details?.round as string) || '',
      });
    default:
      return t('profile.toast.addErrorGeneric', { school });
  }
}

export function useProfileMutations() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Form dialog state
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [awardFormOpen, setAwardFormOpen] = useState(false);
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [defaultRound, setDefaultRound] = useState('RD');
  const [editingScore, setEditingScore] = useState<TestScore | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingAward, setEditingAward] = useState<Award | null>(null);
  const [resumeExportOpen, setResumeExportOpen] = useState(false);

  // AI sort state
  const [aiSortResult, setAiSortResult] = useState<{
    suggestedOrder: Array<{ activityId: string; rank: number; reasoning: string }>;
    summary: string;
  } | null>(null);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: ProfileUpdatePayload) => apiClient.put(profileRoutes.me(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(t('common.success'));
    },
  });

  const deleteScoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(profileRoutes.testScore(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.toast.scoreDeleted'));
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(profileRoutes.activity(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.toast.activityDeleted'));
    },
  });

  const reorderActivitiesMutation = useMutation({
    mutationFn: (activityIds: string[]) =>
      apiClient.put(`${profileRoutes.activities()}/reorder`, { ids: activityIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const aiSortMutation = useMutation({
    mutationFn: () =>
      apiClient.post(
        `${profileRoutes.activities()}/ai-sort`,
        {},
        { timeout: AI_TIMEOUTS.AI_REQUEST }
      ) as Promise<{
        suggestedOrder: Array<{ activityId: string; rank: number; reasoning: string }>;
        summary: string;
      }>,
    onSuccess: (data) => {
      setAiSortResult(data);
    },
  });

  const deleteAwardMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(profileRoutes.award(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.toast.awardDeleted'));
    },
  });

  const addSchoolMutation = useMutation({
    mutationFn: ({ schoolId, round }: { schoolId: string; round: string }) =>
      apiClient.post(schoolListRoutes.list(), { schoolId, tier: 'TARGET', round }),
    meta: { skipGlobalErrorToast: true },
  });

  const removeSchoolMutation = useMutation({
    mutationFn: (listItemId: string) => apiClient.delete(schoolListRoutes.byId(listItemId)),
  });

  const updateRoundMutation = useMutation({
    mutationFn: ({ listItemId, round }: { listItemId: string; round: string }) =>
      apiClient.put(schoolListRoutes.byId(listItemId), { round }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
      toast.success(t('profile.toast.roundUpdated'));
    },
  });

  // Semester GPA mutations
  const createSemesterGpaMutation = useMutation({
    mutationFn: (data: {
      semester: string;
      year: number;
      gpa: number;
      gpaScale: number;
      credits?: number;
      order?: number;
    }) => apiClient.post(`${profileRoutes.me()}/semester-gpas`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.semesterGpaAdded'));
    },
  });

  const updateSemesterGpaMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      semester?: string;
      year?: number;
      gpa?: number;
      gpaScale?: number;
      credits?: number;
      order?: number;
    }) => apiClient.put(`${profileRoutes.me()}/semester-gpas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.semesterGpaUpdated'));
    },
  });

  const deleteSemesterGpaMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${profileRoutes.me()}/semester-gpas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.semesterGpaDeleted'));
    },
  });

  // Handlers
  const handleEditScore = useCallback((score: TestScore) => {
    setEditingScore(score);
    setScoreFormOpen(true);
  }, []);

  const handleEditActivity = useCallback((activity: Activity) => {
    setEditingActivity(activity);
    setActivityFormOpen(true);
  }, []);

  const handleEditAward = useCallback((award: Award) => {
    setEditingAward(award);
    setAwardFormOpen(true);
  }, []);

  const handleSchoolsChange = useCallback(
    async (newSchools: TargetSchool[], currentSchools: TargetSchool[]) => {
      const currentIds = new Set(currentSchools.map((s) => s.id));
      const newIds = new Set(newSchools.map((s) => s.id));

      const toAdd = newSchools.filter((s) => !currentIds.has(s.id));
      const toRemove = currentSchools.filter((s) => !newIds.has(s.id) && s._listItemId);

      // Add new schools in parallel — capture per-school errors
      const failures: { school: string; reason: string }[] = [];
      const addResults = await Promise.allSettled(
        toAdd.map(async (school) => {
          const schoolName = school.nameZh || school.name;
          try {
            await addSchoolMutation.mutateAsync({
              schoolId: school.id,
              round: defaultRound,
            });
          } catch (err) {
            if (defaultRound !== 'RD') {
              try {
                await addSchoolMutation.mutateAsync({ schoolId: school.id, round: 'RD' });
                return;
              } catch (retryErr) {
                const errorType = classifyAddError(retryErr);
                const details = retryErr instanceof ApiError ? retryErr.details : undefined;
                failures.push({
                  school: schoolName,
                  reason: getAddErrorMessage(t, errorType, schoolName, details),
                });
                throw retryErr;
              }
            }
            const errorType = classifyAddError(err);
            const details = err instanceof ApiError ? err.details : undefined;
            failures.push({
              school: schoolName,
              reason: getAddErrorMessage(t, errorType, schoolName, details),
            });
            throw err;
          }
        })
      );
      const addedCount = addResults.filter((r) => r.status === 'fulfilled').length;
      const failedCount = addResults.filter((r) => r.status === 'rejected').length;

      // Remove schools in parallel
      await Promise.allSettled(
        toRemove.map((school) => removeSchoolMutation.mutateAsync(school._listItemId!))
      );

      // Batch invalidation — single refetch after all mutations
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });

      // Summary toast with per-school error details
      if (addedCount > 0 && failedCount === 0) {
        toast.success(t('profile.toast.schoolsAdded', { count: addedCount }));
      } else if (failedCount > 0) {
        const toastFn = addedCount > 0 ? toast.warning : toast.error;
        const title =
          addedCount > 0
            ? t('profile.toast.schoolsPartialAdd', { added: addedCount, failed: failedCount })
            : t('profile.toast.schoolsAddFailed', { count: failedCount });

        if (failures.length > 0) {
          const displayFailures = failures.slice(0, 3);
          const remaining = failures.length - 3;
          toastFn(title, {
            description:
              displayFailures.map((f) => f.reason).join(' · ') +
              (remaining > 0 ? ` (+${remaining} more)` : ''),
            duration: Math.min(Math.max(5000, failedCount * 3000), 15000),
          });
        } else {
          toastFn(title);
        }
      }
      if (toRemove.length > 0 && toAdd.length === 0) {
        toast.success(t('profile.toast.schoolRemoved'));
      }
    },
    [addSchoolMutation, removeSchoolMutation, defaultRound, queryClient, t]
  );

  const handleAiSortAccept = useCallback(
    (ids: string[]) => {
      reorderActivitiesMutation.mutate(ids);
      setAiSortResult(null);
      toast.success(t('profile.aiSortApplied'));
    },
    [reorderActivitiesMutation, t]
  );

  return {
    // Dialog state
    scoreFormOpen,
    setScoreFormOpen,
    activityFormOpen,
    setActivityFormOpen,
    awardFormOpen,
    setAwardFormOpen,
    schoolSelectorOpen,
    setSchoolSelectorOpen,
    defaultRound,
    setDefaultRound,
    editingScore,
    setEditingScore,
    editingActivity,
    setEditingActivity,
    editingAward,
    setEditingAward,
    resumeExportOpen,
    setResumeExportOpen,
    // AI sort
    aiSortResult,
    setAiSortResult,
    aiSortMutation,
    // Mutations
    updateMutation,
    deleteScoreMutation,
    deleteActivityMutation,
    reorderActivitiesMutation,
    deleteAwardMutation,
    addSchoolMutation,
    removeSchoolMutation,
    updateRoundMutation,
    createSemesterGpaMutation,
    updateSemesterGpaMutation,
    deleteSemesterGpaMutation,
    // Handlers
    handleEditScore,
    handleEditActivity,
    handleEditAward,
    handleSchoolsChange,
    handleAiSortAccept,
  };
}
