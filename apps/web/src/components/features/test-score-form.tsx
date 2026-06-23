'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { profileRoutes } from '@study-abroad/shared';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { createTestScoreSchema, type TestScoreFormValues } from '@/lib/validations/profile';
import {
  TEST_TYPES,
  AP_SUBJECTS,
  IB_SUBJECTS,
  A_LEVEL_SUBJECTS,
  A_LEVEL_GRADES,
  A_LEVEL_UCAS,
  IGCSE_SUBJECTS,
  IGCSE_GRADES,
  IGCSE_LETTER_GRADES,
  IGCSE_GRADE_POINTS,
} from './test-score-constants';

interface SubjectEntry {
  subject: string;
  score: string;
  level?: 'HL' | 'SL';
}

interface TestScore {
  id: string;
  type: string;
  score: number;
  subScores?: Record<string, number | string>;
  testDate?: string;
}

interface TestScoreFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingScore?: TestScore | null;
}

function parseSubjectEntries(
  type: string,
  subScores?: Record<string, number | string>
): SubjectEntry[] {
  if (!subScores || Object.keys(subScores).length === 0) return [];
  return Object.entries(subScores).map(([subject, score]) => {
    if (type === 'IB') {
      const match = subject.match(/^(.+?)\s*\((HL|SL)\)$/);
      if (match) {
        return { subject: match[1], score: String(score), level: match[2] as 'HL' | 'SL' };
      }
    }
    return { subject, score: String(score) };
  });
}

