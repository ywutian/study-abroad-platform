'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { outcomeRoutes } from '@study-abroad/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

type OutcomeResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

interface ReportOutcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictionResultId: string;
  schoolName: string;
  probability?: number;
  round?: string | null;
}

/**
 * M6.3: One-tap outcome reporting modal.
 *
 * Triggered from Dashboard banner or My Outcomes page. Lets user pick a result
 * (Admitted/Rejected/Waitlisted/Deferred) + optional note + opt-in to share
 * with future applicants.
 */
export function ReportOutcomeModal({
  open,
  onOpenChange,
  predictionResultId,
  schoolName,
  probability,
  round,
}: ReportOutcomeModalProps) {
  const t = useTranslations('Outcome');
  const queryClient = useQueryClient();
  const [result, setResult] = useState<OutcomeResult>('ADMITTED');
  const [notes, setNotes] = useState('');
  const [shareWithFutureApplicants, setShareWithFutureApplicants] = useState(true);

  const submit = useMutation({
    mutationFn: async () => {
      return apiClient.post(outcomeRoutes.submit(), {
        predictionResultId,
        result,
        notes: notes || undefined,
        shareWithFutureApplicants,
      });
    },
    onSuccess: () => {
      toast.success(t('reportSuccess'));
      queryClient.invalidateQueries({ queryKey: ['outcomes'] });
      queryClient.invalidateQueries({ queryKey: ['pending-decisions'] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('reportError'));
    },
  });

  const resultOptions: Array<{ value: OutcomeResult; labelKey: string; bgColor: string }> = [
    {
      value: 'ADMITTED',
      labelKey: 'admitted',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    },
    {
      value: 'WAITLISTED',
      labelKey: 'waitlisted',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    },
    {
      value: 'DEFERRED',
      labelKey: 'deferred',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    },
    {
      value: 'REJECTED',
      labelKey: 'rejected',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reportTitle', { school: schoolName })}</DialogTitle>
          <DialogDescription>
            {round ? t('reportDescriptionWithRound', { round }) : t('reportDescription')}
            {probability !== undefined && (
              <span className="block mt-1 text-sm text-muted-foreground">
                {t('predictedProbability', { p: `${(probability * 100).toFixed(0)}%` })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">{t('resultLabel')}</Label>
            <RadioGroup
              value={result}
              onValueChange={(v) => setResult(v as OutcomeResult)}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {resultOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    result === opt.value ? opt.bgColor + ' ring-2 ring-primary' : 'hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value={opt.value} />
                  <span className="text-sm font-medium">{t(opt.labelKey)}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-medium">
              {t('notesLabel')}
              <span className="ml-1 text-xs text-muted-foreground">{t('optional')}</span>
            </Label>
            <Textarea
              id="notes"
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="mt-2"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Checkbox
              id="share-opt-in"
              checked={shareWithFutureApplicants}
              onCheckedChange={(checked) => setShareWithFutureApplicants(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="share-opt-in" className="text-sm font-medium cursor-pointer">
                {t('shareOptInTitle')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('shareOptInDescription')}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? t('submitting') : t('submitReport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
