'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { computeTierFromPartial } from '@study-abroad/shared/scoring';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, HelpCircle } from 'lucide-react';

export interface HighSchool {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  type?: string;
  tier?: string;
  recognition?: number;
  academicRigor?: number;
  placementRecord?: number;
  studentQuality?: number;
  resources?: number;
  avgSatScore?: number;
  avgIbScore?: number;
  annualTop30Count?: number;
  gradeInflation?: string;
  evaluationNotes?: string;
  evaluatedAt?: string;
}

interface SchoolEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: HighSchool | null;
  onSave: (id: string, data: Record<string, unknown>) => void;
  isSaving: boolean;
}

const SCHOOL_TYPES = [
  'PUBLIC_US',
  'PRIVATE_US',
  'BOARDING_US',
  'INTL_CN',
  'PUBLIC_CN',
  'PRIVATE_CN',
  'INTL_OTHER',
  'PUBLIC_OTHER',
  'PRIVATE_OTHER',
];
const GRADE_INFLATION_OPTIONS = ['deflation', 'neutral', 'inflation'];

const DIMENSION_KEYS = [
  'recognition',
  'academicRigor',
  'placementRecord',
  'studentQuality',
  'resources',
] as const;

function computeTier(scores: Record<string, number>): number {
  return computeTierFromPartial(scores) ?? 3;
}

const TIER_VARIANT: Record<
  number,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  5: 'success',
  4: 'default',
  3: 'secondary',
  2: 'warning',
  1: 'destructive',
};

