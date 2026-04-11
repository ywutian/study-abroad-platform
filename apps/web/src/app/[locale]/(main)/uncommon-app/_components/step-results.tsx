'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProfileAIAnalysis } from '@/components/features';
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
    <div className="space-y-4">
      <ProfileAIAnalysis
        analysis={analysis}
        isLoading={isAnalyzing && !analysis}
        isFetching={isAnalyzing}
        onRefresh={onReAnalyze}
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportReport}
          disabled={isExporting || !analysis}
        >
          {isExporting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1 h-4 w-4" />
          )}
          {t('exportReport')}
        </Button>
        <Button variant="outline" size="sm" onClick={onDone}>
          {t('done')}
        </Button>
        <Button size="sm" onClick={onReAnalyze} disabled={isAnalyzing}>
          <RotateCcw className="mr-1 h-4 w-4" />
          {isAnalyzing ? t('reAnalyzing') : t('reAnalyze')}
        </Button>
      </div>
    </div>
  );
}
