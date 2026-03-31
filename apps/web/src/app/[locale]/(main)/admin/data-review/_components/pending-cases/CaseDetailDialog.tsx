'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { QualityScoreBadge } from '../quality-score-badge';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const RESULT_COLORS: Record<string, string> = {
  ADMITTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WAITLISTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DEFERRED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

interface CaseDetailDialogProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  case_: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
  locale: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CaseDetailDialog = memo(function CaseDetailDialog({
  case_,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isPending,
}: CaseDetailDialogProps) {
  const t = useTranslations('admin.dataReview');
  const td = useTranslations('admin.dataReview.detail');
  const ta = useTranslations('admin.dataReview.actions');
  const te = useTranslations('admin.dataReview.enums');

  const getSchoolName = (c: typeof case_) => c?.school?.nameZh || c?.school?.name || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('detail.caseDetail')}</DialogTitle>
        </DialogHeader>
        {case_ && (
          <div className="space-y-4">
            {/* Basic info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('table.school')}</span>
                <p className="font-medium">{getSchoolName(case_)}</p>
                {case_.school?.usNewsRank && (
                  <p className="text-xs text-muted-foreground">
                    US News #{case_.school.usNewsRank}
                  </p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">{t('table.result')}</span>
                <p>
                  {case_.admissionResult ? (
                    <Badge className={cn('text-xs', RESULT_COLORS[case_.admissionResult] || '')}>
                      {te.has(`result.${case_.admissionResult}`)
                        ? te(`result.${case_.admissionResult}` as never)
                        : case_.admissionResult}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('table.year')}</span>
                <p className="font-medium">{case_.admissionYear || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('table.round')}</span>
                <p className="font-medium">{case_.admissionSeason || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('table.gpa')}</span>
                <p className="font-mono">{case_.gpa?.range || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('table.qualityScore')}</span>
                <QualityScoreBadge score={case_.qualityScore} />
              </div>
              <div>
                <span className="text-muted-foreground">{t('table.source')}</span>
                <p className="text-xs">{case_.source || '—'}</p>
              </div>
            </div>

            {/* Test Scores */}
            {(case_.testScores?.length || case_.sat?.range) && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {td('testScores')}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {case_.sat?.range && (
                      <Badge variant="secondary" className="text-xs font-mono">
                        SAT {case_.sat.range}
                      </Badge>
                    )}
                    {case_.testScores?.map(
                      (ts: { type: string; score?: number; range?: string }, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs font-mono">
                          {ts.type} {ts.score ?? ts.range ?? '—'}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              </>
            )}

            {/* AP / IB */}
            {(case_.apCount || case_.ibScore || case_.apSubjects?.length) && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">{td('apInfo')}</span>
                  <div className="grid grid-cols-2 gap-3 mt-1.5 text-sm">
                    {case_.apCount != null && (
                      <div>
                        <span className="text-muted-foreground">{td('apCount')}</span>
                        <p className="font-mono">{case_.apCount}</p>
                      </div>
                    )}
                    {case_.ibScore != null && (
                      <div>
                        <span className="text-muted-foreground">{td('ibScore')}</span>
                        <p className="font-mono">{case_.ibScore}</p>
                      </div>
                    )}
                  </div>
                  {case_.apSubjects && case_.apSubjects.length > 0 && (
                    <div className="mt-1.5">
                      <span className="text-xs text-muted-foreground">{td('apSubjects')}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {case_.apSubjects.map((subj: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {subj}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* School Background */}
            {(case_.highSchoolType || case_.curriculumType) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {case_.highSchoolType && (
                    <div>
                      <span className="text-muted-foreground">{td('hsType')}</span>
                      <p className="font-medium">
                        {te.has(`hsType.${case_.highSchoolType}`)
                          ? te(`hsType.${case_.highSchoolType}` as never)
                          : case_.highSchoolType}
                      </p>
                    </div>
                  )}
                  {case_.curriculumType && (
                    <div>
                      <span className="text-muted-foreground">{td('curriculum')}</span>
                      <p className="font-medium">
                        {te.has(`curriculum.${case_.curriculumType}`)
                          ? te(`curriculum.${case_.curriculumType}` as never)
                          : case_.curriculumType}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Activities */}
            {(case_.activitiesCount || case_.activities?.length) && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {td('activities')}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {td('activitiesCount', {
                      count: case_.activitiesCount ?? case_.activities?.length ?? 0,
                    })}
                  </p>
                  {case_.activitiesSummary && (
                    <p className="text-sm mt-1">{case_.activitiesSummary}</p>
                  )}
                  {!case_.activitiesSummary && case_.activities && case_.activities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {case_.activities
                        .slice(0, 5)
                        .map(
                          (
                            a: { category?: string; description?: string; role?: string },
                            i: number
                          ) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {(a.category && te.has(`activityCategory.${a.category}`)
                                ? te(`activityCategory.${a.category}` as never)
                                : a.category) ||
                                a.description ||
                                a.role ||
                                `Activity ${i + 1}`}
                            </Badge>
                          )
                        )}
                      {case_.activities.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{case_.activities.length - 5}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Awards */}
            {(case_.awardsCount || case_.awards?.length) && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">{td('awards')}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {td('awardsCount', {
                      count: case_.awardsCount ?? case_.awards?.length ?? 0,
                    })}
                  </p>
                  {case_.awardsSummary && <p className="text-sm mt-1">{case_.awardsSummary}</p>}
                  {!case_.awardsSummary && case_.awards && case_.awards.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {case_.awards
                        .slice(0, 5)
                        .map((a: { name?: string; level?: string }, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {a.name ||
                              (a.level && te.has(`awardLevel.${a.level}`)
                                ? te(`awardLevel.${a.level}` as never)
                                : a.level) ||
                              `Award ${i + 1}`}
                          </Badge>
                        ))}
                      {case_.awards.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{case_.awards.length - 5}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Demographics */}
            {case_.demographicTags && case_.demographicTags.length > 0 && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {td('demographics')}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {case_.demographicTags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {te.has(`demographic.${tag}`) ? te(`demographic.${tag}` as never) : tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Financial Aid & Enrollment */}
            {(case_.financialAid || case_.enrollmentStatus) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {case_.financialAid && (
                    <div>
                      <span className="text-muted-foreground">{td('financialAid')}</span>
                      <p className="font-medium">
                        {te.has(`financialAid.${case_.financialAid}`)
                          ? te(`financialAid.${case_.financialAid}` as never)
                          : case_.financialAid}
                      </p>
                    </div>
                  )}
                  {case_.enrollmentStatus && (
                    <div>
                      <span className="text-muted-foreground">{td('enrollment')}</span>
                      <p className="font-medium">{case_.enrollmentStatus}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Narrative */}
            {case_.narrative && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {td('narrative')}
                  </span>
                  <p className="text-sm mt-1 whitespace-pre-line line-clamp-4">{case_.narrative}</p>
                </div>
              </>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('filter.reset')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => case_ && onReject(case_.id)}
            disabled={isPending}
          >
            <X className="h-4 w-4 mr-1" />
            {ta('reject')}
          </Button>
          <Button onClick={() => case_ && onApprove(case_.id)} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Check className="h-4 w-4 mr-1" />
            {ta('approve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
