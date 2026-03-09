'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Target, RefreshCw, CheckCircle2, XCircle, GraduationCap, Trophy } from 'lucide-react';
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
  };
  schools: Array<{
    caseId: string;
    schoolId: string;
    schoolName: string;
    schoolNameZh?: string;
    usNewsRank?: number;
    major?: string;
    round?: string;
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

const RESULT_OPTIONS = ['ACCEPTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'];

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
    queryFn: () => apiClient.get('/halls/swipe/challenge'),
  });

  const submitMutation = useMutation({
    mutationFn: (guesses: Record<string, string>) =>
      apiClient.post<ChallengeResult>('/halls/swipe/challenge', { guesses }),
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

  const allGuessed =
    challenge?.schools &&
    challenge.schools.length > 0 &&
    challenge.schools.every((s) => guesses[s.caseId]);

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
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {challenge.applicantProfile.gpa && (
              <div>
                <p className="text-xs text-muted-foreground">GPA</p>
                <p className="font-medium">{challenge.applicantProfile.gpa}</p>
              </div>
            )}
            {challenge.applicantProfile.sat && (
              <div>
                <p className="text-xs text-muted-foreground">SAT</p>
                <p className="font-medium">{challenge.applicantProfile.sat}</p>
              </div>
            )}
            {challenge.applicantProfile.toefl && (
              <div>
                <p className="text-xs text-muted-foreground">TOEFL</p>
                <p className="font-medium">{challenge.applicantProfile.toefl}</p>
              </div>
            )}
            {challenge.applicantProfile.grade && (
              <div>
                <p className="text-xs text-muted-foreground">{t('challenge.grade')}</p>
                <p className="font-medium">{challenge.applicantProfile.grade}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{t('challenge.activities')}</p>
              <p className="font-medium">{challenge.applicantProfile.activityCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schools to Predict */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('challenge.predictResults')} ({challenge.schools.length} {t('challenge.schools')})
        </h3>

        {challenge.schools.map((school) => {
          const schoolResult = result?.results.find((r) => r.caseId === school.caseId);

          return (
            <Card
              key={school.caseId}
              className={
                schoolResult
                  ? schoolResult.isCorrect
                    ? 'border-green-500/50 bg-green-50/30 dark:bg-green-950/10'
                    : 'border-red-500/50 bg-red-50/30 dark:bg-red-950/10'
                  : ''
              }
            >
              <CardContent className="flex items-center justify-between py-4 px-4 sm:px-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{school.schoolName}</p>
                    {school.usNewsRank && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        #{school.usNewsRank}
                      </Badge>
                    )}
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
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
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

      {/* Result Summary */}
      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
            <CardContent className="flex items-center justify-between py-6 px-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg">
                  <Trophy className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.accuracy}%</p>
                  <p className="text-sm text-muted-foreground">
                    {result.correct}/{result.total} {t('challenge.correct')}
                  </p>
                </div>
              </div>
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
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
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
