'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { ClipboardCheck, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileAIAnalysis } from '@/components/features/profile/ProfileAIAnalysis';
import type { AIAnalysis, TFunction } from './types';
import type { ApplicationWorkspaceModel, WorkspaceAction } from './application-workspace-model';
import { WorkspaceActionButton } from './workspace-shared';

interface AdvisorAnalysisSectionProps {
  t: TFunction;
  analysis: AIAnalysis | null;
  workspace: ApplicationWorkspaceModel;
  isAnalyzing: boolean;
  isGeneratingRecommendations: boolean;
  onAction: (action: WorkspaceAction) => void;
  onRefresh: () => void;
}

/**
 * The single advisor/analysis surface for the workspace.
 *
 * Before advice exists → a thin control card (generate CTA + add-candidates).
 * After advice exists → the full ProfileAIAnalysis (verdict + per-school detail
 * + action plan), with add-candidates and PDF export injected into its header.
 *
 * The two are MUTUALLY EXCLUSIVE so the portfolio verdict/reasons/risks render
 * exactly once — never the old "summary card stacked above a full report that
 * repeats the same verdict" duplication.
 */
export function AdvisorAnalysisSection({
  t,
  analysis,
  workspace,
  isAnalyzing,
  isGeneratingRecommendations,
  onAction,
  onRefresh,
}: AdvisorAnalysisSectionProps) {
  if (!analysis) {
    return (
      <AdvisorControlCard
        t={t}
        workspace={workspace}
        isAnalyzing={isAnalyzing}
        isGeneratingRecommendations={isGeneratingRecommendations}
        onAction={onAction}
      />
    );
  }

  return (
    <ProfileAIAnalysis
      analysis={analysis}
      autoFetch={false}
      isFetching={isAnalyzing}
      onRefresh={onRefresh}
      headerActions={
        <>
          <WorkspaceActionButton
            t={t}
            action={{ id: 'add-schools', intent: 'recommendations' }}
            onAction={onAction}
            isBusy={isGeneratingRecommendations}
            size="sm"
            variant="outline"
            labelKey="workspace.actions.add-candidates"
          />
          <AnalysisReportExportButton t={t} analysis={analysis} />
        </>
      }
    />
  );
}

function AdvisorControlCard({
  t,
  workspace,
  isAnalyzing,
  isGeneratingRecommendations,
  onAction,
}: {
  t: TFunction;
  workspace: ApplicationWorkspaceModel;
  isAnalyzing: boolean;
  isGeneratingRecommendations: boolean;
  onAction: (action: WorkspaceAction) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {t('workspace.advisor.title')}
            </CardTitle>
            <CardDescription className="mt-1">{t('workspace.advisor.description')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <WorkspaceActionButton
              t={t}
              action={{ id: 'add-schools', intent: 'recommendations' }}
              onAction={onAction}
              isBusy={isGeneratingRecommendations}
              size="sm"
              variant="outline"
              labelKey="workspace.actions.add-candidates"
            />
            <WorkspaceActionButton
              t={t}
              action={{ id: 'generate-advice', intent: 'analysis' }}
              onAction={onAction}
              isBusy={isAnalyzing}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isAnalyzing ? (
          <div
            className="flex items-center gap-3 rounded-[var(--theme-radius-card)] border bg-muted/20 p-4"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('workspace.advisor.preparing')}</p>
          </div>
        ) : (
          <div className="rounded-[var(--theme-radius-card)] border border-dashed p-5">
            <p className="text-sm font-semibold">{t('workspace.advisor.emptyTitle')}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('workspace.advisor.emptyDescription')}
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => onAction({ id: 'generate-advice', intent: 'analysis' })}
              disabled={isAnalyzing}
            >
              <ClipboardCheck className="h-4 w-4" />
              {t('workspace.actions.generate-advice')}
            </Button>
            {workspace.recommendationsCount > 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {t('workspace.advisor.candidateCount', { count: workspace.recommendationsCount })}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Lazy-loads @react-pdf/renderer + the report template on click (heavy deps). */
function AnalysisReportExportButton({ t, analysis }: { t: TFunction; analysis: AIAnalysis }) {
  const locale = useLocale();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const [{ pdf }, { AnalysisReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/features/report/analysis-report-pdf'),
      ]);

      const blob = await pdf(
        <AnalysisReportPDF data={analysis} locale={locale === 'zh' ? 'zh' : 'en'} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `application-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);

      toast.success(t('reportExported'));
    } catch {
      toast.error(t('analysisError'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExportReport} disabled={isExporting}>
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {t('exportReport')}
    </Button>
  );
}
