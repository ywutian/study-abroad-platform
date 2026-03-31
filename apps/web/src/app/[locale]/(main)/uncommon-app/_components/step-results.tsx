'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Brain,
  TrendingUp,
  Download,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
// pdf + AnalysisReportPDF lazy-loaded in handleExportReport
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MarkdownContent } from './progress-stepper';
import type { AIAnalysis } from './types';

interface StepResultsProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  analysis: AIAnalysis | null;
  isAnalyzing: boolean;
  onReAnalyze: () => void;
  onDone: () => void;
}

export function StepResults({ t, analysis, isAnalyzing, onReAnalyze, onDone }: StepResultsProps) {
  const locale = useLocale();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportReport = async () => {
    if (!analysis) {
      toast.error(t('analysis.noData'));
      return;
    }

    setIsExporting(true);

    try {
      // Lazy-load PDF renderer + report component (saves ~500KB from main bundle)
      const [{ pdf }, { AnalysisReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/features/report/analysis-report-pdf'),
      ]);

      const blob = await pdf(
        <AnalysisReportPDF
          data={{
            overallScore: analysis.overallScore,
            projectedImprovement: analysis.projectedImprovement,
            admissionPrediction: analysis.admissionPrediction,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            improvements: analysis.improvements,
            recommendedActivities: analysis.recommendedActivities,
            timeline: analysis.timeline,
          }}
          locale={locale === 'zh' ? 'zh' : 'en'}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analysis-report-${new Date().toISOString().split('T')[0]}.pdf`;
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
    <Card
      className="absolute inset-0 w-full backface-hidden overflow-hidden"
      style={{
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {t('aiAnalysis')}
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
              {t('profileAgent')}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onDone} aria-label={t('done')}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {analysis ? (
          <FullAnalysis t={t} analysis={analysis} />
        ) : (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-center text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>{t('analysis.noData')}</p>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            disabled={isExporting || !analysis}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            {t('exportReport')}
          </Button>
          <Button size="sm" onClick={onReAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <Brain className="h-4 w-4 mr-1 animate-pulse" />
                {t('reAnalyzing')}
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-1" />
                {t('reAnalyze')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FullAnalysis({
  t,
  analysis,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  analysis: AIAnalysis;
}) {
  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 via-violet-500/10 to-primary/10 border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('analysis.prediction.subtitle')}</p>
            <p className="text-3xl font-bold text-primary">
              {analysis.overallScore}
              <span className="text-lg text-muted-foreground">/100</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            {t('potential', { score: analysis.projectedImprovement })}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="overview" className="text-xs">
            {t('tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="strengths" className="text-xs">
            {t('tabs.strengths')}
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="text-xs">
            {t('tabs.suggestions')}
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs">
            {t('tabs.activities')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <ScrollArea className="h-[280px] pr-4">
            <MarkdownContent content={analysis.admissionPrediction} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="strengths" className="mt-3">
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <h4 className="font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('analysis.strengths.label')}
                </h4>
                <ul className="space-y-2">
                  {analysis.strengths.length > 0 ? (
                    analysis.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-2"
                      >
                        <span className="text-emerald-500">&#8226;</span>
                        {s}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">{t('analysis.noData')}</li>
                  )}
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {t('analysis.weaknesses.label')}
                </h4>
                <ul className="space-y-2">
                  {analysis.weaknesses.length > 0 ? (
                    analysis.weaknesses.map((w, i) => (
                      <li
                        key={i}
                        className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2"
                      >
                        <span className="text-amber-500">&#8226;</span>
                        {w}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">{t('analysis.noData')}</li>
                  )}
                </ul>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-3">
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {analysis.improvements.length > 0 ? (
                analysis.improvements.map((item, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm flex-1">{item}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('analysis.noData')}
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="activities" className="mt-3">
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {analysis.recommendedActivities.length > 0 ? (
                analysis.recommendedActivities.map((activity, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-violet-500/5 border flex items-start gap-3"
                  >
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm flex-1">{activity}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('analysis.noData')}
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
