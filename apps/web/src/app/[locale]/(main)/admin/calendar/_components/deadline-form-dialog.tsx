'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

const INTERVIEW_FORMATS = [
  'ALUMNI',
  'ADMISSIONS_OFFICER',
  'INITIALVIEW',
  'VERICANT',
  'KIRA',
  'GROUP',
  'OPTIONAL',
  'NOT_OFFERED',
] as const;

export interface DeadlineFormData {
  schoolId: string;
  year: number;
  round: string;
  applicationDeadline: string;
  financialAidDeadline: string;
  decisionDate: string;
  essayCount: number;
  interviewRequired: boolean;
  interviewFormat: string;
  interviewDeadline: string;
  applicationFee: number;
  notes: string;
}

interface SchoolOption {
  id: string;
  name: string;
  nameZh?: string;
}

const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'];
const YEARS = [2025, 2026, 2027];

interface DeadlineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: DeadlineFormData;
  onFormChange: (form: DeadlineFormData) => void;
  onSubmit: () => void;
  onReset: () => void;
  isPending: boolean;
  schoolQuery: string;
  onSchoolQueryChange: (query: string) => void;
  schoolOptions: SchoolOption[];
  onSchoolSelect: (school: SchoolOption) => void;
  getSchoolDisplayName: (school: { name: string; nameZh?: string }) => string;
}

export function DeadlineFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  onSubmit,
  onReset,
  isPending,
  schoolQuery,
  onSchoolQueryChange,
  schoolOptions,
  onSchoolSelect,
  getSchoolDisplayName,
}: DeadlineFormDialogProps) {
  const t = useTranslations('admin');

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onOpenChange(false);
          onReset();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? t('deadlines.edit') : t('deadlines.create')}</DialogTitle>
          <DialogDescription>{t('deadlines.formDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* School search */}
          {!editingId && (
            <div className="space-y-2">
              <Label>{t('deadlines.school')}</Label>
              <Input
                placeholder={t('deadlines.searchSchool')}
                value={schoolQuery}
                onChange={(e) => onSchoolQueryChange(e.target.value)}
              />
              {schoolOptions.length > 0 && !form.schoolId && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {schoolOptions.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => onSchoolSelect(s)}
                    >
                      {getSchoolDisplayName(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('deadlines.year')}</Label>
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
            <div className="space-y-2">
              <Label>{t('deadlines.round')}</Label>
              <Select value={form.round} onValueChange={(v) => onFormChange({ ...form, round: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUNDS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('deadlines.appDeadline')} *</Label>
            <Input
              type="date"
              value={form.applicationDeadline}
              onChange={(e) => onFormChange({ ...form, applicationDeadline: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('deadlines.aidDeadline')}</Label>
              <Input
                type="date"
                value={form.financialAidDeadline}
                onChange={(e) => onFormChange({ ...form, financialAidDeadline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('deadlines.decisionDate')}</Label>
              <Input
                type="date"
                value={form.decisionDate}
                onChange={(e) => onFormChange({ ...form, decisionDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('deadlines.essayCount')}</Label>
              <Input
                type="number"
                min={0}
                value={form.essayCount}
                onChange={(e) => onFormChange({ ...form, essayCount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('deadlines.appFee')}</Label>
              <Input
                type="number"
                min={0}
                value={form.applicationFee}
                onChange={(e) => onFormChange({ ...form, applicationFee: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.interviewRequired}
              onCheckedChange={(v) => onFormChange({ ...form, interviewRequired: v })}
            />
            <Label>{t('deadlines.interviewRequired')}</Label>
          </div>
          {form.interviewRequired && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('deadlines.interviewFormat')}</Label>
                <Select
                  value={form.interviewFormat}
                  onValueChange={(v) => onFormChange({ ...form, interviewFormat: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('deadlines.selectFormat')} />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('deadlines.interviewDeadline')}</Label>
                <Input
                  type="date"
                  value={form.interviewDeadline}
                  onChange={(e) => onFormChange({ ...form, interviewDeadline: e.target.value })}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('deadlines.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
            />
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
          <Button
            onClick={onSubmit}
            disabled={isPending || (!editingId && !form.schoolId) || !form.applicationDeadline}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingId ? t('deadlines.save') : t('deadlines.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
