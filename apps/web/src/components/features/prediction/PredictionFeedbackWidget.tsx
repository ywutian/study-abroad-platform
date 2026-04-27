'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, CircleHelp, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  type PredictionFeedbackCategory,
  type PredictionFeedbackSentiment,
  useSubmitPredictionFeedback,
} from '@/hooks/use-prediction-feedback';

interface PredictionFeedbackWidgetProps {
  predictionResultId?: string;
}

const SENTIMENT_OPTIONS: Array<{
  value: PredictionFeedbackSentiment;
  icon: typeof ThumbsUp;
  className: string;
  activeClassName: string;
}> = [
  {
    value: 'POSITIVE',
    icon: ThumbsUp,
    className: 'text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/30',
    activeClassName: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600',
  },
  {
    value: 'UNSURE',
    icon: CircleHelp,
    className: 'text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/30',
    activeClassName: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
  },
  {
    value: 'NEGATIVE',
    icon: ThumbsDown,
    className: 'text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/30',
    activeClassName: 'bg-rose-500/10 border-rose-500/30 text-rose-600',
  },
];

const CATEGORY_OPTIONS: PredictionFeedbackCategory[] = [
  'TOO_HIGH',
  'TOO_LOW',
  'FACTORS_WRONG',
  'NEVER_MOVES',
  'OTHER',
];

export function PredictionFeedbackWidget({ predictionResultId }: PredictionFeedbackWidgetProps) {
  const t = useTranslations('prediction.predictionFeedback');
  const submit = useSubmitPredictionFeedback();
  const [sentiment, setSentiment] = useState<PredictionFeedbackSentiment | null>(null);
  const [category, setCategory] = useState<PredictionFeedbackCategory | undefined>();
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const categoryRequired = sentiment === 'UNSURE' || sentiment === 'NEGATIVE';
  const canSubmit = useMemo(() => {
    if (!predictionResultId || !sentiment) return false;
    if (categoryRequired && !category) return false;
    return notes.length <= 500;
  }, [category, categoryRequired, notes.length, predictionResultId, sentiment]);

  if (!predictionResultId) return null;

  const handleSubmit = () => {
    if (!canSubmit || !sentiment) return;
    submit.mutate(
      {
        predictionResultId,
        sentiment,
        category,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          toast.success(t('savedToast'));
        },
      }
    );
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>{t('saved')}</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-1 py-0 text-emerald-700 dark:text-emerald-300"
            onClick={() => setSubmitted(false)}
          >
            {t('edit')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-full bg-primary/10 p-2">
          <CircleHelp className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t('title')}</p>
          <p className="text-xs text-muted-foreground">{t('hint')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SENTIMENT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = sentiment === option.value;
          return (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              className={cn('gap-1.5 text-xs', active ? option.activeClassName : option.className)}
              onClick={() => {
                setSentiment(option.value);
                if (option.value === 'POSITIVE') setCategory(undefined);
              }}
              disabled={submit.isPending}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`sentiment.${option.value}`)}
            </Button>
          );
        })}
      </div>

      {categoryRequired && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('categoryLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const active = category === option;
              return (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn('text-xs', active && 'border-primary bg-primary/10 text-primary')}
                  onClick={() => setCategory(option)}
                  disabled={submit.isPending}
                >
                  {t(`category.${option}`)}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {sentiment && (
        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 500))}
            placeholder={t('notesPlaceholder')}
            className="min-h-20 text-sm"
            disabled={submit.isPending}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {t('charCount', { count: notes.length })}
            </span>
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submit.isPending}>
              {submit.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              {t('submit')}
            </Button>
          </div>
          {submit.error && (
            <p className="text-xs text-destructive">
              {submit.error instanceof Error ? submit.error.message : t('error')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
