'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Star, ThumbsUp, ThumbsDown, Lightbulb, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EssayReviewPanelProps {
  essayId: string;
  className?: string;
}

interface ReviewScores {
  clarity: number;
  uniqueness: number;
  storytelling: number;
  fit: number;
  language: number;
}

interface ReviewResult {
  id: string;
  overallScore: number;
  scores: ReviewScores;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  verdict: string;
  tokenUsed: number;
}

const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreBg = (score: number) => {
  if (score >= 8) return 'bg-green-500';
  if (score >= 6) return 'bg-yellow-500';
  return 'bg-red-500';
};

export const EssayReviewPanel: React.FC<EssayReviewPanelProps> = ({ essayId, className }) => {
  const t = useTranslations('essayAi');
  const [schoolName, setSchoolName] = useState('');
  const [major, setMajor] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(null);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ReviewResult>('/essay-ai/review', {
        essayId,
        schoolName: schoolName || undefined,
        major: major || undefined,
      });
      return response;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t('review.success'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('review.failed'));
    },
  });

  if (result) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              {t('review.result')}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setResult(null)}>
              {t('review.newReview')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <span className={cn('text-3xl font-bold', getScoreColor(result.overallScore))}>
                  {result.overallScore.toFixed(1)}
                </span>
              </div>
              <Star className="absolute -top-1 -right-1 h-6 w-6 text-yellow-500 fill-yellow-500" />
            </div>
          </div>

          {/* Dimension Scores */}
          <div className="space-y-3">
            {Object.entries(result.scores).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{t(`scores.${key}`)}</span>
                  <span className={cn('font-medium', getScoreColor(value))}>{value}/10</span>
                </div>
                <Progress value={value * 10} className={cn('h-2', getScoreBg(value))} />
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm leading-relaxed">{result.verdict}</p>
          </div>

          {/* Strengths */}
          {result.strengths.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <ThumbsUp className="h-4 w-4" />
                {t('review.strengths')}
              </div>
              <ul className="space-y-1">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {result.weaknesses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                <ThumbsDown className="h-4 w-4" />
                {t('review.weaknesses')}
              </div>
              <ul className="space-y-1">
                {result.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Lightbulb className="h-4 w-4" />
                {t('review.suggestions')}
              </div>
              <ul className="space-y-1">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 h-5 w-5 p-0 justify-center">
                      {i + 1}
                    </Badge>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-right">
            {t('tokenUsed', { tokens: result.tokenUsed })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 text-yellow-500" />
          {t('review.title')}
        </CardTitle>
        <CardDescription>{t('review.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="schoolName">{t('review.schoolName')}</Label>
            <Input
              id="schoolName"
              placeholder={t('review.schoolNamePlaceholder')}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="major">{t('review.major')}</Label>
            <Input
              id="major"
              placeholder={t('review.majorPlaceholder')}
              value={major}
              onChange={(e) => setMajor(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('review.cost', { points: 30 })}</span>
        </div>

        <Button
          onClick={() => reviewMutation.mutate()}
          disabled={reviewMutation.isPending}
          className="w-full"
        >
          {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Star className="mr-2 h-4 w-4" />
          {t('review.start')}
        </Button>
      </CardContent>
    </Card>
  );
};
