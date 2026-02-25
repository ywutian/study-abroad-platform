'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import type { ContentGap } from '@study-abroad/shared';

interface GapsTabProps {
  contentGaps: ContentGap[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function GapsTab({ contentGaps }: GapsTabProps) {
  const t = useTranslations('resume.aiReview');

  if (contentGaps.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        {t('noGaps')}
      </div>
    );
  }

  // Sort by priority: high → medium → low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...contentGaps].sort(
    (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
  );

  return (
    <div className="space-y-3">
      {sorted.map((gap, idx) => (
        <div key={idx} className="rounded-lg border p-3">
          <div className="mb-2 flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                {gap.sectionType && (
                  <Badge variant="outline" className="text-[10px]">
                    {gap.sectionType}
                  </Badge>
                )}
                <span
                  className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[gap.priority] ?? PRIORITY_COLORS.medium}`}
                >
                  {t(`severity.${gap.priority}`)}
                </span>
              </div>
              <p className="text-sm">{gap.description}</p>
            </div>
          </div>
          {gap.example && (
            <div className="mt-2 flex items-start gap-2 rounded bg-muted/50 p-2">
              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {t('example')}: {gap.example}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
