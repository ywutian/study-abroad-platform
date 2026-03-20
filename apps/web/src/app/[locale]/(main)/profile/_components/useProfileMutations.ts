'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AI_TIMEOUTS } from '@/lib/constants';
import type { ProfileUpdatePayload, TestScore, Activity, Award, TargetSchool } from './types';

export function useProfileMutations(
  calculateCompleteness: () => number,
  previousCompleteness: number | null,
  setPreviousCompleteness: (v: number) => void,
  setShowCelebration: (v: boolean) => void
) {
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

  const aiSortMutation = useMutation({
    mutationFn: () =>
      apiClient.post(
        '/profiles/me/activities/ai-sort',
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
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/awards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('profile.toast.awardDeleted'));
    },
  });

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
    (newSchools: TargetSchool[], currentSchools: TargetSchool[]) => {
      const currentIds = new Set(currentSchools.map((s) => s.id));
      const newIds = new Set(newSchools.map((s) => s.id));

      for (const school of newSchools) {
        if (!currentIds.has(school.id)) {
          addSchoolMutation.mutate(school.id);
        }
      }

      for (const school of currentSchools) {
        if (!newIds.has(school.id) && school._listItemId) {
          removeSchoolMutation.mutate(school._listItemId);
        }
      }
    },
    [addSchoolMutation, removeSchoolMutation]
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
    // Handlers
    handleEditScore,
    handleEditActivity,
    handleEditAward,
    handleSchoolsChange,
    handleAiSortAccept,
  };
}
