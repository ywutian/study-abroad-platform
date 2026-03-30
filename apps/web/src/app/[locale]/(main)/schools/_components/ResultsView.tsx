'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { RotateCcw, Plus, Star, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAddToSchoolList } from '@/hooks/use-recommendation';
import type { RecommendationResult, RecommendedSchool } from '@study-abroad/shared';
import { isSafeUrl } from '@/lib/utils/url';
import { CaseComparisonSummary } from '@/components/features/recommendation/CaseComparisonSummary';

const TIER_COLORS = {
  reach: 'bg-red-500/10 text-red-600 dark:text-red-400',
  match: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  safety: 'bg-green-500/10 text-green-600 dark:text-green-400',
} as const;

interface ResultsViewProps {
  result: RecommendationResult;
  schoolList?: Array<{ schoolId: string }>;
  onReset: () => void;
}

export function ResultsView({ result, schoolList, onReset }: ResultsViewProps) {
  const t = useTranslations('recommendation');
  const addToList = useAddToSchoolList();
  const existingSchoolIds = new Set(schoolList?.map((s) => s.schoolId) ?? []);

  const handleAdd = (school: RecommendedSchool) => {
    if (!school.schoolId) return;
    addToList.mutate(
      { schoolId: school.schoolId, tier: school.tier },
      {
        onSuccess: () => toast.success(t('addedToList')),
      }
    );
  };

  return (
    <motion.div
      key="results"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </CardContent>
      </Card>

      {/* School cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.recommendations.map((school, i) => {
          const inList = school.schoolId ? existingSchoolIds.has(school.schoolId) : false;
          return (
            <Card key={school.schoolId ?? i}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <span>{school.schoolName}</span>
                      {school.schoolMeta?.nameZh && (
                        <span className="text-sm font-normal text-muted-foreground">
                          {school.schoolMeta.nameZh}
                        </span>
                      )}
                      {isSafeUrl(school.schoolMeta?.website) && (
                        <a
                          href={school.schoolMeta.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={t('visitWebsite')}
                          title={t('visitWebsite')}
                          className="text-muted-foreground hover:text-primary shrink-0 p-1 -m-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className={TIER_COLORS[school.tier]}>
                        {t(`tiers.${school.tier}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('fitScore')}: {school.fitScore}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('probability')}: {school.estimatedProbability}%
                      </span>
                    </div>
                  </div>
                  {school.schoolId && !inList && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdd(school)}
                      disabled={addToList.isPending}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t('addToList')}
                    </Button>
                  )}
                  {inList && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {t('inList')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <ul className="text-sm space-y-1">
                  {school.reasons.map((r, j) => (
                    <li key={j} className="text-muted-foreground">
                      • {r}
                    </li>
                  ))}
                </ul>
                {school.concerns && school.concerns.length > 0 && (
                  <div className="text-sm text-muted-foreground/70">
                    {school.concerns.map((c, j) => (
                      <span key={j}>⚠ {c} </span>
                    ))}
                  </div>
                )}
                {school.caseComparison && (
                  <CaseComparisonSummary comparison={school.caseComparison} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analysis */}
      {result.analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('analysis')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.analysis.strengths.length > 0 && (
              <div>
                <p className="font-medium text-success mb-1">{t('strengths')}</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {result.analysis.strengths.map((s, i) => (
                    <li key={i}>✓ {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.analysis.weaknesses.length > 0 && (
              <div>
                <p className="font-medium text-destructive mb-1">{t('weaknesses')}</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {result.analysis.weaknesses.map((w, i) => (
                    <li key={i}>✗ {w}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.analysis.improvementTips.length > 0 && (
              <div>
                <p className="font-medium text-primary mb-1">{t('tips')}</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {result.analysis.improvementTips.map((tip, i) => (
                    <li key={i}>💡 {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summer Programs */}
      {result.summerPrograms && result.summerPrograms.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              {t('summerPrograms')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {result.summerPrograms.map((prog, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0 text-xs mt-0.5">
                    {prog.name}
                  </Badge>
                  <span className="text-muted-foreground">{prog.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {t('regenerate')}
        </Button>
      </div>
    </motion.div>
  );
}