export function SchoolEditDialog({
  open,
  onOpenChange,
  school,
  onSave,
  isSaving,
}: SchoolEditDialogProps) {
  const t = useTranslations('admin.highSchools');
  const tc = useTranslations('admin.common');
  const [form, setForm] = useState({
    name: '',
    nameZh: '',
    country: '',
    type: '',
    recognition: 3,
    academicRigor: 3,
    placementRecord: 3,
    studentQuality: 3,
    resources: 3,
    avgSatScore: '',
    avgIbScore: '',
    annualTop30Count: '',
    gradeInflation: '',
    evaluationNotes: '',
  });

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name || '',
        nameZh: school.nameZh || '',
        country: school.country || '',
        type: school.type || '',
        recognition: school.recognition ?? 3,
        academicRigor: school.academicRigor ?? 3,
        placementRecord: school.placementRecord ?? 3,
        studentQuality: school.studentQuality ?? 3,
        resources: school.resources ?? 3,
        avgSatScore: school.avgSatScore?.toString() || '',
        avgIbScore: school.avgIbScore?.toString() || '',
        annualTop30Count: school.annualTop30Count?.toString() || '',
        gradeInflation: school.gradeInflation || '',
        evaluationNotes: school.evaluationNotes || '',
      });
    }
  }, [school]);

  const computedTier = useMemo(
    () =>
      computeTier({
        recognition: form.recognition,
        academicRigor: form.academicRigor,
        placementRecord: form.placementRecord,
        studentQuality: form.studentQuality,
        resources: form.resources,
      }),
    [
      form.recognition,
      form.academicRigor,
      form.placementRecord,
      form.studentQuality,
      form.resources,
    ]
  );

  const handleSave = () => {
    if (!school) return;
    onSave(school.id, {
      name: form.name,
      nameZh: form.nameZh || undefined,
      country: form.country,
      type: form.type || undefined,
      recognition: form.recognition,
      academicRigor: form.academicRigor,
      placementRecord: form.placementRecord,
      studentQuality: form.studentQuality,
      resources: form.resources,
      avgSatScore: form.avgSatScore ? Number(form.avgSatScore) : undefined,
      avgIbScore: form.avgIbScore ? Number(form.avgIbScore) : undefined,
      annualTop30Count: form.annualTop30Count ? Number(form.annualTop30Count) : undefined,
      gradeInflation: form.gradeInflation || undefined,
      evaluationNotes: form.evaluationNotes || undefined,
    });
  };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dialog.editTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">{t('dialog.basicInfo')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('dialog.name')}</Label>
                <Input value={form.name} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('dialog.chineseName')}</Label>
                <Input value={form.nameZh} onChange={(e) => setField('nameZh', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('dialog.country')}</Label>
                <Input value={form.country} onChange={(e) => setField('country', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('dialog.type')}</Label>
                <Select value={form.type} onValueChange={(v) => setField('type', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('dialog.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {t(`schoolTypes.${st}` as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Dimension Evaluation with Rubric */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">{t('dialog.dimensions')}</h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('dialog.computedTier')}</span>
                <Badge variant={TIER_VARIANT[computedTier] ?? 'secondary'}>{computedTier}</Badge>
              </div>
            </div>
            <TooltipProvider delayDuration={200}>
              {DIMENSION_KEYS.map((dimKey) => {
                const currentValue = form[dimKey as keyof typeof form] as number;
                const labelFull = t(`rubric.${dimKey}.labelFull` as any);
                const weight = t(`rubric.${dimKey}.weight` as any);

                return (
                  <div key={dimKey} className="space-y-2 rounded-lg border p-3">
                    {/* Header: label + weight + score + help */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">{labelFull}</Label>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {weight}
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={t('dialog.helpFor', {
                                label: t(`rubric.${dimKey}.label` as any),
                              })}
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-sm p-3">
                            <div className="space-y-2 text-xs">
                              {[5, 4, 3, 2, 1].map((score) => (
                                <div
                                  key={score}
                                  className={
                                    score === currentValue ? 'font-medium' : 'text-muted-foreground'
                                  }
                                >
                                  <span className="font-mono">{score}:</span>{' '}
                                  {t(`rubric.${dimKey}.${score}.criteria` as any)}
                                  <br />
                                  <span className="italic">
                                    {t('dialog.egPrefix')}{' '}
                                    {t(`rubric.${dimKey}.${score}.examples` as any)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-lg font-semibold tabular-nums text-foreground">
                        {currentValue}
                      </span>
                    </div>

                    {/* Slider */}
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[currentValue]}
                      onValueChange={([v]) => setField(dimKey as keyof typeof form, v as never)}
                    />

                    {/* Current level description + examples inline */}
                    <div className="text-xs space-y-0.5">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{t('dialog.criteria')}</span>{' '}
                        {t(`rubric.${dimKey}.${currentValue}.criteria` as any)}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{t('dialog.reference')}</span>{' '}
                        {t(`rubric.${dimKey}.${currentValue}.examples` as any)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </TooltipProvider>
          </div>

          {/* Supplementary Data */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">{t('dialog.supplementary')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('dialog.avgSatScore')}</Label>
                <Input
                  type="number"
                  value={form.avgSatScore}
                  onChange={(e) => setField('avgSatScore', e.target.value)}
                  placeholder={`${t('dialog.egPrefix')} 1450`}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('dialog.avgIbScore')}</Label>
                <Input
                  type="number"
                  value={form.avgIbScore}
                  onChange={(e) => setField('avgIbScore', e.target.value)}
                  placeholder={`${t('dialog.egPrefix')} 38`}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('dialog.annualTop30Count')}</Label>
                <Input
                  type="number"
                  value={form.annualTop30Count}
                  onChange={(e) => setField('annualTop30Count', e.target.value)}
                  placeholder={`${t('dialog.egPrefix')} 15`}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('dialog.gradeInflation')}</Label>
                <Select
                  value={form.gradeInflation}
                  onValueChange={(v) => setField('gradeInflation', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('dialog.selectLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_INFLATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {t(`gradeInflationOptions.${opt}` as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t('dialog.evaluationNotes')}</Label>
            <Textarea
              value={form.evaluationNotes}
              onChange={(e) => setField('evaluationNotes', e.target.value)}
              placeholder={t('dialog.notesPlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !form.name}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
