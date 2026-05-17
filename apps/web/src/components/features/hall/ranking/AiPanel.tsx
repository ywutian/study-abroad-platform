'use client';

/**
 * AiPanel — per-school AI ranking analysis: a request button that expands into
 * a strengths/improvements breakdown once the analysis resolves.
 */

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import type { AiAnalysisResult } from '@/types/hall';

interface AiPanelProps {
  analysis?: AiAnalysisResult;
  loading: boolean;
  onRequest: () => void;
}

export function AiPanel({ analysis, loading, onRequest }: AiPanelProps) {
  const t = useTranslations();

  if (!analysis) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full gap-2 text-primary"
        onClick={onRequest}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Lightbulb className="h-3.5 w-3.5" />
        )}
        {t('hall.ranking.getAiAnalysis')}
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <ClipboardCheck className="h-4 w-4" />
        {t('hall.ranking.aiAnalysis')}
      </div>
      <p className="text-sm">{analysis.analysis}</p>
      {analysis.strengths.length > 0 && (
        <div className="space-y-1">
          {analysis.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
      {analysis.improvements.length > 0 && (
        <div className="space-y-1">
          {analysis.improvements.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
