'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ResumeReviewResult } from '@study-abroad/shared';

interface OverviewTabProps {
  result: ResumeReviewResult;
}

export function OverviewTab({ result }: OverviewTabProps) {
  const t = useTranslations('resume.aiReview');
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  const toggleDim = (name: string) => {
    setExpandedDim((prev) => (prev === name ? null : name));
  };

  return (
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
              strokeDasharray={`${(result.overallScore / 100) * 220} 220`}
              strokeLinecap="round"
              className={
                result.overallScore >= 70
                  ? 'text-green-500'
                  : result.overallScore >= 40
                    ? 'text-yellow-500'
                    : 'text-red-500'
              }
              stroke="currentColor"
            />
          </svg>
          <span className="absolute text-xl font-bold">{result.overallScore}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </div>
      </div>

      {/* Dimensions with expandable criteria */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{t('dimensions')}</h4>
        {result.dimensions.map((dim) => (
          <div key={dim.name} className="rounded-lg border p-3">
            <button
              type="button"
              className="mb-2 flex w-full items-center justify-between"
              onClick={() => toggleDim(dim.name)}
            >
              <div className="flex items-center gap-2">
                {dim.status === 'green' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : dim.status === 'yellow' ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">{t(`dim.${dim.name}`)}</span>
                {dim.criteria?.length > 0 &&
                  (expandedDim === dim.name ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  ))}
              </div>
              <span className="text-sm font-semibold">{dim.score}</span>
            </button>
            <Progress value={dim.score} className="mb-2 h-1.5" />
            <p className="text-xs text-muted-foreground">{dim.feedback}</p>

            {/* Expandable criteria detail */}
            {expandedDim === dim.name && dim.criteria?.length > 0 && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {dim.criteria.map((c) => (
                  <div key={c.key} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="text-2xs font-medium">{t(`criteriaKeys.${c.key}`)}</span>
                        <span className="text-2xs text-muted-foreground">
                          {c.score}/{c.maxScore}
                        </span>
                      </div>
                      <Progress value={c.score * 10} className="h-1" />
                      {c.detail && (
                        <p className="mt-0.5 text-2xs text-muted-foreground">{c.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Top improvements */}
            {dim.improvements?.length > 0 && (
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
              {result.bulletQuality.actionVerbUsage}%
            </div>
            <div className="text-xs text-muted-foreground">{t('actionVerbs')}</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              {result.bulletQuality.quantificationRate}%
            </div>
            <div className="text-xs text-muted-foreground">{t('quantification')}</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              {result.bulletQuality.averageLength}
            </div>
            <div className="text-xs text-muted-foreground">{t('avgLength')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
