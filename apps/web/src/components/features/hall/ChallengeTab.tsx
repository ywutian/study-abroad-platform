'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { hallRoutes } from '@study-abroad/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import type { SchoolRanking } from '@/lib/utils/ranking';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Target,
  RefreshCw,
  CheckCircle2,
  XCircle,
  GraduationCap,
  Award,
  BookOpen,
  Globe,
  Briefcase,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChallengeCase {
  applicantProfile: {
    grade?: string;
    schoolType?: string;
    gpa?: string;
    sat?: string;
    toefl?: string;
    activityCount: number;
    activityHighlights?: string[];
    awardCount?: number;
    highestAwardLevel?: string;
    apCount?: number;
    nationality?: string;
    targetMajor?: string;
  };
  schools: Array<{
    caseId: string;
    schoolId: string;
    schoolName: string;
    schoolNameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
    major?: string;
    round?: string;
    rankings?: SchoolRanking[];
  }>;
}

interface ChallengeResult {
  results: Array<{
    caseId: string;
    schoolName: string;
    guess: string;
    actual: string;
    isCorrect: boolean;
  }>;
  correct: number;
  total: number;
  accuracy: number;
}

// 2026-05 Hall Plan C: these guess values are compared verbatim against the
// AdmissionCase `result` enum server-side (`guess === actual`), so they MUST
// be the exact enum values — ADMITTED (not "ACCEPTED"), REJECTED, WAITLISTED.
// The backend deck filters cases to exactly these three (DEFERRED excluded —
// it can never match a guess). Keep this list in sync with that filter.
const RESULT_OPTIONS = ['ADMITTED', 'REJECTED', 'WAITLISTED'];

