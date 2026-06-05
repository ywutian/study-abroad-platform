'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { caseRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Loader2, ChevronDown } from 'lucide-react';
import { useSchoolSearch } from '@/hooks/use-school-search';
import { BackgroundSection } from './create-case/BackgroundSection';

const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);
const RESULTS = ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'] as const;
const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const;
const VISIBILITIES = ['ANONYMOUS', 'PUBLIC', 'VERIFIED_ONLY'] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCaseDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('admin.dataReview.manualEntry.caseForm');
  const te = useTranslations('admin.dataReview.enums');
  const locale = useLocale();
  const queryClient = useQueryClient();

  // Core fields
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [result, setResult] = useState<string>('ADMITTED');
  const [round, setRound] = useState<string>('');
  const [major, setMajor] = useState('');

  // Scores
  const [gpa, setGpa] = useState('');
  const [sat, setSat] = useState('');
  const [act, setAct] = useState('');
  const [toefl, setToefl] = useState('');

  // AP/IB
  const [apCount, setApCount] = useState('');
  const [apSubjects, setApSubjects] = useState('');
  const [ibScore, setIbScore] = useState('');

  // Background
  const [highSchoolId, setHighSchoolId] = useState('');
  const [highSchoolName, setHighSchoolName] = useState('');
  const [curriculum, setCurriculum] = useState('');
  const [nationality, setNationality] = useState('');
  const [demographics, setDemographics] = useState<Set<string>>(new Set());

  // Activities & Awards (text-based for single entry)
  const [activityList, setActivityList] = useState('');
  const [awardsList, setAwardsList] = useState('');

  // Context
  const [financialAid, setFinancialAid] = useState('');
  const [narrative, setNarrative] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<string>('ANONYMOUS');

  // Validation
  const [submitted, setSubmitted] = useState(false);

  // Collapsible sections
  const [scoresOpen, setScoresOpen] = useState(true);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  const { data: schools } = useSchoolSearch(schoolQuery, open);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post(caseRoutes.list(), body),
    onSuccess: () => {
      toast.success(t('success'));
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['reviewStats'] });
      queryClient.invalidateQueries({ queryKey: qk.cases.all });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setSchoolQuery('');
    setSchoolId('');
    setSchoolName('');
    setYear(String(new Date().getFullYear()));
    setResult('ADMITTED');
    setRound('');
    setMajor('');
    setGpa('');
    setSat('');
    setAct('');
    setToefl('');
    setApCount('');
    setApSubjects('');
    setIbScore('');
    setHighSchoolId('');
    setHighSchoolName('');
    setCurriculum('');
    setNationality('');
    setDemographics(new Set());
    setActivityList('');
    setAwardsList('');
    setFinancialAid('');
    setNarrative('');
    setTags('');
    setVisibility('ANONYMOUS');
    setSubmitted(false);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    if (!schoolId || !year || !result) return;

    // Parse activities text → structured JSON
    const activitiesJson = activityList
      ? activityList
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const match = line.match(/^([^-–]+)\s*[-–]\s*(.+?)(?:\s*\((.+?)\))?$/);
            if (match) {
              return {
                category: match[1].trim(),
                description: match[2].trim(),
                role: match[3]?.trim(),
              };
            }
            return { description: line.trim() };
          })
      : undefined;

    // Parse awards text → structured JSON
    const awardsJson = awardsList
      ? awardsList
          .split('\n')
          .filter(Boolean)
          .map((line) => ({
            name: line.trim(),
            level: 'school' as const,
          }))
      : undefined;

    mutation.mutate({
      schoolId,
      year: parseInt(year),
      result,
      round: round || undefined,
      major: major || undefined,
      gpaRange: gpa || undefined,
      satRange: sat || undefined,
      actRange: act || undefined,
      toeflRange: toefl || undefined,
      // Structured enrichment
      testScores: buildTestScores(),
      activities: activitiesJson,
      awards: awardsJson,
      apCount: apCount ? parseInt(apCount) : undefined,
      apSubjects: apSubjects
        ? apSubjects
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      ibScore: ibScore ? parseInt(ibScore) : undefined,
      highSchoolId: highSchoolId || undefined,
      curriculumType: curriculum || undefined,
      demographicTags: demographics.size > 0 ? [...demographics] : undefined,
      nationality: nationality || undefined,
      financialAid: financialAid || undefined,
      narrative: narrative || undefined,
      activityList: activityList || undefined,
      tags: tags
        ? tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      visibility,
    });
  };

  const buildTestScores = () => {
    const scores: Array<{ type: string; score: number }> = [];
    if (sat) {
      const avg = parseRangeAvg(sat);
      if (avg) scores.push({ type: 'SAT', score: avg });
    }
    if (act) {
      const avg = parseRangeAvg(act);
      if (avg) scores.push({ type: 'ACT', score: avg });
    }
    if (toefl) {
      const avg = parseRangeAvg(toefl);
      if (avg) scores.push({ type: 'TOEFL', score: avg });
    }
    return scores.length > 0 ? scores : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* School search */}
          <div className="space-y-1.5 relative">
            <Label>{t('school')} *</Label>
            <Input
              placeholder={t('schoolSearch')}
              value={schoolId ? schoolName : schoolQuery}
              onChange={(e) => {
                setSchoolQuery(e.target.value);
                setSchoolId('');
                setSchoolName('');
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && schools?.items && schools.items.length > 0 && !schoolId && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                {schools.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => {
                      setSchoolId(s.id);
                      setSchoolName(getLocalizedName(s.nameZh, s.name, locale));
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-medium">
                      {getLocalizedName(s.nameZh, s.name, locale)}
                    </span>
                    {s.usNewsRank && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        US News #{s.usNewsRank}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {submitted && !schoolId && (
              <p className="text-xs text-destructive">{t('validation.schoolRequired')}</p>
            )}
          </div>

          {/* Core info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('year')} *</Label>
              <Select value={year} onValueChange={setYear}>
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
            <div className="space-y-1.5">
              <Label>{t('result')} *</Label>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {te(`result.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('round')}</Label>
              <Select value={round} onValueChange={setRound}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
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
            <div className="space-y-1.5">
              <Label>{t('major')}</Label>
              <Input
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder={t('majorPlaceholder')}
              />
            </div>
          </div>

          {/* ── Scores Section ── */}
          <Collapsible open={scoresOpen} onOpenChange={setScoresOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
              >
                {t('scores')}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${scoresOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('gpa')}</Label>
                  <Input
                    value={gpa}
                    onChange={(e) => setGpa(e.target.value)}
                    placeholder="3.8-4.0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('sat')}</Label>
                  <Input
                    value={sat}
                    onChange={(e) => setSat(e.target.value)}
                    placeholder="1500-1550"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('act')}</Label>
                  <Input value={act} onChange={(e) => setAct(e.target.value)} placeholder="34-36" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('toefl')}</Label>
                  <Input
                    value={toefl}
                    onChange={(e) => setToefl(e.target.value)}
                    placeholder="110-115"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('apCount')}</Label>
                  <Input
                    value={apCount}
                    onChange={(e) => setApCount(e.target.value)}
                    placeholder="12"
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('ibScore')}</Label>
                  <Input
                    value={ibScore}
                    onChange={(e) => setIbScore(e.target.value)}
                    placeholder="42"
                    type="number"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('apSubjects')}</Label>
                <Input
                  value={apSubjects}
                  onChange={(e) => setApSubjects(e.target.value)}
                  placeholder={t('apSubjectsPlaceholder')}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Background Section ── */}
          <BackgroundSection
            highSchoolId={highSchoolId}
            highSchoolName={highSchoolName}
            curriculum={curriculum}
            nationality={nationality}
            demographics={demographics}
            financialAid={financialAid}
            dialogOpen={open}
            onFieldChange={(field, value) => {
              if (field === 'curriculum') setCurriculum(value);
              else if (field === 'nationality') setNationality(value);
              else if (field === 'financialAid') setFinancialAid(value);
            }}
            onDemographicsChange={setDemographics}
            onHighSchoolSelect={(id, name) => {
              setHighSchoolId(id);
              setHighSchoolName(name);
            }}
          />

          {/* ── Activities & Awards Section ── */}
          <Collapsible open={activitiesOpen} onOpenChange={setActivitiesOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
              >
                {t('activitiesAwards')}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${activitiesOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <div className="space-y-1.5">
                <Label>{t('activities')}</Label>
                <Textarea
                  value={activityList}
                  onChange={(e) => setActivityList(e.target.value)}
                  placeholder={t('activitiesPlaceholder')}
                  rows={4}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('awards')}</Label>
                <Textarea
                  value={awardsList}
                  onChange={(e) => setAwardsList(e.target.value)}
                  placeholder={t('awardsPlaceholder')}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Context Section ── */}
          <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
              >
                {t('other')}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${contextOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <div className="space-y-1.5">
                <Label>{t('narrative')}</Label>
                <Textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder={t('narrativePlaceholder')}
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('tags')}</Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder={t('tagsPlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('visibility')}</Label>
                  <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITIES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {te(`visibility.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseRangeAvg(range: string): number | null {
  const match = range.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    return Math.round((parseFloat(match[1]) + parseFloat(match[2])) / 2);
  }
  const single = parseFloat(range);
  return isNaN(single) ? null : Math.round(single);
}
