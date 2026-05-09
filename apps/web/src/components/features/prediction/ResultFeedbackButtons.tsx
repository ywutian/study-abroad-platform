'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Loader2, Check, CircleSlash } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useReportResult, type AdmissionResultReport } from '@/hooks/use-prediction';

interface ResultFeedbackButtonsProps {
  schoolId: string;
  actualResult?: string;
  onResultReported?: (schoolId: string, result: string) => void;
}

const RESULT_OPTIONS = [
  {
    value: 'ADMITTED' as const,
    icon: CheckCircle2,
    className: 'text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/30',
    activeClassName: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600',
  },
  {
    value: 'WAITLISTED' as const,
    icon: Clock,
    className: 'text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/30',
    activeClassName: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
  },
  {
    value: 'DEFERRED' as const,
    icon: Clock,
    className: 'text-sky-600 hover:bg-sky-500/10 hover:border-sky-500/30',
    activeClassName: 'bg-sky-500/10 border-sky-500/30 text-sky-600',
  },
  {
    value: 'REJECTED' as const,
    icon: XCircle,
    className: 'text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/30',
    activeClassName: 'bg-rose-500/10 border-rose-500/30 text-rose-600',
  },
  {
    value: 'WITHDRAWN' as const,
    icon: CircleSlash,
    className: 'text-slate-600 hover:bg-slate-500/10 hover:border-slate-500/30',
    activeClassName: 'bg-slate-500/10 border-slate-500/30 text-slate-600',
  },
];

export function ResultFeedbackButtons({
  schoolId,
  actualResult,
  onResultReported,
}: ResultFeedbackButtonsProps) {
  const t = useTranslations('prediction');
  const reportMutation = useReportResult();
  const [justReported, setJustReported] = useState(false);

  const handleReport = (result: AdmissionResultReport) => {
    reportMutation.mutate(
      { schoolId, result },
      {
        onSuccess: () => {
          setJustReported(true);
          onResultReported?.(schoolId, result);
          toast.success(t('outcomeLabelSaved'));
        },
      }
    );
  };

  const activeResult =
    actualResult ?? (justReported ? reportMutation.variables?.result : undefined);

  // Show inline confirmation after labeling
  if (justReported || actualResult) {
    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-overline text-muted-foreground">{t('outcomeLabelSection')}</p>
          <p className="text-xs text-muted-foreground">{t('outcomeLabelSavedHint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {RESULT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = activeResult === option.value;
              return (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-1.5 text-xs',
                    isActive ? option.activeClassName : 'opacity-40'
                  )}
                  disabled
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`result.${option.value.toLowerCase()}`)}
                </Button>
              );
            })}
          </div>
          {justReported && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
              <Check className="h-3.5 w-3.5" />
              {t('outcomeLabelSavedToast')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-overline text-muted-foreground">{t('outcomeLabelSection')}</p>
        <p className="text-xs text-muted-foreground">{t('outcomeLabelHint')}</p>
      </div>
      <div className="flex gap-2">
        {RESULT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              className={cn('gap-1.5 text-xs', option.className)}
              disabled={reportMutation.isPending}
              onClick={() => handleReport(option.value)}
            >
              {reportMutation.isPending && reportMutation.variables?.result === option.value ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {t(`result.${option.value.toLowerCase()}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