export function TestScoreForm({ open, onOpenChange, editingScore }: TestScoreFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!editingScore;

  const schema = useMemo(() => createTestScoreSchema(t), [t]);
  const form = useForm<TestScoreFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: undefined,
      score: '',
      testDate: '',
      satReading: '',
      satMath: '',
      toeflReading: '',
      toeflListening: '',
      toeflSpeaking: '',
      toeflWriting: '',
    },
  });

  const [subjectEntries, setSubjectEntries] = useState<SubjectEntry[]>([]);
  const [igcseGradeMode, setIgcseGradeMode] = useState<'numeric' | 'letter'>('numeric');

  // Reset form when dialog opens with editing data
  useEffect(() => {
    if (open) {
      if (editingScore) {
        form.reset({
          type: editingScore.type as TestScoreFormValues['type'],
          score: editingScore.score?.toString() || '',
          testDate: editingScore.testDate?.slice(0, 10) || '',
          satReading: editingScore.subScores?.reading?.toString() || '',
          satMath: editingScore.subScores?.math?.toString() || '',
          toeflReading: editingScore.subScores?.reading?.toString() || '',
          toeflListening: editingScore.subScores?.listening?.toString() || '',
          toeflSpeaking: editingScore.subScores?.speaking?.toString() || '',
          toeflWriting: editingScore.subScores?.writing?.toString() || '',
        });
        if (['AP', 'IB', 'A_LEVEL', 'IGCSE'].includes(editingScore.type)) {
          setSubjectEntries(parseSubjectEntries(editingScore.type, editingScore.subScores));
        } else {
          setSubjectEntries([]);
        }
      } else {
        form.reset({
          type: undefined,
          score: '',
          testDate: '',
          satReading: '',
          satMath: '',
          toeflReading: '',
          toeflListening: '',
          toeflSpeaking: '',
          toeflWriting: '',
        });
        setSubjectEntries([]);
      }
    }
  }, [open, editingScore, form]);

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post(profileRoutes.testScores(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile-ai-analysis'] });
      queryClient.invalidateQueries({ queryKey: ['prediction'] });
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      toast.success(t('toast.scoreAdded'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.put(profileRoutes.testScore(editingScore!.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile-ai-analysis'] });
      queryClient.invalidateQueries({ queryKey: ['prediction'] });
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      toast.success(t('toast.scoreUpdated'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const addSubjectEntry = () => {
    const type = form.getValues('type');
    setSubjectEntries((prev) => [
      ...prev,
      { subject: '', score: '', level: type === 'IB' ? 'SL' : undefined },
    ]);
  };

  const removeSubjectEntry = (index: number) => {
    setSubjectEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSubjectEntry = (index: number, field: keyof SubjectEntry, value: string) => {
    setSubjectEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const watchedType = form.watch('type');
  const isSubjectType = ['AP', 'IB', 'A_LEVEL', 'IGCSE'].includes(watchedType || '');

  // Auto-calculate A-Level UCAS total
  const aLevelTotal = subjectEntries.reduce((sum, entry) => {
    return sum + (A_LEVEL_UCAS[entry.score] ?? 0);
  }, 0);

  // Auto-calculate IGCSE total
  const igcseTotal = subjectEntries.reduce((sum, entry) => {
    return sum + (IGCSE_GRADE_POINTS[entry.score] ?? 0);
  }, 0);

  const onSubmit = (values: TestScoreFormValues) => {
    // For subject-based types, score is computed or required differently
    if (!isSubjectType && !values.score) {
      toast.error(t('validation.scoreRequired'));
      return;
    }
    if (isSubjectType) {
      const hasCompleteSubjectEntry = subjectEntries.some((entry) => entry.subject && entry.score);
      if (!hasCompleteSubjectEntry && !values.score) {
        toast.error(t('validation.scoreRequired'));
        return;
      }
    }

    let subScores: Record<string, number | string> | undefined;
    let totalScore: number;

    if (values.type === 'AP') {
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          subScores[entry.subject] = parseInt(entry.score);
        }
      }
      totalScore = values.score ? parseInt(values.score) : subjectEntries.length;
    } else if (values.type === 'IB') {
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          const key = entry.level ? `${entry.subject} (${entry.level})` : entry.subject;
          subScores[key] = parseInt(entry.score);
        }
      }
      totalScore = values.score ? parseInt(values.score) : 0;
    } else if (values.type === 'A_LEVEL') {
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          subScores[entry.subject] = entry.score;
        }
      }
      totalScore = aLevelTotal;
    } else if (values.type === 'IGCSE') {
      subScores = {};
      for (const entry of subjectEntries) {
        if (entry.subject && entry.score) {
          subScores[entry.subject] = entry.score;
        }
      }
      totalScore = igcseTotal;
    } else if (values.type === 'SAT' && (values.satReading || values.satMath)) {
      subScores = {};
      if (values.satReading) subScores.reading = parseInt(values.satReading);
      if (values.satMath) subScores.math = parseInt(values.satMath);
      totalScore = parseInt(values.score || '0');
    } else if (values.type === 'TOEFL') {
      subScores = {};
      if (values.toeflReading) subScores.reading = parseInt(values.toeflReading);
      if (values.toeflListening) subScores.listening = parseInt(values.toeflListening);
      if (values.toeflSpeaking) subScores.speaking = parseInt(values.toeflSpeaking);
      if (values.toeflWriting) subScores.writing = parseInt(values.toeflWriting);
      totalScore = parseInt(values.score || '0');
    } else {
      totalScore = parseInt(values.score || '0');
    }

    const data = {
      type: values.type,
      score: totalScore,
      testDate: values.testDate || undefined,
      subScores: subScores && Object.keys(subScores).length > 0 ? subScores : undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedType = TEST_TYPES.find((tt) => tt.value === watchedType);

  const getSubjectList = () => {
    if (watchedType === 'AP') return AP_SUBJECTS;
    if (watchedType === 'IB') return IB_SUBJECTS;
    if (watchedType === 'A_LEVEL') return A_LEVEL_SUBJECTS;
    if (watchedType === 'IGCSE') return IGCSE_SUBJECTS;
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isSubjectType ? 'sm:max-w-lg' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editScore') : t('form.addScore')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.testType')} *</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue('score', '');
                        setSubjectEntries([]);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectTestType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TEST_TYPES.map((tt) => (
                          <SelectItem key={tt.value} value={tt.value}>
                            {tt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Score field — hidden for A-Level/IGCSE (auto-calculated) */}
              {watchedType !== 'A_LEVEL' && watchedType !== 'IGCSE' && (
                <FormField
                  control={form.control}
                  name="score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('form.score')} * {selectedType && `(Max ${selectedType.maxScore})`}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={
                            selectedType
                              ? `0 - ${selectedType.maxScore}`
                              : t('form.scorePlaceholder')
                          }
                          max={selectedType?.maxScore}
                          min={watchedType === 'SAT' ? 400 : watchedType === 'ACT' ? 1 : 0}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* SAT sub-scores */}
              {watchedType === 'SAT' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="satReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.readingEBRW')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="200 - 800"
                            max={800}
                            min={200}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="satMath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.math')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="200 - 800"
                            max={800}
                            min={200}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* TOEFL sub-scores */}
              {watchedType === 'TOEFL' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="toeflReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.reading')}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0 - 30" max={30} min={0} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toeflListening"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.listening')}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0 - 30" max={30} min={0} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toeflSpeaking"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.speaking')}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0 - 30" max={30} min={0} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toeflWriting"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.writing')}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0 - 30" max={30} min={0} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* AP / IB / A-Level / IGCSE subject entries */}
              {isSubjectType && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('form.subjects')}</FormLabel>
                    <div className="flex items-center gap-2">
                      {watchedType === 'IGCSE' && (
                        <button
                          type="button"
                          className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                          onClick={() =>
                            setIgcseGradeMode((m) => (m === 'numeric' ? 'letter' : 'numeric'))
                          }
                        >
                          {igcseGradeMode === 'numeric' ? '9-1' : 'A*-G'}
                        </button>
                      )}
                      {watchedType === 'A_LEVEL' && subjectEntries.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          UCAS: {aLevelTotal} pts
                        </span>
                      )}
                      {watchedType === 'IGCSE' && subjectEntries.length > 0 && (
                        <span className="text-xs text-muted-foreground">{igcseTotal} pts</span>
                      )}
                    </div>
                  </div>

                  {subjectEntries.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={entry.subject}
                        onValueChange={(v) => updateSubjectEntry(index, 'subject', v)}
                      >
                        <SelectTrigger className="flex-1 min-w-0">
                          <SelectValue placeholder={t('form.selectSubject')} />
                        </SelectTrigger>
                        <SelectContent>
                          {getSubjectList().map((subj) => (
                            <SelectItem key={subj} value={subj}>
                              {subj}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {watchedType === 'IB' && (
                        <Select
                          value={entry.level || 'SL'}
                          onValueChange={(v) => updateSubjectEntry(index, 'level', v)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HL">HL</SelectItem>
                            <SelectItem value="SL">SL</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {watchedType === 'A_LEVEL' || watchedType === 'IGCSE' ? (
                        <Select
                          value={entry.score}
                          onValueChange={(v) => updateSubjectEntry(index, 'score', v)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue placeholder="--" />
                          </SelectTrigger>
                          <SelectContent>
                            {(watchedType === 'A_LEVEL'
                              ? A_LEVEL_GRADES
                              : igcseGradeMode === 'numeric'
                                ? IGCSE_GRADES
                                : IGCSE_LETTER_GRADES
                            ).map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          value={entry.score}
                          onChange={(e) => updateSubjectEntry(index, 'score', e.target.value)}
                          placeholder={watchedType === 'AP' ? '1-5' : '1-7'}
                          className="w-20"
                          min={1}
                          max={watchedType === 'AP' ? 5 : 7}
                        />
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive"
                        onClick={() => removeSubjectEntry(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 w-full"
                    onClick={addSubjectEntry}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('form.addSubject')}
                  </Button>
                </div>
              )}

              <FormField
                control={form.control}
                name="testDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.testDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
