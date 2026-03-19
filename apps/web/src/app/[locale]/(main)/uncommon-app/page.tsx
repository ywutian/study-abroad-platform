'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { PageHeader } from '@/components/layout/page-header';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';

import type {
  SchoolListItem,
  Profile,
  AIAnalysis,
  TieredRecommendations,
} from './_components/types';
import { AgentType } from './_components/types';
import {
  callAIAgent,
  extractScore,
  parseMarkdownSections,
  parseSchoolRecommendations,
} from './_components/utils';
import { StepProfileGrading } from './_components/step-profile-grading';
import { StepSchoolLists } from './_components/step-school-lists';
import { StepAIRecommendations } from './_components/step-ai-recommendations';
import { StepResults } from './_components/step-results';

export default function UncommonAppPage() {
  const t = useTranslations('uncommonApp');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [isFlipped, setIsFlipped] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<TieredRecommendations | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  // Fetch user's school list
  const { data: schoolList, isLoading: listLoading } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<SchoolListItem[]>('/school-lists'),
  });

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<Profile>('/profiles/me'),
  });

  // Delete from list mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/school-lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
      toast.success(t('removedFromList'));
    },
  });

  // AI profile analysis
  const profileAnalysisMutation = useMutation({
    mutationFn: () => callAIAgent(AgentType.PROFILE, t('aiPrompts.analyzeProfile')),
    onSuccess: (response) => {
      const parsedSections = parseMarkdownSections(response.message);

      const analysisResult: AIAnalysis = {
        overallScore: extractScore(response.message) || 85,
        admissionPrediction: response.message,
        strengths: response.data?.analysis?.strengths || parsedSections.strengths,
        weaknesses: response.data?.analysis?.weaknesses || parsedSections.weaknesses,
        improvements: response.data?.analysis?.improvements || parsedSections.improvements,
        recommendedActivities: response.data?.analysis?.activities || parsedSections.activities,
        timeline: response.data?.analysis?.timeline || [
          { date: t('defaults.nearTerm'), task: t('defaults.nearTermTask') },
          { date: t('defaults.laterTerm'), task: t('defaults.laterTermTask') },
        ],
        projectedImprovement: response.data?.analysis?.improvement || 15,
      };

      setAnalysis(analysisResult);
      setIsFlipped(true);
      toast.success(t('analysisComplete'));
    },
  });

  const handleGradeProfile = () => profileAnalysisMutation.mutate();
  const isAnalyzing = profileAnalysisMutation.isPending;

  // AI school recommendations
  const aiRecommendationsMutation = useMutation({
    mutationFn: () => callAIAgent(AgentType.SCHOOL, t('aiPrompts.recommendSchools')),
    onSuccess: (response) => {
      let recommendations: TieredRecommendations = {
        reach: response.data?.schools?.filter((s) => s.tier === 'reach' || s.fit === 'reach') || [],
        target:
          response.data?.schools?.filter((s) => s.tier === 'target' || s.fit === 'match') || [],
        safety:
          response.data?.schools?.filter((s) => s.tier === 'safety' || s.fit === 'safety') || [],
      };

      if (
        !recommendations.reach.length &&
        !recommendations.target.length &&
        !recommendations.safety.length
      ) {
        recommendations = parseSchoolRecommendations(response.message);
      }

      if (
        !recommendations.reach.length &&
        !recommendations.target.length &&
        !recommendations.safety.length
      ) {
        setAiRecommendations({
          reach: [{ name: t('defaults.viewRecommendation'), description: response.message }],
          target: [],
          safety: [],
        });
      } else {
        setAiRecommendations(recommendations);
      }

      toast.success(t('aiRecommendationsLoaded'));
    },
  });

  const handleGetAIRecommendations = () => aiRecommendationsMutation.mutate();
  const aiLoading = aiRecommendationsMutation.isPending;

  // Group schools by tier
  const groupedSchools = useMemo(
    () => ({
      REACH: schoolList?.filter((s) => s.tier === 'REACH') || [],
      TARGET: schoolList?.filter((s) => s.tier === 'TARGET') || [],
      SAFETY: schoolList?.filter((s) => s.tier === 'SAFETY') || [],
    }),
    [schoolList]
  );

  // Calculate profile completeness
  const profileScore = useMemo(
    () =>
      profile
        ? (profile.gpa ? 20 : 0) +
          (profile.testScores?.length ? 30 : 0) +
          (profile.activities?.length ? 25 : 0) +
          (profile.awards?.length ? 25 : 0)
        : 0,
    [profile]
  );

  return (
    <AIErrorBoundary feature="uncommon-app">
      <PageContainer maxWidth="7xl">
        <PageHeader
          title={t('title')}
          description={t('description')}
          icon={GraduationCap}
          color="violet"
        />

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Side - School List + AI Recommendations */}
          <div className="space-y-6">
            <StepSchoolLists
              t={t}
              locale={locale}
              schoolList={schoolList}
              listLoading={listLoading}
              groupedSchools={groupedSchools}
              onDelete={(id) => deleteMutation.mutate(id)}
            />

            <StepAIRecommendations
              t={t}
              locale={locale}
              aiLoading={aiLoading}
              aiRecommendations={aiRecommendations}
              onGetRecommendations={handleGetAIRecommendations}
            />
          </div>

          {/* Right Side - Profile with Flip Card */}
          <div className="relative" style={{ perspective: '1000px' }}>
            <motion.div
              className="relative w-full"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: 'spring' }}
            >
              {/* Front - Profile */}
              <div className={cn(isFlipped && 'invisible')}>
                <StepProfileGrading
                  t={t}
                  profile={profile}
                  profileLoading={profileLoading}
                  profileScore={profileScore}
                  isAnalyzing={isAnalyzing}
                  onGradeProfile={handleGradeProfile}
                />
              </div>

              {/* Back - AI Analysis */}
              <div className={cn(!isFlipped && 'invisible')}>
                <StepResults
                  t={t}
                  analysis={analysis}
                  isAnalyzing={isAnalyzing}
                  onReAnalyze={handleGradeProfile}
                  onDone={() => setIsFlipped(false)}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </PageContainer>
    </AIErrorBoundary>
  );
}
