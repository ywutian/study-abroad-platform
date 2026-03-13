'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
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

interface VaultDeleteDialogProps {
  itemId: string | null;
  onClose: () => void;
  onConfirm: (itemId: string) => void;
}

export function VaultDeleteDialog({ itemId, onClose, onConfirm }: VaultDeleteDialogProps) {
  const t = useTranslations('vault');

  return (
    <AlertDialog open={!!itemId} onOpenChange={() => onClose()}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {t('confirmDelete')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {t('deleteConfirm')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border text-muted-foreground hover:bg-muted">
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => itemId && onConfirm(itemId)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
