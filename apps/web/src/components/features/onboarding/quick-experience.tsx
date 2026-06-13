'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  GraduationCap,
  Loader2,
  Plus,
  Compass,
  Search,
  Lightbulb,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { profileRoutes } from '@study-abroad/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { cn, getSchoolName } from '@/lib/utils';
import { useSchoolSearch } from '@/hooks/use-school-search';
import type { SchoolSearchItem } from '@/components/features/prediction/types';

const PENDING_ONBOARDING_KEY = 'showQuickExperience';

type ProfileDraft = {
  grade: string;
  educationSystem: string;
  currentSchool: string;
  nationality: string;
  countryOfResidence: string;
  citizenship: string;
  targetMajor: string;
  applicationRound: string;
  needsFinancialAid: boolean;
  applyingTestOptional: boolean;
  gpa: string;
  gpaScale: string;
};

type ActivityDraft = {
  name: string;
  category: string;
  role: string;
  description: string;
  hoursPerWeek: string;
  weeksPerYear: string;
};

type AwardDraft = {
  name: string;
  level: string;
  category: string;
  year: string;
  description: string;
};

type SelectedTargetSchool = SchoolSearchItem & {
  round: string;
};

const initialProfile: ProfileDraft = {
  grade: '',
  educationSystem: '',
  currentSchool: '',
  nationality: '',
  countryOfResidence: '',
  citizenship: '',
  targetMajor: '',
  applicationRound: 'RD',
  needsFinancialAid: false,
  applyingTestOptional: false,
  gpa: '',
  gpaScale: '4.0',
};

const emptyActivity = (): ActivityDraft => ({
  name: '',
  category: 'LEADERSHIP',
  role: '',
  description: '',
  hoursPerWeek: '',
  weeksPerYear: '',
});

const emptyAward = (): AwardDraft => ({
  name: '',
  level: 'NATIONAL',
  category: 'STEM',
  year: '',
  description: '',
});

const steps = [
  { id: 'profile', icon: GraduationCap },
  { id: 'scores', icon: BookOpen },
  { id: 'story', icon: Award },
  { id: 'schools', icon: Target },
] as const;

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compactText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function scoreEntry(type: string, value: string) {
  const score = toNumber(value);
  return score == null ? null : { type, score };
}

