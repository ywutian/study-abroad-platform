'use client';

import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationConfirmDialogProps {
  confirmAction: 'APPROVE' | 'REJECT' | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isReviewPending: boolean;
}

export function VerificationConfirmDialog({
  confirmAction,
  onOpenChange,
  onConfirm,
  isReviewPending,
}: VerificationConfirmDialogProps) {
  const t = useTranslations('admin');

  return (
    <AlertDialog
      open={!!confirmAction}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmAction === 'APPROVE'
              ? t('verifications.actions.approve')
              : t('verifications.actions.reject')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmAction === 'APPROVE'
              ? t('verifications.actions.confirmApprove')
              : t('verifications.actions.confirmReject')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              confirmAction === 'REJECT' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {isReviewPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {confirmAction === 'APPROVE'
              ? t('verifications.actions.approve')
              : t('verifications.actions.reject')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
