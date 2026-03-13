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
import type { DeleteConfirmationDialogProps } from './timeline-helpers';

export function DeleteConfirmationDialog({
  deleteTarget,
  setDeleteTarget,
  deleteTimelineMutation,
  deletePersonalEventMutation,
}: DeleteConfirmationDialogProps) {
  const t = useTranslations('timeline');

  return (
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteConfirmDesc', { name: deleteTarget?.name || '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!deleteTarget) return;
              if (deleteTarget.type === 'timeline') {
                deleteTimelineMutation.mutate(deleteTarget.id);
              } else if (deleteTarget.type === 'personalEvent') {
                deletePersonalEventMutation.mutate(deleteTarget.id);
              }
              setDeleteTarget(null);
            }}
          >
            {t('deleteConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
