'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquareWarning, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  type PredictionFeedbackCategory,
  type PredictionFeedbackSentiment,
  useAdminPredictionFeedback,
} from '@/hooks/use-prediction-feedback';
import { cn } from '@/lib/utils';

const SENTIMENT_FILTERS: Array<PredictionFeedbackSentiment | 'ALL'> = [
  'ALL',
  'POSITIVE',
  'UNSURE',
  'NEGATIVE',
];

const CATEGORY_FILTERS: Array<PredictionFeedbackCategory | 'ALL'> = [
  'ALL',
  'TOO_HIGH',
  'TOO_LOW',
  'FACTORS_WRONG',
  'NEVER_MOVES',
  'OTHER',
];

function isValidSentiment(value: unknown): value is PredictionFeedbackSentiment {
  return value === 'POSITIVE' || value === 'UNSURE' || value === 'NEGATIVE';
}

function isValidCategory(value: unknown): value is PredictionFeedbackCategory {
  return (
    value === 'TOO_HIGH' ||
    value === 'TOO_LOW' ||
    value === 'FACTORS_WRONG' ||
    value === 'NEVER_MOVES' ||
    value === 'OTHER'
  );
}

export default function AdminPredictionFeedbackPage() {
  const t = useTranslations('admin.predictionFeedback');
  const [sentiment, setSentiment] = useState<PredictionFeedbackSentiment | 'ALL'>('ALL');
  const [category, setCategory] = useState<PredictionFeedbackCategory | 'ALL'>('ALL');
  const [engineSnapshot, setEngineSnapshot] = useState('counselor');
  const [schoolId, setSchoolId] = useState('');
  const [daysAgo, setDaysAgo] = useState(30);

  const filters = useMemo(
    () => ({
      sentiment,
      category,
      engineSnapshot,
      schoolId,
      daysAgo,
      take: 20,
    }),
    [category, daysAgo, engineSnapshot, schoolId, sentiment]
  );
  const feedback = useAdminPredictionFeedback(filters);
  const feedbackItems = Array.isArray(feedback.data?.items) ? feedback.data.items : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={MessageSquareWarning}
        color="amber"
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('sentiment')}</p>
            <div className="flex flex-wrap gap-2">
              {SENTIMENT_FILTERS.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  size="sm"
                  className={cn(
                    sentiment === option && 'border-primary bg-primary/10 text-primary'
                  )}
                  onClick={() => setSentiment(option)}
                >
                  {t(`sentiments.${option}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('category')}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  size="sm"
                  className={cn(category === option && 'border-primary bg-primary/10 text-primary')}
                  onClick={() => setCategory(option)}
                >
                  {t(`categories.${option}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={engineSnapshot}
              onChange={(event) => setEngineSnapshot(event.target.value)}
              placeholder={t('enginePlaceholder')}
            />
            <Input
              value={schoolId}
              onChange={(event) => setSchoolId(event.target.value)}
              placeholder={t('schoolPlaceholder')}
            />
            <Input
              type="number"
              min={1}
              max={365}
              value={daysAgo}
              onChange={(event) => setDaysAgo(Number(event.target.value) || 30)}
              placeholder={t('daysPlaceholder')}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {feedback.data ? t('total', { count: feedback.data.total }) : t('loading')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => feedback.refetch()}
              disabled={feedback.isFetching}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', feedback.isFetching && 'animate-spin')} />
              {t('refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {feedback.error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{t('loadFailed')}</CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {feedback.isLoading ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">{t('loading')}</CardContent>
          </Card>
        ) : null}
        {feedbackItems.map((item) => {
          const sentimentLabel = isValidSentiment(item.sentiment)
            ? t(`sentiments.${item.sentiment}`)
            : t('unknown');
          const categoryLabel = isValidCategory(item.category)
            ? t(`categories.${item.category}`)
            : null;
          const createdAt = item.createdAt ? new Date(item.createdAt) : null;

          return (
            <Card key={item.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{sentimentLabel}</Badge>
                    {categoryLabel ? <Badge variant="secondary">{categoryLabel}</Badge> : null}
                    <Badge variant="secondary">{item.engineSnapshot ?? t('unknownEngine')}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {createdAt && Number.isFinite(createdAt.getTime())
                      ? createdAt.toLocaleString()
                      : t('unknown')}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('school')}</p>
                    <p className="text-sm font-medium">
                      {item.school?.name ?? item.predictionResultId ?? t('unknown')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('probability')}</p>
                    <p className="text-sm font-medium">
                      {item.probabilitySnapshot != null
                        ? `${(item.probabilitySnapshot * 100).toFixed(1)}%`
                        : t('unknown')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('user')}</p>
                    <p className="text-sm font-medium">
                      {item.userEmail ?? item.userId ?? t('unknown')}
                    </p>
                  </div>
                </div>

                {item.notes ? (
                  <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    {item.notes}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!feedback.isLoading && feedbackItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">{t('empty')}</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
