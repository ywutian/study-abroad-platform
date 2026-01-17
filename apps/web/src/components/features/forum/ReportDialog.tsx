'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { REPORT_REASONS, type ReportReason } from '@/types/forum';
import { getLocalizedName } from '@/lib/i18n/locale-utils';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'POST' | 'COMMENT' | 'USER' | 'MESSAGE';
  targetId: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [detail, setDetail] = useState('');
  const t = useTranslations('forum');
  const locale = useLocale();

  const reportMutation = useMutation({
    mutationFn: async () => {
      let endpoint = '';
      if (targetType === 'POST') {
        endpoint = `/forum/posts/${targetId}/report`;
      } else if (targetType === 'COMMENT') {
        endpoint = `/forum/comments/${targetId}/report`;
      } else {
        endpoint = '/chat/report';
      }

      return apiClient.post(endpoint, {
        reason,
        detail: detail || undefined,
        ...(targetType === 'USER' || targetType === 'MESSAGE' ? { targetType, targetId } : {}),
      });
    },
    onSuccess: () => {
      toast.success(t('reportSubmitted'));
      onOpenChange(false);
      setReason('');
      setDetail('');
    },
    onError: () => {
      toast.error(t('reportFailed'));
    },
  });

  const handleSubmit = () => {
    if (reason) {
      reportMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('reportTitle')}
          </DialogTitle>
          <DialogDescription>{t('reportDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
            {REPORT_REASONS.map((item) => (
              <div
                key={item.value}
                className={cn(
                  'flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer',
                  reason === item.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => setReason(item.value)}
              >
                <RadioGroupItem value={item.value} id={item.value} className="mt-1" />
                <Label htmlFor={item.value} className="flex-1 cursor-pointer">
                  <div className="font-medium">
                    {getLocalizedName(item.labelZh, item.label, locale)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getLocalizedName(item.descriptionZh, item.description, locale)}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="detail">{t('reportDetailLabel')}</Label>
            <Textarea
              id="detail"
              placeholder={t('reportDetailPlaceholder')}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{detail.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason || reportMutation.isPending}
          >
            {reportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('submitReport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