export function QuickExperience() {
  const t = useTranslations('dashboard.quickExperience');
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ProfileDraft>(initialProfile);
  const [scores, setScores] = useState({
    sat: '',
    act: '',
    toefl: '',
    ielts: '',
    duolingo: '',
  });
  const [activities, setActivities] = useState<ActivityDraft[]>([emptyActivity()]);
  const [awards, setAwards] = useState<AwardDraft[]>([emptyAward()]);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<SelectedTargetSchool[]>([]);
  const { data: schoolResults, isLoading: schoolSearchLoading } = useSchoolSearch(
    schoolQuery,
    open && step === 3
  );

  useEffect(() => {
    try {
      const pending = localStorage.getItem(PENDING_ONBOARDING_KEY);
      if (pending === 'true') {
        setOpen(true);
      }
    } catch {
      /* private browsing */
    }
  }, []);

  const progress = ((step + 1) / steps.length) * 100;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const testScores = [
        scoreEntry('SAT', scores.sat),
        scoreEntry('ACT', scores.act),
        scoreEntry('TOEFL', scores.toefl),
        scoreEntry('IELTS', scores.ielts),
        scoreEntry('DUOLINGO', scores.duolingo),
      ].filter(Boolean);

      return apiClient.post<{
        success: boolean;
        nextRoute?: string;
      }>(profileRoutes.onboarding(), {
        profile: {
          grade: compactText(profile.grade),
          educationSystem: compactText(profile.educationSystem),
          currentSchool: compactText(profile.currentSchool),
          nationality: compactText(profile.nationality),
          countryOfResidence: compactText(profile.countryOfResidence),
          citizenship: compactText(profile.citizenship),
          targetMajor: compactText(profile.targetMajor),
          intendedMajor: compactText(profile.targetMajor),
          applicationRound: compactText(profile.applicationRound),
          needsFinancialAid: profile.needsFinancialAid,
          applyingTestOptional: profile.applyingTestOptional,
          gpa: toNumber(profile.gpa),
          gpaScale: toNumber(profile.gpaScale),
        },
        testScores,
        activities: activities
          .filter((activity) => activity.name.trim() && activity.role.trim())
          .map((activity) => ({
            name: activity.name.trim(),
            category: activity.category,
            role: activity.role.trim(),
            description: compactText(activity.description),
            hoursPerWeek: toNumber(activity.hoursPerWeek),
            weeksPerYear: toNumber(activity.weeksPerYear),
          })),
        awards: awards
          .filter((award) => award.name.trim())
          .map((award) => ({
            name: award.name.trim(),
            level: award.level,
            category: award.category,
            year: toNumber(award.year),
            description: compactText(award.description),
          })),
        targetSchools: selectedSchools.map((school) => ({
          schoolId: school.id,
          round: school.round,
          tier: 'TARGET',
        })),
      });
    },
    onSuccess: (data) => {
      // @cache-invalidation-allowed: onSuccess redirects via router.push(data.nextRoute ?? '/prediction?autorun=1') — leaves the onboarding dialog; destination page fetches fresh
      handleClose();
      toast.success(t('saved'));
      router.push(data.nextRoute || '/prediction?autorun=1');
    },
  });

  const canContinue = useMemo(() => {
    if (step === 0) return profile.grade && profile.targetMajor;
    if (step === 1)
      return (
        profile.gpa || scores.sat || scores.act || scores.toefl || scores.ielts || scores.duolingo
      );
    if (step === 3) return selectedSchools.length > 0;
    return true;
  }, [profile.grade, profile.gpa, profile.targetMajor, scores, selectedSchools.length, step]);

  const handleClose = (removePending = true) => {
    setOpen(false);
    if (!removePending) return;
    try {
      localStorage.removeItem(PENDING_ONBOARDING_KEY);
    } catch {
      /* private browsing */
    }
  };

  const updateProfile = (key: keyof ProfileDraft, value: string | boolean) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const updateActivity = (index: number, patch: Partial<ActivityDraft>) => {
    setActivities((prev) =>
      prev.map((activity, itemIndex) =>
        itemIndex === index ? { ...activity, ...patch } : activity
      )
    );
  };

  const updateAward = (index: number, patch: Partial<AwardDraft>) => {
    setAwards((prev) =>
      prev.map((award, itemIndex) => (itemIndex === index ? { ...award, ...patch } : award))
    );
  };

  const addSchool = (school: SchoolSearchItem) => {
    setSelectedSchools((prev) => {
      if (prev.some((item) => item.id === school.id) || prev.length >= 10) return prev;
      return [...prev, { ...school, round: profile.applicationRound || 'RD' }];
    });
    setSchoolQuery('');
  };

  const next = () => {
    if (!canContinue) {
      toast.info(t(step === 3 ? 'schoolsRequired' : 'minimumRequired'));
      return;
    }
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const submit = () => {
    if (!canContinue) {
      toast.info(t('schoolsRequired'));
      return;
    }
    submitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent
        className="max-h-[92vh] overflow-hidden p-0 sm:max-w-[820px]"
        showCloseButton={false}
      >
        <div className="flex h-full max-h-[92vh] flex-col">
          <div className="border-b px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Compass className="h-5 w-5" />
                  </span>
                  <DialogTitle>{t('wizardTitle')}</DialogTitle>
                </div>
                <DialogDescription>{t('wizardSubtitle')}</DialogDescription>
              </DialogHeader>
              <Button variant="ghost" size="icon" onClick={() => handleClose()}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5 space-y-3">
              <Progress value={progress} className="h-1.5" />
              <div className="grid grid-cols-4 gap-2">
                {steps.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStep(index)}
                      className={cn(
                        'flex min-h-10 items-center justify-center gap-2 rounded-md border px-2 text-xs font-medium transition-colors',
                        index === step
                          ? 'border-primary bg-primary/10 text-primary'
                          : index < step
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                            : 'border-border text-muted-foreground'
                      )}
                    >
                      {index < step ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">{t(`steps.${item.id}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-6 py-6">
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('fields.grade')}>
                    <Select
                      value={profile.grade}
                      onValueChange={(value) => updateProfile('grade', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('placeholders.grade')} />
                      </SelectTrigger>
                      <SelectContent>
                        {['FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR', 'GAP_YEAR'].map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`grades.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('fields.educationSystem')}>
                    <Select
                      value={profile.educationSystem}
                      onValueChange={(value) => updateProfile('educationSystem', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('placeholders.educationSystem')} />
                      </SelectTrigger>
                      <SelectContent>
                        {['AP', 'IB', 'A_LEVEL', 'GAOKAO', 'CANADIAN', 'AUSTRALIAN', 'OTHER'].map(
                          (value) => (
                            <SelectItem key={value} value={value}>
                              {t(`educationSystems.${value}`)}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('fields.currentSchool')}>
                    <Input
                      value={profile.currentSchool}
                      onChange={(event) => updateProfile('currentSchool', event.target.value)}
                      placeholder={t('placeholders.currentSchool')}
                    />
                  </Field>
                  <Field label={t('fields.targetMajor')}>
                    <Input
                      value={profile.targetMajor}
                      onChange={(event) => updateProfile('targetMajor', event.target.value)}
                      placeholder={t('placeholders.targetMajor')}
                    />
                  </Field>
                  <Field label={t('fields.nationality')}>
                    <Input
                      value={profile.nationality}
                      onChange={(event) =>
                        updateProfile('nationality', event.target.value.toUpperCase())
                      }
                      placeholder={t('placeholders.countryCode')}
                    />
                  </Field>
                  <Field label={t('fields.countryOfResidence')}>
                    <Input
                      value={profile.countryOfResidence}
                      onChange={(event) =>
                        updateProfile('countryOfResidence', event.target.value.toUpperCase())
                      }
                      placeholder={t('placeholders.countryCode')}
                    />
                  </Field>
                  <Field label={t('fields.citizenship')}>
                    <Input
                      value={profile.citizenship}
                      onChange={(event) =>
                        updateProfile('citizenship', event.target.value.toUpperCase())
                      }
                      placeholder={t('placeholders.countryCode')}
                    />
                  </Field>
                  <Field label={t('fields.applicationRound')}>
                    <Select
                      value={profile.applicationRound}
                      onValueChange={(value) => updateProfile('applicationRound', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['ED', 'ED2', 'EA', 'REA', 'RD'].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <ToggleRow
                    label={t('fields.needsFinancialAid')}
                    checked={profile.needsFinancialAid}
                    onCheckedChange={(value) => updateProfile('needsFinancialAid', value)}
                  />
                  <ToggleRow
                    label={t('fields.applyingTestOptional')}
                    checked={profile.applyingTestOptional}
                    onCheckedChange={(value) => updateProfile('applyingTestOptional', value)}
                  />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('fields.gpa')}>
                      <Input
                        inputMode="decimal"
                        value={profile.gpa}
                        onChange={(event) => updateProfile('gpa', event.target.value)}
                        placeholder="3.85"
                      />
                    </Field>
                    <Field label={t('fields.gpaScale')}>
                      <Select
                        value={profile.gpaScale}
                        onValueChange={(value) => updateProfile('gpaScale', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['4.0', '5.0', '6', '45', '100'].map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['sat', 'SAT', '1520'],
                      ['act', 'ACT', '34'],
                      ['toefl', 'TOEFL', '110'],
                      ['ielts', 'IELTS', '7.5'],
                      ['duolingo', 'Duolingo', '145'],
                    ].map(([key, label, placeholder]) => (
                      <Field key={key} label={label}>
                        <Input
                          inputMode="decimal"
                          value={scores[key as keyof typeof scores]}
                          onChange={(event) =>
                            setScores((prev) => ({ ...prev, [key]: event.target.value }))
                          }
                          placeholder={placeholder}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <CompactList
                    title={t('activitiesTitle')}
                    onAdd={() =>
                      setActivities((prev) => (prev.length < 3 ? [...prev, emptyActivity()] : prev))
                    }
                    canAdd={activities.length < 3}
                  >
                    {activities.map((activity, index) => (
                      <div key={index} className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {t('activityLabel', { index: index + 1 })}
                          </span>
                          {activities.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setActivities((prev) => prev.filter((_, i) => i !== index))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-3">
                          <Input
                            value={activity.name}
                            onChange={(event) =>
                              updateActivity(index, { name: event.target.value })
                            }
                            placeholder={t('placeholders.activityName')}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={activity.category}
                              onValueChange={(value) => updateActivity(index, { category: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  'LEADERSHIP',
                                  'RESEARCH',
                                  'ACADEMIC',
                                  'COMMUNITY_SERVICE',
                                  'ARTS',
                                  'ATHLETICS',
                                  'WORK',
                                  'OTHER',
                                ].map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {t(`activityCategories.${value}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={activity.role}
                              onChange={(event) =>
                                updateActivity(index, { role: event.target.value })
                              }
                              placeholder={t('placeholders.role')}
                            />
                          </div>
                          <Textarea
                            value={activity.description}
                            onChange={(event) =>
                              updateActivity(index, { description: event.target.value })
                            }
                            placeholder={t('placeholders.shortDescription')}
                            rows={2}
                          />
                        </div>
                      </div>
                    ))}
                  </CompactList>

                  <CompactList
                    title={t('awardsTitle')}
                    onAdd={() =>
                      setAwards((prev) => (prev.length < 3 ? [...prev, emptyAward()] : prev))
                    }
                    canAdd={awards.length < 3}
                  >
                    {awards.map((award, index) => (
                      <div key={index} className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {t('awardLabel', { index: index + 1 })}
                          </span>
                          {awards.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setAwards((prev) => prev.filter((_, i) => i !== index))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-3">
                          <Input
                            value={award.name}
                            onChange={(event) => updateAward(index, { name: event.target.value })}
                            placeholder={t('placeholders.awardName')}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={award.level}
                              onValueChange={(value) => updateAward(index, { level: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['SCHOOL', 'REGIONAL', 'STATE', 'NATIONAL', 'INTERNATIONAL'].map(
                                  (value) => (
                                    <SelectItem key={value} value={value}>
                                      {t(`awardLevels.${value}`)}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <Input
                              inputMode="numeric"
                              value={award.year}
                              onChange={(event) => updateAward(index, { year: event.target.value })}
                              placeholder="2026"
                            />
                          </div>
                          <Textarea
                            value={award.description}
                            onChange={(event) =>
                              updateAward(index, { description: event.target.value })
                            }
                            placeholder={t('placeholders.shortDescription')}
                            rows={2}
                          />
                        </div>
                      </div>
                    ))}
                  </CompactList>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={schoolQuery}
                      onChange={(event) => setSchoolQuery(event.target.value)}
                      placeholder={t('placeholders.schoolSearch')}
                      className="pl-9"
                    />
                    {schoolQuery.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-background shadow-lg">
                        <ScrollArea className="max-h-64">
                          {schoolSearchLoading ? (
                            <div className="flex justify-center py-5">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                          ) : schoolResults?.items?.length ? (
                            <div className="p-1">
                              {schoolResults.items.map((school) => (
                                <button
                                  key={school.id}
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
                                  onClick={() => addSchool(school)}
                                >
                                  <span>
                                    <span className="block text-sm font-medium">
                                      {getSchoolName(school, locale)}
                                    </span>
                                    {school.usNewsRank && (
                                      <span className="text-xs text-muted-foreground">
                                        {t('rankLabel', { rank: school.usNewsRank })}
                                      </span>
                                    )}
                                  </span>
                                  <Plus className="h-4 w-4 text-primary" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="py-5 text-center text-sm text-muted-foreground">
                              {t('noSchoolsFound')}
                            </p>
                          )}
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {selectedSchools.map((school) => (
                      <div
                        key={school.id}
                        className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{getSchoolName(school, locale)}</p>
                          {school.usNewsRank && (
                            <p className="text-xs text-muted-foreground">
                              {t('rankLabel', { rank: school.usNewsRank })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={school.round}
                            onValueChange={(value) =>
                              setSelectedSchools((prev) =>
                                prev.map((item) =>
                                  item.id === school.id ? { ...item, round: value } : item
                                )
                              )
                            }
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['ED', 'ED2', 'EA', 'REA', 'RD'].map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setSelectedSchools((prev) =>
                                prev.filter((item) => item.id !== school.id)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {selectedSchools.length === 0 && (
                      <div className="rounded-lg border border-dashed p-8 text-center">
                        <Lightbulb className="mx-auto mb-3 h-6 w-6 text-primary" />
                        <p className="text-sm text-muted-foreground">{t('schoolEmpty')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => handleClose()}
              disabled={submitMutation.isPending}
            >
              {t('skip')}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
                disabled={step === 0 || submitMutation.isPending}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('back')}
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={next} disabled={submitMutation.isPending}>
                  {t('next')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Compass className="mr-2 h-4 w-4" />
                  )}
                  {t('saveAndPredict')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function CompactList({
  title,
  children,
  onAdd,
  canAdd,
}: {
  title: string;
  children: ReactNode;
  onAdd: () => void;
  canAdd: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={onAdd} disabled={!canAdd} className="gap-2">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
