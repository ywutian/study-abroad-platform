'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardCheck, Loader2, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageContent } from '@/components/features/agent-chat/message-content';
import { usePredictionLlmStream } from '@/hooks/use-prediction-llm-stream';
import type { PredictionResult } from './types';

interface PredictionPortfolioSummaryStreamProps {
  results: PredictionResult[];
  autoStart?: boolean;
}

export function PredictionPortfolioSummaryStream({
  results,
  autoStart = true,
}: PredictionPortfolioSummaryStreamProps) {
  const t = useTranslations('prediction.portfolioAi');
  const { content, isStreaming, error, start, cancel } = usePredictionLlmStream();
  const startedKeyRef = useRef<string | null>(null);
  const predictionResultIds = useMemo(
    () => results.map((result) => result.id).filter(Boolean) as string[],
    [results]
  );
  const autoKey = useMemo(() => predictionResultIds.join('|'), [predictionResultIds]);

  useEffect(() => {
    if (!autoStart || !autoKey || startedKeyRef.current === autoKey) return;
    startedKeyRef.current = autoKey;
    void start('/predictions/portfolio-summary/stream', { predictionResultIds });
  }, [autoKey, autoStart, predictionResultIds, start]);

  if (!results.length || !predictionResultIds.length) return null;

  return (
    <section className="rounded-[var(--theme-radius-card)] border border-primary/15 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            {t('title')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {isStreaming ? (
          <Button variant="outline" size="sm" onClick={cancel} className="gap-2">
            <Square className="h-3.5 w-3.5" />
            {t('stop')}
          </Button>
        ) : (
          <Button
            variant={content ? 'outline' : 'default'}
            size="sm"
            onClick={() =>
              start('/predictions/portfolio-summary/stream', {
                predictionResultIds,
                refresh: Boolean(content),
              })
            }
            className="gap-2"
          >
            {content ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <ClipboardCheck className="h-3.5 w-3.5" />
            )}
            {content ? t('refresh') : t('generate')}
          </Button>
        )}
      </div>

      <div className="mt-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-card-bg)] p-3 text-sm">
        {content ? (
          <MessageContent content={content} isStreaming={isStreaming} />
        ) : isStreaming ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('streaming')}
          </p>
        ) : error ? (
          <p className="text-destructive">{t('error')}</p>
        ) : (
          <p className="text-muted-foreground">{t('idle')}</p>
        )}
      </div>
    </section>
  );
}
