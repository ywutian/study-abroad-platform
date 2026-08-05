'use client';

import { GPA_SCALES } from '@study-abroad/shared';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import {
  GraduationCap,
  Calculator,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  X,
} from 'lucide-react';
import type { Control, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import type { ProfileFormValues } from '@/lib/validations/profile';
import type { SemesterGpa } from './types';

/**
 * Derived from the shared GPA_SCALES so an option the API rejects cannot appear
 * here. Labels stay local (they are i18n keys, not data); the constant fixes
 * WHICH scales exist, which is the part that drifted.
 */
const GPA_SCALE_LABEL_KEYS: Record<number, string> = {
  4: 'profile.gpaScales.scale4',
  5: 'profile.gpaScales.scale5',
  6: 'profile.gpaScales.scale6',
  45: 'profile.gpaScales.scale45',
  100: 'profile.gpaScales.scale100',
};

const GPA_SCALE_OPTIONS = GPA_SCALES.map((scale) => ({
  // 4 and 5 were historically stored as "4.0"/"5.0" strings by this form.
  value: scale === 4 || scale === 5 ? scale.toFixed(1) : String(scale),
  labelKey: GPA_SCALE_LABEL_KEYS[scale],
}));

const GRADE_WEIGHTS = {
  gpa9: 0.15,
  gpa10: 0.25,
  gpa11: 0.35,
  gpa12: 0.25,
} as const;

type GradeKey = keyof typeof GRADE_WEIGHTS;

const GRADE_KEYS: GradeKey[] = ['gpa9', 'gpa10', 'gpa11', 'gpa12'];

const SEMESTER_OPTIONS = [
  'g9fall',
  'g9spring',
  'g10fall',
  'g10spring',
  'g11fall',
  'g11spring',
  'g12fall',
  'g12spring',
] as const;

interface SemesterFormData {
  semester: string;
  year: string;
  gpa: string;
  gpaScale: string;
  credits: string;
}

const emptySemesterForm: SemesterFormData = {
  semester: '',
  year: new Date().getFullYear().toString(),
  gpa: '',
  gpaScale: '',
  credits: '',
};

interface GpaTabProps {
  control: Control<ProfileFormValues>;
  watch: UseFormWatch<ProfileFormValues>;
  setValue: UseFormSetValue<ProfileFormValues>;
  semesterGpas?: SemesterGpa[];
  onCreateSemesterGpa?: (data: {
    semester: string;
    year: number;
    gpa: number;
    gpaScale: number;
    credits?: number;
    order?: number;
  }) => void;
  onUpdateSemesterGpa?: (
    id: string,
    data: { semester?: string; year?: number; gpa?: number; gpaScale?: number; credits?: number }
  ) => void;
  onDeleteSemesterGpa?: (id: string) => void;
  isSemesterMutating?: boolean;
}

export function GpaTab({
  control,
  watch,
  setValue,
  semesterGpas = [],
  onCreateSemesterGpa,
  onUpdateSemesterGpa,
  onDeleteSemesterGpa,
  isSemesterMutating,
}: GpaTabProps) {
  const t = useTranslations();

  const watchedGpaScale = watch('gpaScale');
  const watchedGpa9 = watch('gpa9');
  const watchedGpa10 = watch('gpa10');
  const watchedGpa11 = watch('gpa11');
  const watchedGpa12 = watch('gpa12');
  const watchedGpa = watch('gpa');

  const gradeValues = {
    gpa9: watchedGpa9,
    gpa10: watchedGpa10,
    gpa11: watchedGpa11,
    gpa12: watchedGpa12,
  };
  const hasDetailedData = GRADE_KEYS.some((key) => gradeValues[key] !== '');
  const [mode, setMode] = useState<'simple' | 'detailed'>(hasDetailedData ? 'detailed' : 'simple');

  // Semester GPA local state
  const [semesterOpen, setSemesterOpen] = useState(semesterGpas.length > 0);
  const [isAddingSemester, setIsAddingSemester] = useState(false);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [semesterForm, setSemesterForm] = useState<SemesterFormData>(emptySemesterForm);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const calculatedGpa = useMemo(() => {
    const filledGrades = GRADE_KEYS.filter((key) => gradeValues[key] !== '');
    if (filledGrades.length === 0) return null;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const key of filledGrades) {
      const value = parseFloat(gradeValues[key]);
      if (!isNaN(value)) {
        weightedSum += value * GRADE_WEIGHTS[key];
        totalWeight += GRADE_WEIGHTS[key];
      }
    }

    if (totalWeight === 0) return null;
    return (weightedSum / totalWeight).toFixed(2);
  }, [gradeValues]);

  const handleGradeGpaChange = (key: GradeKey, value: string) => {
    setValue(key, value, { shouldValidate: true });

    // Auto-calculate overall GPA from grade-level GPAs
    const updated = { ...gradeValues, [key]: value };
    const filledGrades = GRADE_KEYS.filter((k) => updated[k] !== '');
    if (filledGrades.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const k of filledGrades) {
        const v = parseFloat(updated[k]);
        if (!isNaN(v)) {
          weightedSum += v * GRADE_WEIGHTS[k];
          totalWeight += GRADE_WEIGHTS[k];
        }
      }
      if (totalWeight > 0) {
        setValue('gpa', (weightedSum / totalWeight).toFixed(2));
      }
    } else {
      setValue('gpa', '');
    }
  };

  const handleStartAdd = () => {
    setSemesterForm({ ...emptySemesterForm, gpaScale: watchedGpaScale || '4.0' });
    setIsAddingSemester(true);
    setEditingSemesterId(null);
    setSemesterOpen(true);
  };

  const handleStartEdit = (sg: SemesterGpa) => {
    setSemesterForm({
      semester: sg.semester,
      year: sg.year.toString(),
      gpa: sg.gpa.toString(),
      gpaScale: sg.gpaScale.toString(),
      credits: sg.credits?.toString() || '',
    });
    setEditingSemesterId(sg.id);
    setIsAddingSemester(false);
    setShowAdvanced(!!sg.credits);
  };

  const handleCancelForm = () => {
    setIsAddingSemester(false);
    setEditingSemesterId(null);
    setSemesterForm(emptySemesterForm);
    setShowAdvanced(false);
  };

  const handleSaveSemester = () => {
    const gpa = parseFloat(semesterForm.gpa);
    const year = parseInt(semesterForm.year, 10);
    const gpaScale = parseFloat(semesterForm.gpaScale);
    if (!semesterForm.semester || isNaN(gpa) || isNaN(year) || isNaN(gpaScale)) return;

    const payload: {
      semester: string;
      year: number;
      gpa: number;
      gpaScale: number;
      credits?: number;
      order?: number;
    } = {
      semester: semesterForm.semester,
      year,
      gpa,
      gpaScale,
    };
    if (semesterForm.credits) {
      payload.credits = parseFloat(semesterForm.credits);
    }

    if (editingSemesterId) {
      onUpdateSemesterGpa?.(editingSemesterId, payload);
    } else {
      payload.order = semesterGpas.length;
      onCreateSemesterGpa?.(payload);
    }
    handleCancelForm();
  };

  const scaleLabel = t(
    'profile.gpaScales.scale' +
      (watchedGpaScale === '100'
        ? '100'
        : watchedGpaScale === '45'
          ? '45'
          : watchedGpaScale === '6'
            ? '6'
            : watchedGpaScale === '5.0'
              ? '5'
              : '4')
  );

  const maxGpa = watchedGpaScale === '100' ? '100' : watchedGpaScale;
  const isFormValid =
    semesterForm.semester && semesterForm.gpa && semesterForm.year && semesterForm.gpaScale;

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-success" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-success" />
              {t('profile.gpa')}
            </CardTitle>
            <CardDescription className="mt-1.5">{t('profile.gpaDesc')}</CardDescription>
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              variant={mode === 'simple' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setMode('simple')}
            >
              {t('profile.gpaSimpleMode')}
            </Button>
            <Button
              variant={mode === 'detailed' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setMode('detailed')}
            >
              {t('profile.gpaDetailedMode')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* GPA Scale selector - shown in both modes */}
        <FormField
          control={control}
          name="gpaScale"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">{t('profile.gpaScale')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11 sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {/* Values come from GPA_SCALES so this list cannot drift from
                      what the API accepts — a 100/45/6 option the backend
                      rejects is how the What-if simulator 400'd on every press
                      for those students. Order and labels stay local: the
                      constant fixes the SET, not the presentation. */}
                  {GPA_SCALE_OPTIONS.map(({ value, labelKey }) => (
                    <SelectItem key={value} value={value}>
                      {t(labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'simple' ? (
          /* Simple mode: single GPA input */
          <FormField
            control={control}
            name="gpa"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">{t('profile.gpa')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxGpa}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t('profile.placeholders.gpaExample')}
                    className="h-11 text-lg font-semibold sm:max-w-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          /* Detailed mode: grade-level GPAs */
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">{t('profile.gpaByGrade')}</Label>
              <p className="mt-1 text-sm text-muted-foreground">{t('profile.gpaByGradeDesc')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {GRADE_KEYS.map((key) => (
                <FormField
                  key={key}
                  control={control}
                  name={key}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t(`profile.${key}`)}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={maxGpa}
                          value={field.value}
                          onChange={(e) => handleGradeGpaChange(key, e.target.value)}
                          onBlur={field.onBlur}
                          placeholder={t(`profile.${key}`)}
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {/* Calculated GPA display */}
            {calculatedGpa && (
              <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                <div className="flex items-center gap-3">
                  <Calculator className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-sm font-medium">{t('profile.calculatedGpa')}</p>
                    <p className="text-xs text-muted-foreground">{t('profile.weightedAverage')}</p>
                  </div>
                  <div className="ml-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success text-success-foreground shadow-lg">
                    <span className="text-lg font-bold">{calculatedGpa}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Semester GPA section — collapsible, optional */}
            <Collapsible open={semesterOpen} onOpenChange={setSemesterOpen}>
              <div className="rounded-xl border border-border">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('profile.semesterGpa')}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {t('profile.semesterGpaOptional')}
                      </Badge>
                      {semesterGpas.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {semesterGpas.length}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${semesterOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {t('profile.semesterGpaHelper')}
                    </p>
                    {semesterGpas.length > 0 && !hasDetailedData && (
                      <p className="text-xs text-primary">{t('profile.gpaFromSemesters')}</p>
                    )}

                    {/* Semester GPA list */}
                    {semesterGpas.length > 0 && (
                      <div className="space-y-2">
                        {semesterGpas.map((sg) => (
                          <div
                            key={sg.id}
                            className="group flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                          >
                            {editingSemesterId === sg.id ? (
                              <SemesterInlineForm
                                form={semesterForm}
                                onChange={setSemesterForm}
                                onSave={handleSaveSemester}
                                onCancel={handleCancelForm}
                                maxGpa={maxGpa}
                                isLoading={isSemesterMutating}
                                isValid={!!isFormValid}
                                showAdvanced={showAdvanced}
                                onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
                                t={t}
                              />
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs">
                                    {t(`profile.semesterOptions.${sg.semester}`)}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">{sg.year}</span>
                                  <span className="text-sm font-semibold">{sg.gpa}</span>
                                  {sg.credits && (
                                    <span className="text-xs text-muted-foreground">
                                      ({sg.credits} {t('profile.credits')})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleStartEdit(sg)}
                                    disabled={isSemesterMutating}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span className="sr-only">{t('profile.editSemester')}</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => onDeleteSemesterGpa?.(sg.id)}
                                    disabled={isSemesterMutating}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">{t('profile.deleteSemester')}</span>
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add form */}
                    {isAddingSemester && (
                      <div className="rounded-lg border border-border bg-background p-3">
                        <SemesterInlineForm
                          form={semesterForm}
                          onChange={setSemesterForm}
                          onSave={handleSaveSemester}
                          onCancel={handleCancelForm}
                          maxGpa={maxGpa}
                          isLoading={isSemesterMutating}
                          isValid={!!isFormValid}
                          showAdvanced={showAdvanced}
                          onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
                          t={t}
                        />
                      </div>
                    )}

                    {/* Empty state or add button */}
                    {!isAddingSemester && editingSemesterId === null && (
                      <>
                        {semesterGpas.length === 0 && (
                          <p className="text-center text-xs text-muted-foreground py-2">
                            {t('profile.noSemesterGpas')}
                          </p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={handleStartAdd}
                          disabled={isSemesterMutating}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {t('profile.addSemester')}
                        </Button>
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}

        {/* Weighted GPA — optional; may exceed the scale (AP/Honors bonus). Shown
            in both modes since it's a single figure straight off the transcript. */}
        <FormField
          control={control}
          name="weightedGpa"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">
                {t('profile.weightedGpa')}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {t('profile.weightedGpaHint')}
                </span>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={t('profile.placeholders.weightedGpaExample')}
                  className="h-11 sm:max-w-xs"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* GPA summary display */}
        {watchedGpa && (
          <div className="rounded-xl bg-success/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success text-success-foreground shadow-lg">
                <span className="text-xl font-bold">{watchedGpa}</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('profile.yourGpa')}</p>
                <p className="font-medium">{scaleLabel}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Inline form for adding/editing a semester GPA entry */
function SemesterInlineForm({
  form,
  onChange,
  onSave,
  onCancel,
  maxGpa,
  isLoading,
  isValid,
  showAdvanced,
  onToggleAdvanced,
  t,
}: {
  form: SemesterFormData;
  onChange: (f: SemesterFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  maxGpa: string;
  isLoading?: boolean;
  isValid: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="w-full space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('profile.semesterName')}</Label>
          <Select value={form.semester} onValueChange={(v) => onChange({ ...form, semester: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t('profile.semesterName')} />
            </SelectTrigger>
            <SelectContent>
              {SEMESTER_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {t(`profile.semesterOptions.${opt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('profile.semesterYear')}</Label>
          <Input
            type="number"
            min="2000"
            max="2035"
            value={form.year}
            onChange={(e) => onChange({ ...form, year: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('profile.gpa')}</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max={maxGpa}
            value={form.gpa}
            onChange={(e) => onChange({ ...form, gpa: e.target.value })}
            placeholder="3.85"
            className="h-9"
          />
        </div>
      </div>

      {/* Advanced: credits (hidden by default) */}
      {showAdvanced && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('profile.credits')}</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={form.credits}
              onChange={(e) => onChange({ ...form, credits: e.target.value })}
              placeholder="15"
              className="h-9"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={onToggleAdvanced}
          aria-expanded={showAdvanced}
        >
          {t('profile.advancedOptions')} {showAdvanced ? '−' : '+'}
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8" onClick={onCancel} disabled={isLoading}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t('profile.cancelSemester')}
          </Button>
          <Button size="sm" className="h-8" onClick={onSave} disabled={isLoading || !isValid}>
            {t('profile.saveSemester')}
          </Button>
        </div>
      </div>
    </div>
  );
}
