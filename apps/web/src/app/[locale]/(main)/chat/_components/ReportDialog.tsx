'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { ReportTarget } from './types';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportTarget | null;
  isPending: boolean;
  onSubmit: (data: {
    targetType: string;
    targetId: string;
    reason: string;
    detail?: string;
  }) => void;
}

export function ReportDialog({
  open,
  onOpenChange,
  target,
  isPending,
  onSubmit,
}: ReportDialogProps) {
  const t = useTranslations();
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');

  const isMessageReport = target?.targetType === 'MESSAGE';

  const handleSubmit = () => {
    if (!target || !reason) return;
    onSubmit({
      targetType: target.targetType,
      targetId: target.targetId,
      reason,
      detail: detail || undefined,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason('');
      setDetail('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isMessageReport ? t('chat.reportMessage') : t('chat.reportUser')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('chat.reportReason')}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spam">{t('chat.reportReasons.spam')}</SelectItem>
                <SelectItem value="harassment">{t('chat.reportReasons.harassment')}</SelectItem>
                <SelectItem value="inappropriate">
                  {t('chat.reportReasons.inappropriate')}
                </SelectItem>
                <SelectItem value="fraud">{t('chat.reportReasons.fraud')}</SelectItem>
                <SelectItem value="other">{t('chat.reportReasons.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('chat.reportDetail')}</Label>
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('chat.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('chat.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