export function ChallengeTab() {
  const t = useTranslations('hall');
  const queryClient = useQueryClient();
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ChallengeResult | null>(null);

  const {
    data: challenge,
    isLoading,
    refetch,
  } = useQuery<ChallengeCase>({
    queryKey: ['hall-challenge'],
    queryFn: () => apiClient.get(`${hallRoutes.swipe()}/challenge`),
  });

  const submitMutation = useMutation({
    mutationFn: (guessData: Record<string, string>) =>
      apiClient.post<ChallengeResult>(`${hallRoutes.swipe()}/challenge`, { guesses: guessData }),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleNewChallenge = useCallback(() => {
    setGuesses({});
    setResult(null);
    queryClient.invalidateQueries({ queryKey: ['hall-challenge'] });
    refetch();
  }, [queryClient, refetch]);

  const challengeSchools = Array.isArray(challenge?.schools) ? challenge.schools : [];
  const allGuessed =
    challengeSchools.length > 0 && challengeSchools.every((s) => guesses[s.caseId]);

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <LoadingState text={t('challenge.loading')} />
      </motion.div>
    );
  }

  if (!challenge) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <EmptyState
          icon={<Target className="h-8 w-8" />}
          title={t('challenge.empty')}
          description={t('challenge.emptyDesc')}
        />
      </motion.div>
    );
  }

  const applicantProfile = challenge.applicantProfile ?? {
    activityCount: 0,
    activityHighlights: [],
  };
  const schools = Array.isArray(challenge.schools) ? challenge.schools : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Applicant Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-amber-500" />
            {t('challenge.applicantProfile')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {applicantProfile.gpa && (
              <div>
                <p className="text-xs text-muted-foreground">GPA</p>
                <p className="font-medium">{applicantProfile.gpa}</p>
              </div>
            )}
            {applicantProfile.sat && (
              <div>
                <p className="text-xs text-muted-foreground">SAT</p>
                <p className="font-medium">{applicantProfile.sat}</p>
              </div>
            )}
            {applicantProfile.toefl && (
              <div>
                <p className="text-xs text-muted-foreground">TOEFL</p>
                <p className="font-medium">{applicantProfile.toefl}</p>
              </div>
            )}
            {applicantProfile.grade && (
              <div>
                <p className="text-xs text-muted-foreground">{t('challenge.grade')}</p>
                <p className="font-medium">{applicantProfile.grade}</p>
              </div>
            )}
            {applicantProfile.schoolType && (
              <div>
                <p className="text-xs text-muted-foreground">{t('challenge.schoolType')}</p>
                <p className="font-medium">{applicantProfile.schoolType}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{t('challenge.activities')}</p>
              <p className="font-medium">{applicantProfile.activityCount}</p>
            </div>
            {applicantProfile.apCount != null && applicantProfile.apCount > 0 && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {t('challenge.apCount')}
                </p>
                <p className="font-medium">{applicantProfile.apCount}</p>
              </div>
            )}
            {applicantProfile.awardCount != null && applicantProfile.awardCount > 0 && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  {t('challenge.awards')}
                </p>
                <p className="font-medium">
                  {applicantProfile.awardCount}
                  {applicantProfile.highestAwardLevel && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({t('challenge.highestLevel', { level: applicantProfile.highestAwardLevel })})
                    </span>
                  )}
                </p>
              </div>
            )}
            {applicantProfile.nationality && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {t('challenge.nationality')}
                </p>
                <p className="font-medium">{applicantProfile.nationality}</p>
              </div>
            )}
            {applicantProfile.targetMajor && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {t('challenge.targetMajor')}
                </p>
                <p className="font-medium">{applicantProfile.targetMajor}</p>
              </div>
            )}
          </div>

          {/* Activity Highlights */}
          {applicantProfile.activityHighlights &&
            applicantProfile.activityHighlights.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  {t('challenge.activityHighlights')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {applicantProfile.activityHighlights.map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-xs">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Schools to Predict */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('challenge.predictResults')} ({schools.length} {t('challenge.schools')})
        </h3>

        {schools.map((school) => {
          const schoolResult = result?.results.find((r) => r.caseId === school.caseId);

          return (
            <Card
              key={school.caseId}
              className={
                schoolResult
                  ? schoolResult.isCorrect
                    ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10'
                    : 'border-destructive/50 bg-destructive/5'
                  : ''
              }
            >
              <CardContent className="flex items-center justify-between py-4 px-4 sm:px-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{school.schoolName}</p>
                    <RankingBadge rankings={school.rankings} usNewsRank={school.usNewsRank} />
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    {school.major && <span>{school.major}</span>}
                    {school.round && <span>{school.round}</span>}
                  </div>
                </div>

                <div className="ml-4 shrink-0 w-40">
                  {schoolResult ? (
                    <div className="flex items-center gap-2">
                      {schoolResult.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div className="text-xs">
                        <p className="font-medium">
                          {t(`challenge.results.${schoolResult.actual}`)}
                        </p>
                        {!schoolResult.isCorrect && (
                          <p className="text-muted-foreground">
                            {t('challenge.yourGuess')}:{' '}
                            {t(`challenge.results.${schoolResult.guess}`)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Select
                      value={guesses[school.caseId] || ''}
                      onValueChange={(val) =>
                        setGuesses((prev) => ({ ...prev, [school.caseId]: val }))
                      }
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder={t('challenge.selectResult')} />
                      </SelectTrigger>
                      <SelectContent>
                        {RESULT_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {t(`challenge.results.${opt}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Result Summary — 2026-05 Hall Plan C (C3): de-gamified. A plain
          "how many you read correctly" debrief, no trophy/gradient framing. */}
      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="flex items-center gap-3 py-5 px-6">
              <Target className="h-5 w-5 shrink-0 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                {t('challenge.summary', {
                  correct: result.correct,
                  total: result.total,
                })}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!result ? (
          <Button
            onClick={() => submitMutation.mutate(guesses)}
            disabled={!allGuessed || submitMutation.isPending}
            className="flex-1"
          >
            <Target className="h-4 w-4 mr-2" />
            {submitMutation.isPending ? t('challenge.submitting') : t('challenge.submit')}
          </Button>
        ) : (
          <Button onClick={handleNewChallenge} className="flex-1" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('challenge.newChallenge')}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
