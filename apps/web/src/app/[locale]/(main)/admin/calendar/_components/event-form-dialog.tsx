/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const CATEGORIES = [
  'TEST',
  'COMPETITION',
  'SUMMER_PROGRAM',
  'FINANCIAL_AID',
  'APPLICATION',
  'OTHER',
];
const YEARS = [2025, 2026, 2027];

export interface EventFormData {
  title: string;
  titleZh: string;
  category: string;
  eventDate: string;
  registrationDeadline: string;
  lateDeadline: string;
  resultDate: string;
  description: string;
  descriptionZh: string;
  url: string;
  year: number;
  isRecurring: boolean;
  isActive: boolean;
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: EventFormData;
  onFormChange: (form: EventFormData) => void;
  onSubmit: () => void;
  onReset: () => void;
  isPending: boolean;
}

export function EventFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  onSubmit,
  onReset,
  isPending,
}: EventFormDialogProps) {
  const t = useTranslations('admin');

  const getCategoryLabel = (cat: string) => {
    const key = `events.categories.${cat}` as any;
    return t.has(key) ? t(key) : cat;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(false);
          onReset();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? t('events.edit') : t('events.create')}</DialogTitle>
          <DialogDescription>{t('events.formDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('events.titleEn')} *</Label>
            <Input
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('events.titleZh')}</Label>
            <Input
              value={form.titleZh}
              onChange={(e) => onFormChange({ ...form, titleZh: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('events.category')} *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => onFormChange({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {getCategoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('deadlines.year')} *</Label>
              <Select
                value={String(form.year)}
                onValueChange={(v) => onFormChange({ ...form, year: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('events.eventDate')} *</Label>
              <Input
                type="date"
                value={form.eventDate}
                onChange={(e) => onFormChange({ ...form, eventDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('events.regDeadline')}</Label>
              <Input
                type="date"
                value={form.registrationDeadline}
                onChange={(e) => onFormChange({ ...form, registrationDeadline: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('events.lateDeadline')}</Label>
              <Input
                type="date"
                value={form.lateDeadline}
                onChange={(e) => onFormChange({ ...form, lateDeadline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('events.resultDate')}</Label>
              <Input
                type="date"
                value={form.resultDate}
                onChange={(e) => onFormChange({ ...form, resultDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('events.descriptionEn')}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('events.descriptionZh')}</Label>
            <Textarea
              value={form.descriptionZh}
              onChange={(e) => onFormChange({ ...form, descriptionZh: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input
              value={form.url}
              onChange={(e) => onFormChange({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isRecurring}
                onCheckedChange={(v) => onFormChange({ ...form, isRecurring: v })}
              />
              <Label>{t('events.recurring')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => onFormChange({ ...form, isActive: v })}
              />
              <Label>{t('events.active')}</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
          >
            {t('dialogs.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !form.title || !form.eventDate}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingId ? t('events.save') : t('events.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
