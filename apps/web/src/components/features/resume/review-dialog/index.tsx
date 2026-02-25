'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from './overview-tab';
import { SectionTab } from './section-tab';
import { GapsTab } from './gaps-tab';
import type { ResumeReviewResult, ResumeReviewResultV1, SectionIssue } from '@study-abroad/shared';
import type { SectionConfig } from '../pdf/types';

// V1 fallback imports (keep current rendering for old data)
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

function isV2Review(result: unknown): result is ResumeReviewResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'version' in result &&
    (result as any).version === 2
  );
}

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ResumeReviewResult | ResumeReviewResultV1 | null;
  sections?: SectionConfig[] | null;
  onSectionContentChange?: (sectionId: string, content: Record<string, unknown>) => void;
  reviewedAt?: string | null;
  onRerun?: () => void;
  isRerunning?: boolean;
}

export function ReviewDialog({
  open,
  onOpenChange,
  result,
  sections,
  onSectionContentChange,
  reviewedAt,
  onRerun,
  isRerunning,
}: ReviewDialogProps) {
  const t = useTranslations('resume.aiReview');

  const handleApplySuggestion = useCallback(
    (sectionId: string, issue: SectionIssue): boolean => {
      if (!sections || !onSectionContentChange) return false;

      const section = sections.find((s) => s.id === sectionId);
      if (!section) return false;

      const content = { ...section.content } as any;
      if (!content.items || !Array.isArray(content.items)) return false;

      let applied = false;

      // Try to find and replace the original text in bullets
      for (const item of content.items) {
        if (!item.bullets || !Array.isArray(item.bullets)) continue;

        // Try bulletIndex first
        if (issue.bulletIndex !== undefined && issue.bulletIndex < item.bullets.length) {
          const bullet = item.bullets[issue.bulletIndex];
          if (typeof bullet === 'string' && bullet.includes(issue.original)) {
            item.bullets[issue.bulletIndex] = bullet.replace(issue.original, issue.suggestion);
            applied = true;
            break;
          }
        }

        // Fallback: search all bullets for the original text
        if (!applied) {
          for (let i = 0; i < item.bullets.length; i++) {
            const bullet = item.bullets[i];
            if (typeof bullet === 'string' && bullet.includes(issue.original)) {
              item.bullets[i] = bullet.replace(issue.original, issue.suggestion);
              applied = true;
              break;
            }
          }
        }

        if (applied) break;
      }

      if (applied) {
        onSectionContentChange(sectionId, content);
        toast.success(t('applied'));
        return true;
      }

      toast.error(t('cannotApply'));
      return false;
    },
    [sections, onSectionContentChange, t]
  );

  if (!result) return null;

  // V2: new tabbed UI
  if (isV2Review(result)) {
    const totalIssues = result.sectionFeedback.reduce((sum, sf) => sum + sf.issues.length, 0);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('title')}
            </DialogTitle>
            <div className="flex items-center justify-between">
              {reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  {t('reviewedAt', { time: new Date(reviewedAt).toLocaleString() })}
                </p>
              )}
              {onRerun && (
                <Button variant="ghost" size="sm" onClick={onRerun} disabled={isRerunning}>
                  {isRerunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  {t('rerun')}
                </Button>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
              <TabsTrigger value="sections">
                {t('tabs.sectionFeedback')}
                {totalIssues > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {totalIssues}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="gaps">
                {t('tabs.contentGaps')}
                {result.contentGaps.length > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted-foreground/20 px-1 text-[10px]">
                    {result.contentGaps.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab result={result} />
            </TabsContent>

            <TabsContent value="sections">
              <SectionTab
                sectionFeedback={result.sectionFeedback}
                onApplySuggestion={
                  sections && onSectionContentChange ? handleApplySuggestion : undefined
                }
              />
            </TabsContent>

            <TabsContent value="gaps">
              <GapsTab contentGaps={result.contentGaps} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  }

  // V1 fallback: legacy rendering for old review data
  const v1 = result as ResumeReviewResultV1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('title')}
          </DialogTitle>
          <div className="flex items-center justify-between">
            {reviewedAt && (
              <p className="text-xs text-muted-foreground">
                {t('reviewedAt', { time: new Date(reviewedAt).toLocaleString() })}
              </p>
            )}
            {onRerun && (
              <Button variant="ghost" size="sm" onClick={onRerun} disabled={isRerunning}>
                {isRerunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                {t('rerun')}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Score */}
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  strokeWidth="6"
                  strokeDasharray={`${(v1.overallScore / 100) * 220} 220`}
                  strokeLinecap="round"
                  className={
                    v1.overallScore >= 70
                      ? 'text-green-500'
                      : v1.overallScore >= 40
                        ? 'text-yellow-500'
                        : 'text-red-500'
                  }
                  stroke="currentColor"
                />
              </svg>
              <span className="absolute text-xl font-bold">{v1.overallScore}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{v1.summary}</p>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">{t('dimensions')}</h4>
            {v1.dimensions.map((dim) => (
              <div key={dim.name} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {dim.status === 'green' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : dim.status === 'yellow' ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">{t(`dim.${dim.name}`)}</span>
                  </div>
                  <span className="text-sm font-semibold">{dim.score}</span>
                </div>
                <Progress value={dim.score} className="mb-2 h-1.5" />
                <p className="text-xs text-muted-foreground">{dim.feedback}</p>
                {dim.improvements.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {dim.improvements.map((imp, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {imp}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Bullet Quality */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t('bulletQuality')}</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {v1.bulletQuality.actionVerbUsage}%
                </div>
                <div className="text-xs text-muted-foreground">{t('actionVerbs')}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {v1.bulletQuality.quantificationRate}%
                </div>
                <div className="text-xs text-muted-foreground">{t('quantification')}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {v1.bulletQuality.averageLength}
                </div>
                <div className="text-xs text-muted-foreground">{t('avgLength')}</div>
              </div>
            </div>
          </div>

          {/* Content Gaps (v1 - string array) */}
          {v1.contentGaps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('contentGaps')}</h4>
              <ul className="space-y-1 rounded-lg border p-3">
                {v1.contentGaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
