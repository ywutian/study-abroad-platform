'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

import type { User } from './users-table';

interface BanUserDialogProps {
  userToBan: User | null;
  onClose: () => void;
  banReason: string;
  onBanReasonChange: (value: string) => void;
  banDuration: number;
  onBanDurationChange: (value: number) => void;
  banPermanent: boolean;
  onBanPermanentChange: (value: boolean) => void;
  onConfirmBan: () => void;
  isPending: boolean;
}

export function BanUserDialog({
  userToBan,
  onClose,
  banReason,
  onBanReasonChange,
  banDuration,
  onBanDurationChange,
  banPermanent,
  onBanPermanentChange,
  onConfirmBan,
  isPending,
}: BanUserDialogProps) {
  const t = useTranslations('admin');

  return (
    <Dialog open={!!userToBan} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ban.banUser')}</DialogTitle>
          <DialogDescription>{t('ban.banDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('ban.reason')}</Label>
            <Textarea
              placeholder={t('ban.reasonPlaceholder')}
              value={banReason}
              onChange={(e) => onBanReasonChange(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('ban.permanent')}</Label>
            <Switch checked={banPermanent} onCheckedChange={onBanPermanentChange} />
          </div>
          {!banPermanent && (
            <div className="space-y-2">
              <Label>
                {t('ban.duration')} ({t('ban.hours')})
              </Label>
              <Input
                type="number"
                min={1}
                value={banDuration}
                onChange={(e) => onBanDurationChange(Number(e.target.value))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>
            {t('dialogs.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirmBan} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('ban.banConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UnbanUserDialogProps {
  userId: string | null;
  onClose: () => void;
  onConfirmUnban: () => void;
  isPending: boolean;
}

export function UnbanUserDialog({
  userId,
  onClose,
  onConfirmUnban,
  isPending,
}: UnbanUserDialogProps) {
  const t = useTranslations('admin');

  return (
    <AlertDialog open={!!userId} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('ban.unbanUser')}</AlertDialogTitle>
          <AlertDialogDescription>{t('ban.unbanDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmUnban}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('ban.unbanConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteUserDialogProps {
  userId: string | null;
  onClose: () => void;
  onConfirmDelete: () => void;
  isPending: boolean;
}

export function DeleteUserDialog({
  userId,
  onClose,
  onConfirmDelete,
  isPending,
}: DeleteUserDialogProps) {
  const t = useTranslations('admin');

  return (
    <AlertDialog open={!!userId} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialogs.deleteUserTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('dialogs.deleteUserDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('dialogs.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
