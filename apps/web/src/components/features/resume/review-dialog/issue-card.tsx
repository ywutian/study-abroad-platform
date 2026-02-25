'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';
import type { SectionIssue } from '@study-abroad/shared';

interface IssueCardProps {
  issue: SectionIssue;
  applied?: boolean;
  onApply?: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function IssueCard({ issue, applied, onApply }: IssueCardProps) {
  const t = useTranslations('resume.aiReview');

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {/* Header badges */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {t(`issueTypes.${issue.type}`)}
        </Badge>
        <span
          className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.medium}`}
        >
          {t(`severity.${issue.severity}`)}
        </span>
        {issue.bulletIndex !== undefined && (
          <span className="text-[10px] text-muted-foreground">Bullet #{issue.bulletIndex}</span>
        )}
      </div>

      {/* Original → Suggestion diff */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="rounded bg-red-50 p-2 dark:bg-red-950/20">
            <p className="text-xs leading-relaxed text-red-700 line-through dark:text-red-400">
              {issue.original}
            </p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="rounded bg-green-50 p-2 dark:bg-green-950/20">
            <p className="text-xs leading-relaxed text-green-700 dark:text-green-400">
              {issue.suggestion}
            </p>
          </div>
        </div>
      </div>

      {/* Reason + Apply */}
      <div className="flex items-end justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{issue.reason}</p>
        {onApply && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 shrink-0 gap-1 px-2 text-[10px]"
            onClick={onApply}
            disabled={applied}
          >
            {applied ? (
              <>
                <Check className="h-3 w-3" />
                {t('applied')}
              </>
            ) : (
              t('apply')
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
