'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Loader2, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageContent } from '@/components/features/agent-chat/message-content';
import { usePredictionLlmStream } from '@/hooks/use-prediction-llm-stream';
import type { PredictionResult } from './types';

interface PredictionExplanationStreamProps {
  result: PredictionResult;
}

export function PredictionExplanationStream({ result }: PredictionExplanationStreamProps) {
  const t = useTranslations('prediction.llmExplanation');
  const { content, isStreaming, error, cached, start, cancel } = usePredictionLlmStream();

  const run = useCallback(
    (refresh = false) => {
      if (!result.id) return;
      void start(`/predictions/${result.id}/explanation/stream`, { refresh });
    },
    [result.id, start]
  );

  if (!result.id) return null;

  return (
    <div className="rounded-[var(--theme-radius-button)] border border-primary/15 bg-primary/5 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            {t('title')}
            {cached && (
              <Badge variant="secondary" className="text-xs">
                {t('cached')}
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isStreaming ? (
            <Button variant="outline" size="sm" onClick={cancel} className="gap-2">
              <Square className="h-3.5 w-3.5" />
              {t('stop')}
            </Button>
          ) : content ? (
            <Button variant="outline" size="sm" onClick={() => run(true)} className="gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('regenerate')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => run(false)} className="gap-2">
              <FileText className="h-3.5 w-3.5" />
              {t('generate')}
            </Button>
          )}
        </div>
      </div>

      {(content || isStreaming || error) && (
        <div className="mt-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-card-bg)] p-3 text-sm">
          {content ? (
            <MessageContent content={content} isStreaming={isStreaming} />
          ) : isStreaming ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('streaming')}
            </p>
          ) : null}
          {error && <p className="text-sm text-destructive">{t('error')}</p>}
        </div>
      )}
    </div>
  );
}
